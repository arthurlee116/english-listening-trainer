/**
 * 增强版Kokoro TTS服务
 * 修复架构问题，添加重启机制、错误处理和资源清理
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { ErrorHandler, ErrorCode, ErrorSeverity, AppError } from './error-handler'

export interface KokoroRequest {
  text: string
  speed?: number
  requestId?: number
}

export interface KokoroResponse {
  success: boolean
  audio_data?: string
  device?: string
  message?: string
  error?: string
  requestId?: number
}

interface PendingRequest {
  resolve: (value: KokoroResponse) => void;
  reject: (error: AppError) => void;
  timestamp: number;
  timeout?: NodeJS.Timeout;
}

interface QueuedRequest extends KokoroRequest {
  resolve: (value: KokoroResponse | PromiseLike<KokoroResponse>) => void;
  reject: (reason?: AppError) => void;
  queueTimeout: NodeJS.Timeout;
}

export class KokoroTTSServiceEnhanced extends EventEmitter {
  private process: ChildProcess | null = null
  private initialized = false
  private initializing = false
  private pendingRequests: Map<number, PendingRequest> = new Map()
  private requestIdCounter = 0
  private restartAttempts = 0
  private maxRestartAttempts = 3
  private restartCooldown = 5000 // 5秒冷却时间
  private lastRestartTime = 0
  private requestQueue: QueuedRequest[] = []
  private isProcessing = false
  private requestTimeout = 30000 // 30秒超时
  private maxConcurrentRequests = 1 // TTS服务限制并发
  private currentRequests = 0

  private static instance: KokoroTTSServiceEnhanced | null = null

  constructor() {
    super()
    this.setupGracefulShutdown()
  }

  // 单例模式
  static getInstance(): KokoroTTSServiceEnhanced {
    if (!KokoroTTSServiceEnhanced.instance) {
      KokoroTTSServiceEnhanced.instance = new KokoroTTSServiceEnhanced()
    }
    return KokoroTTSServiceEnhanced.instance
  }

  // 懒加载初始化
  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (this.initializing) {
      return new Promise((resolve, reject) => {
        this.once('ready', resolve)
        this.once('error', (error: AppError) => reject(error))
      })
    }

    this.initializing = true
    
    try {
      await this.initialize()
    } catch (error) {
      this.initializing = false
      throw error
    }
  }

  private async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Kokoro TTS service...')
      await this.startPythonProcess()
      this.initialized = true
      this.initializing = false
      this.emit('ready')
      console.log('✅ Kokoro TTS service initialized successfully')
    } catch (error) {
      this.initializing = false
      const appError = ErrorHandler.wrapError(
        error as Error,
        ErrorCode.TTS_SERVICE_ERROR,
        ErrorSeverity.HIGH,
        'TTS服务初始化失败'
      )
      console.error('❌ Failed to initialize Kokoro TTS service:', appError)
      this.emit('error', appError)
      throw appError
    }
  }

  private async startPythonProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonPath = path.join(process.cwd(), 'kokoro-local', 'kokoro_wrapper.py')
      
      if (!fs.existsSync(pythonPath)) {
        const error = new Error(`Kokoro wrapper not found at ${pythonPath}`)
        reject(error)
        return
      }

      // 设置环境变量
      const venvPath = path.join(process.cwd(), 'kokoro-local', 'venv')
      const venvPythonPath = path.join(venvPath, 'bin', 'python')
      
      const env = {
        ...process.env,
        PYTORCH_ENABLE_MPS_FALLBACK: '1',
        VIRTUAL_ENV: venvPath,
        PATH: `${venvPath}/bin:${process.env.PATH || ''}`,
        PYTHONPATH: [
          path.join(process.cwd(), 'kokoro-main-ref'),
          path.join(venvPath, 'lib', 'python3.13', 'site-packages'),
          process.env.PYTHONPATH || ''
        ].filter(Boolean).join(':')
      }

      // 启动Python进程
      this.process = spawn(venvPythonPath, [pythonPath], {
        cwd: path.join(process.cwd(), 'kokoro-local'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // 处理进程错误
      this.process.on('error', (error) => {
        console.error('Python process error:', error)
        reject(ErrorHandler.wrapError(
          error,
          ErrorCode.TTS_SERVICE_ERROR,
          ErrorSeverity.HIGH,
          'TTS进程启动失败'
        ))
      })

      this.process.on('exit', (code, signal) => {
        console.log(`Python process exited with code ${code}, signal ${signal}`)
        this.handleProcessExit(code, signal)
      })

      // 处理标准输出
      let jsonBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        jsonBuffer += output
        
        // 尝试解析JSON响应
        this.tryParseResponse(jsonBuffer)
          .then((response) => {
            if (response) {
              jsonBuffer = '' // 清空缓冲区
              this.handleResponse(response)
            }
          })
          .catch(() => {
            // 等待更多数据
          })
      })

      // 处理标准错误
      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        console.error('Python stderr:', error)
        
        // 检查是否为致命错误
        if (error.includes('Error') || error.includes('Exception')) {
          this.emit('error', ErrorHandler.createError(
            ErrorCode.TTS_SERVICE_ERROR,
            error,
            ErrorSeverity.MEDIUM,
            'TTS服务运行错误'
          ))
        }
      })

      // 等待初始化完成
      const initTimeout = setTimeout(() => {
        reject(new Error('TTS service initialization timeout'))
      }, 30000)

      this.once('ready', () => {
        clearTimeout(initTimeout)
        resolve()
      })

      this.once('error', (error: AppError) => {
        clearTimeout(initTimeout)
        reject(error)
      })
    })
  }

  private async tryParseResponse(buffer: string): Promise<KokoroResponse | null> {
    try {
      const response: KokoroResponse = JSON.parse(buffer)
      return response
    } catch (error) {
      // 如果不是完整的JSON，返回null等待更多数据
      return null
    }
  }

  private handleResponse(response: KokoroResponse): void {
    const requestId = response.requestId || 0
    const pendingRequest = this.pendingRequests.get(requestId)
    
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout)
      this.pendingRequests.delete(requestId)
      this.currentRequests = Math.max(0, this.currentRequests - 1)
      
      if (response.success) {
        pendingRequest.resolve(response)
      } else {
        const error = ErrorHandler.createError(
          ErrorCode.TTS_GENERATION_FAILED,
          response.error || 'TTS generation failed',
          ErrorSeverity.MEDIUM,
          '音频生成失败'
        )
        pendingRequest.reject(error)
      }
    }
    
    // 处理队列中的下一个请求
    this.processQueue()
  }

  private handleProcessExit(code: number | null, signal: string | null): void {
    this.initialized = false
    this.process = null
    
    // 拒绝所有待处理的请求
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout)
      request.reject(ErrorHandler.createError(
        ErrorCode.TTS_SERVICE_ERROR,
        'TTS service process exited',
        ErrorSeverity.HIGH,
        'TTS服务意外退出'
      ))
    })
    this.pendingRequests.clear()
    this.currentRequests = 0

    // 尝试重启
    if (this.shouldRestart()) {
      this.attemptRestart()
    }
  }

  private shouldRestart(): boolean {
    const now = Date.now()
    return (
      this.restartAttempts < this.maxRestartAttempts &&
      (now - this.lastRestartTime) > this.restartCooldown
    )
  }

  private async attemptRestart(): Promise<void> {
    this.restartAttempts++
    this.lastRestartTime = Date.now()
    
    console.log(`🔄 Attempting to restart TTS service (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`)
    
    try {
      await new Promise(resolve => setTimeout(resolve, this.restartCooldown))
      await this.initialize()
      this.restartAttempts = 0 // 重置重启计数
      console.log('✅ TTS service restarted successfully')
    } catch (error) {
      console.error(`❌ Restart attempt ${this.restartAttempts} failed:`, error)
      
      if (this.restartAttempts >= this.maxRestartAttempts) {
        console.error('❌ Max restart attempts reached, giving up')
        this.emit('max-restarts-exceeded')
      }
    }
  }

  async generateAudio(text: string, speed: number = 1.0): Promise<KokoroResponse> {
    // 确保服务已初始化
    await this.ensureInitialized()
    
    // 验证输入
    if (!text || text.trim().length === 0) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Empty text provided',
        ErrorSeverity.LOW,
        '请提供要生成音频的文本'
      )
    }

    if (text.length > 5000) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Text too long',
        ErrorSeverity.LOW,
        '文本长度不能超过5000字符'
      )
    }

    const request: KokoroRequest = {
      text: text.trim(),
      speed,
      requestId: ++this.requestIdCounter
    }

    // 检查并发限制
    if (this.currentRequests >= this.maxConcurrentRequests) {
      return new Promise<KokoroResponse>((resolve, reject) => {
        const queueTimeout = setTimeout(() => {
          const index = this.requestQueue.findIndex(r => r.requestId === request.requestId);
          if (index > -1) {
            this.requestQueue.splice(index, 1);
          }
          reject(ErrorHandler.createError(
            ErrorCode.TIMEOUT_ERROR,
            'Request queued too long',
            ErrorSeverity.MEDIUM,
            '请求队列超时，请稍后重试'
          ));
        }, 60000); // 1分钟队列超时

        this.requestQueue.push({
          ...request,
          resolve,
          reject,
          queueTimeout,
        });
      });
    }

    return this.executeRequest(request)
  }

  private async executeRequest(request: KokoroRequest): Promise<KokoroResponse> {
    if (!this.process || !this.initialized) {
      throw ErrorHandler.createError(
        ErrorCode.TTS_SERVICE_ERROR,
        'TTS service not available',
        ErrorSeverity.HIGH,
        'TTS服务不可用'
      )
    }

    this.currentRequests++

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.requestId!)
        this.currentRequests = Math.max(0, this.currentRequests - 1)
        reject(ErrorHandler.createError(
          ErrorCode.TIMEOUT_ERROR,
          'Request timeout',
          ErrorSeverity.MEDIUM,
          '请求超时，请稍后重试'
        ))
      }, this.requestTimeout)

      this.pendingRequests.set(request.requestId!, {
        resolve,
        reject,
        timestamp: Date.now(),
        timeout
      })

      // 发送请求到Python进程
      try {
        const requestJson = JSON.stringify(request) + '\n'
        this.process!.stdin!.write(requestJson)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequests.delete(request.requestId!)
        this.currentRequests = Math.max(0, this.currentRequests - 1)
        reject(ErrorHandler.wrapError(
          error as Error,
          ErrorCode.TTS_SERVICE_ERROR,
          ErrorSeverity.HIGH,
          '发送请求失败'
        ))
      }
    })
  }

  private processQueue(): void {
    if (this.requestQueue.length > 0 && this.currentRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift()!
      
      clearTimeout(request.queueTimeout);

      this.executeRequest(request)
        .then(response => {
          request.resolve(response);
        })
        .catch(error => {
          request.reject(error);
        });
    }
  }

  // 健康检查
  isHealthy(): boolean {
    return this.initialized && this.process !== null && !this.process.killed
  }

  // 获取服务状态
  getStatus(): {
    initialized: boolean
    healthy: boolean
    pendingRequests: number
    queueLength: number
    restartAttempts: number
  } {
    return {
      initialized: this.initialized,
      healthy: this.isHealthy(),
      pendingRequests: this.pendingRequests.size,
      queueLength: this.requestQueue.length,
      restartAttempts: this.restartAttempts
    }
  }

  // 优雅关闭
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Kokoro TTS service...')
    
    // 停止接受新请求
    this.initialized = false
    
    // 清理队列
    this.requestQueue.forEach(request => {
      clearTimeout(request.queueTimeout);
      request.reject(ErrorHandler.createError(
        ErrorCode.TTS_SERVICE_ERROR,
        'Service shutting down',
        ErrorSeverity.LOW,
        '服务正在关闭'
      ));
    });
    this.requestQueue = []
    
    // 等待待处理请求完成或超时
    const shutdownTimeout = 10000 // 10秒
    const startTime = Date.now()
    
    while (this.pendingRequests.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // 强制清理剩余请求
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout)
      request.reject(ErrorHandler.createError(
        ErrorCode.TTS_SERVICE_ERROR,
        'Service shutdown',
        ErrorSeverity.LOW,
        '服务已关闭'
      ))
    })
    this.pendingRequests.clear()
    
    // 关闭Python进程
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM')
      
      // 等待进程优雅退出
      await new Promise<void>((resolve) => {
        const forceKillTimeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
          resolve()
        }, 5000)
        
        this.process!.on('exit', () => {
          clearTimeout(forceKillTimeout)
          resolve()
        })
      })
    }
    
    this.process = null
    console.log('✅ Kokoro TTS service shutdown complete')
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      this.shutdown().catch(console.error)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('exit', shutdown)
  }
}

// 导出单例实例
export const kokoroTTSService = KokoroTTSServiceEnhanced.getInstance()