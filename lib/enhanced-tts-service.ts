/**
 * 增强的TTS服务
 * 添加故障恢复、资源管理、并发控制、熔断器等功能
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { AppError, ErrorType, ErrorSeverity, withRetry as retryFunction, withTimeout as timeoutFunction, OperationCanceller } from './enhanced-error-handler'

export interface KokoroRequest {
  text: string
  speed?: number
  requestId?: string
}

export interface KokoroResponse {
  success: boolean
  audio_data?: string
  device?: string
  message?: string
  error?: string
  requestId?: string
}

// 请求队列管理
interface QueuedRequest {
  request: KokoroRequest
  resolve: (response: KokoroResponse) => void
  reject: (error: Error) => void
  timestamp: number
  timeout: NodeJS.Timeout
}

// 服务状态
enum ServiceState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  RECOVERING = 'recovering',
  SHUTDOWN = 'shutdown'
}

// 音频文件管理器
interface AudioFileManagerStats {
  totalFiles: number;
  totalSize: number;
  oldestFile: Date | null;
  newestFile: Date | null;
}

class AudioFileManager {
  private static instance: AudioFileManager
  private audioFiles: Map<string, { path: string; createdAt: Date; accessed: Date }> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private maxFiles = 100
  private maxAge = 24 * 60 * 60 * 1000 // 24小时

  static getInstance(): AudioFileManager {
    if (!AudioFileManager.instance) {
      AudioFileManager.instance = new AudioFileManager()
    }
    return AudioFileManager.instance
  }

  constructor() {
    this.startCleanupProcess()
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldFiles()
    }, 60 * 60 * 1000) // 每小时清理一次
  }

  addFile(filename: string, filepath: string): void {
    const now = new Date()
    this.audioFiles.set(filename, {
      path: filepath,
      createdAt: now,
      accessed: now
    })

    // 如果文件数量超过限制，清理最老的文件
    if (this.audioFiles.size > this.maxFiles) {
      this.cleanupOldestFiles(10)
    }
  }

  accessFile(filename: string): boolean {
    const fileInfo = this.audioFiles.get(filename)
    if (fileInfo) {
      fileInfo.accessed = new Date()
      return true
    }
    return false
  }

  private cleanupOldFiles(): void {
    const now = Date.now()
    const filesToDelete: string[] = []

    for (const [filename, fileInfo] of this.audioFiles) {
      const age = now - fileInfo.createdAt.getTime()
      if (age > this.maxAge) {
        filesToDelete.push(filename)
      }
    }

    for (const filename of filesToDelete) {
      this.deleteFile(filename)
    }

    if (filesToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${filesToDelete.length} old audio files`)
    }
  }

  private cleanupOldestFiles(count: number): void {
    const sortedFiles = Array.from(this.audioFiles.entries())
      .sort(([, a], [, b]) => a.accessed.getTime() - b.accessed.getTime())
      .slice(0, count)

    for (const [filename] of sortedFiles) {
      this.deleteFile(filename)
    }
  }

  private deleteFile(filename: string): void {
    const fileInfo = this.audioFiles.get(filename)
    if (fileInfo) {
      try {
        if (fs.existsSync(fileInfo.path)) {
          fs.unlinkSync(fileInfo.path)
        }
        this.audioFiles.delete(filename)
      } catch (error) {
        console.error(`Failed to delete audio file ${filename}:`, error)
      }
    }
  }

  getStats(): AudioFileManagerStats {
    let totalSize = 0
    let oldestFile: Date | null = null
    let newestFile: Date | null = null

    for (const [, fileInfo] of this.audioFiles) {
      try {
        if (fs.existsSync(fileInfo.path)) {
          totalSize += fs.statSync(fileInfo.path).size
        }
        
        if (!oldestFile || fileInfo.createdAt < oldestFile) {
          oldestFile = fileInfo.createdAt
        }
        
        if (!newestFile || fileInfo.createdAt > newestFile) {
          newestFile = fileInfo.createdAt
        }
      } catch (_error) {
        // 文件可能已被删除，忽略错误
      }
    }

    return {
      totalFiles: this.audioFiles.size,
      totalSize,
      oldestFile,
      newestFile
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

export interface TTSServiceStats {
  state: ServiceState
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  averageResponseTime: number
  concurrentRequests: number
  queueLength: number
  uptime: number
  lastErrorTime: Date | null
  audioFileStats: AudioFileManagerStats
}

class EnhancedKokoroTTSService extends EventEmitter {
  private process: ChildProcess | null = null
  private state: ServiceState = ServiceState.INITIALIZING
  private requestQueue: Map<string, QueuedRequest> = new Map()
  private requestIdCounter = 0
  private restartAttempts = 0
  private maxRestartAttempts = 5
  private restartCooldown = 0
  private maxRestartCooldown = 300000 // 5分钟
  private concurrentRequests = 0
  private maxConcurrentRequests = 3
  private initializationTimeout: NodeJS.Timeout | null = null
  private processMonitor: NodeJS.Timeout | null = null
  private audioFileManager = AudioFileManager.getInstance()
  private operationCanceller = new OperationCanceller()

  // 服务统计
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastErrorTime: null as Date | null,
    uptime: Date.now()
  }

  constructor() {
    super()
    this.initialize()
    this.startProcessMonitoring()
  }

  private async initialize(): Promise<void> {
    if (this.state === ServiceState.SHUTDOWN) {
      throw new AppError('Service is shut down', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.HIGH,
        component: 'EnhancedKokoroTTSService'
      })
    }

    this.state = ServiceState.INITIALIZING
    console.log('🚀 Initializing enhanced Kokoro TTS service...')

    try {
      await this.startPythonProcess()
      this.state = ServiceState.READY
      this.restartAttempts = 0
      this.restartCooldown = 0
      this.emit('ready')
      console.log('✅ Enhanced Kokoro TTS service ready')
    } catch (error) {
      this.state = ServiceState.ERROR
      this.stats.lastErrorTime = new Date()
      
      const appError = new AppError('Failed to initialize Kokoro TTS service', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.HIGH,
        component: 'EnhancedKokoroTTSService',
        operation: 'initialize'
      }, error as Error)

      this.emit('error', appError)
      
      // 尝试重启
      await this.scheduleRestart()
      throw appError
    }
  }

  private async startPythonProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonPath = path.join(process.cwd(), 'kokoro-local', 'kokoro_wrapper.py')
      
      if (!fs.existsSync(pythonPath)) {
        reject(new Error(`Kokoro wrapper not found at ${pythonPath}`))
        return
      }

      console.log('🐍 Starting enhanced Kokoro Python process...')
      
      // 设置环境变量
      const env = {
        ...process.env,
        PYTORCH_ENABLE_MPS_FALLBACK: '1',
        PYTHONPATH: path.join(process.cwd(), 'kokoro-main-ref') + ':' + (process.env.PYTHONPATH || ''),
        // 添加内存优化环境变量
        OMP_NUM_THREADS: '2',
        MKL_NUM_THREADS: '2',
        PYTORCH_MPS_HIGH_WATERMARK_RATIO: '0.0'
      }

      const venvPythonPath = path.join(process.cwd(), 'kokoro-local', 'venv', 'bin', 'python')
      const venvPath = path.join(process.cwd(), 'kokoro-local', 'venv')
      
      const venvEnv = {
        ...env,
        VIRTUAL_ENV: venvPath,
        PATH: `${venvPath}/bin:${process.env.PATH || ''}`,
        PYTHONPATH: path.join(process.cwd(), 'kokoro-main-ref') + ':' + path.join(venvPath, 'lib', 'python3.13', 'site-packages') + ':' + (process.env.PYTHONPATH || '')
      }
      
      // 启动Python进程
      this.process = spawn(venvPythonPath, [pythonPath], {
        cwd: path.join(process.cwd(), 'kokoro-local'),
        env: venvEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // 设置初始化超时
      this.initializationTimeout = setTimeout(() => {
        if (this.state === ServiceState.INITIALIZING) {
          this.killProcess()
          reject(new Error('Kokoro initialization timeout (120s)'))
        }
      }, 120000)

      // 处理标准输出
      let jsonBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        jsonBuffer += output
        
        try {
          const response: KokoroResponse = JSON.parse(jsonBuffer)
          this.handleResponse(response)
          jsonBuffer = ''
        } catch (e) {
          // 处理分块的JSON数据
          if (e instanceof Error && e.message.includes('Unterminated string')) {
            return // 等待更多数据
          }
          
          const lines = jsonBuffer.split('\n').filter(line => line.trim())
          lines.forEach(line => {
            try {
              const response: KokoroResponse = JSON.parse(line)
              this.handleResponse(response)
              jsonBuffer = ''
            } catch (_lineError) {  // ignore
              // 忽略解析错误
            }
          })
        }
      })

      // 处理标准错误
      this.process.stderr?.on('data', (data: Buffer) => {
        const errorOutput = data.toString()
        
        // 过滤掉常见的非关键警告
        if (!errorOutput.includes('Defaulting repo_id') && 
            !errorOutput.includes('UserWarning') &&
            !errorOutput.includes('FutureWarning')) {
          console.error('🐍 Kokoro stderr:', errorOutput)
        }
        
        // 检查初始化完成信号
        if (errorOutput.includes('🚀 Kokoro TTS service is ready')) {
          if (this.initializationTimeout) {
            clearTimeout(this.initializationTimeout)
            this.initializationTimeout = null
          }
          resolve(undefined)
        }
      })

      // 处理进程退出
      this.process.on('exit', (_code, _signal) => {  // renamed unused
        console.log(`📴 Enhanced Kokoro process exited with code ${_code}, signal: ${_signal}`)
        this.handleProcessExit(_code, _signal)
      })

      this.process.on('error', (error) => {
        console.error('💥 Enhanced Kokoro process error:', error)
        this.killProcess()
        reject(error)
      })

      // 监控stdin状态
      this.process.stdin?.on('error', (error) => {
        console.error('💥 Kokoro stdin error:', error)
        this.handleProcessError(error)
      })
    })
  }

  private handleResponse(response: KokoroResponse): void {
    const requestId = response.requestId || Array.from(this.requestQueue.keys())[0]
    const queuedRequest = this.requestQueue.get(requestId)
    
    if (!queuedRequest) {
      console.warn(`⚠️ Received response for unknown request: ${requestId}`)
      return
    }

    // 清理请求
    clearTimeout(queuedRequest.timeout)
    this.requestQueue.delete(requestId)
    this.concurrentRequests--

    // 更新统计
    const responseTime = Date.now() - queuedRequest.timestamp
    this.updateStats(response.success, responseTime)

    if (response.success) {
      queuedRequest.resolve(response)
    } else {
      const _error = new Error(response.error || 'TTS generation failed')  // renamed
      queuedRequest.reject(_error)
    }

    // 处理队列中的下一个请求
    this.processQueue()
  }

  private handleProcessExit(code: number | null, signal: string | null): void {
    this.state = ServiceState.ERROR
    this.process = null
    this.concurrentRequests = 0

    // 清理所有待处理请求
    for (const [_requestId, queuedRequest] of this.requestQueue) {
      clearTimeout(queuedRequest.timeout)
      queuedRequest.reject(new Error('TTS service process exited unexpectedly'))
    }
    this.requestQueue.clear()

    // 尝试重启
    this.scheduleRestart()
  }

  private handleProcessError(error: Error): void {
    this.state = ServiceState.ERROR
    this.stats.lastErrorTime = new Date()
    
    console.error('🔥 TTS service process error:', error)
    this.emit('error', error)
  }

  private async scheduleRestart(): Promise<void> {
    if (this.state === ServiceState.SHUTDOWN) {
      return
    }

    if (this.restartAttempts >= this.maxRestartAttempts) {
      // 重置重启计数器，但增加冷却时间
      this.restartAttempts = 0
      this.restartCooldown = Math.min(this.restartCooldown * 2 || 30000, this.maxRestartCooldown)
      
      console.warn(`🕐 TTS service restart cooldown: ${this.restartCooldown / 1000}s`)
      
      setTimeout(() => {
        this.scheduleRestart()
      }, this.restartCooldown)
      return
    }

    this.restartAttempts++
    this.state = ServiceState.RECOVERING
    
    const delay = Math.min(5000 * this.restartAttempts, 30000)
    console.log(`🔄 Restarting TTS service (attempt ${this.restartAttempts}/${this.maxRestartAttempts}) in ${delay / 1000}s...`)
    
    setTimeout(async () => {
      try {
        await this.initialize()
      } catch (error) {
        console.error('🚫 TTS service restart failed:', error)
      }
    }, delay)
  }

  private startProcessMonitoring(): void {
    this.processMonitor = setInterval(() => {
      if (this.state === ServiceState.READY && this.process) {
        // 检查进程是否还活着
        try {
          process.kill(this.process.pid!, 0)
        } catch (_error) {
          console.warn('⚠️ TTS process appears to be dead, restarting...')
          this.handleProcessExit(null, null)
        }
      }
    }, 30000) // 每30秒检查一次
  }

  private updateStats(success: boolean, responseTime: number): void {
    this.stats.totalRequests++
    
    if (success) {
      this.stats.successfulRequests++
    } else {
      this.stats.failedRequests++
      this.stats.lastErrorTime = new Date()
    }

    // 更新平均响应时间
    const totalResponseTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1)
    this.stats.averageResponseTime = (totalResponseTime + responseTime) / this.stats.totalRequests
  }

  async generateAudio(text: string, speed: number = 1.0): Promise<string> {
    if (this.state === ServiceState.SHUTDOWN) {
      throw new AppError('TTS service is shut down', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.HIGH,
        component: 'EnhancedKokoroTTSService'
      })
    }

    if (this.state !== ServiceState.READY) {
      throw new AppError('TTS service not ready', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedKokoroTTSService',
        metadata: { currentState: this.state }
      })
    }

    if (!text || text.trim() === '') {
      throw new AppError('Text cannot be empty', {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        component: 'EnhancedKokoroTTSService'
      })
    }

    // 检查并发限制
    if (this.concurrentRequests >= this.maxConcurrentRequests) {
      throw new AppError('Too many concurrent TTS requests', {
        type: ErrorType.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedKokoroTTSService',
        metadata: { concurrentRequests: this.concurrentRequests, maxConcurrent: this.maxConcurrentRequests }
      })
    }

    const requestId = `req_${++this.requestIdCounter}_${Date.now()}`
    const request: KokoroRequest = { text, speed, requestId }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestQueue.delete(requestId)
        this.concurrentRequests--
        reject(new AppError('Audio generation timeout', {
          type: ErrorType.TTS_SERVICE,
          severity: ErrorSeverity.MEDIUM,
          component: 'EnhancedKokoroTTSService',
          operation: 'generateAudio',
          metadata: { requestId, textLength: text.length }
        }))
      }, 90000)

      const queuedRequest: QueuedRequest = {
        request,
        resolve: async (response: KokoroResponse) => {
          try {
            const audioUrl = await this.processAudioResponse(response)
            resolve(audioUrl)
          } catch (error) {
            reject(error)
          }
        },
        reject,
        timestamp: Date.now(),
        timeout
      }

      this.requestQueue.set(requestId, queuedRequest)
      this.concurrentRequests++
      
      this.sendRequest(request)
    })
  }

  private async processAudioResponse(response: KokoroResponse): Promise<string> {
    if (!response.audio_data || response.audio_data.length === 0) {
      throw new AppError('Received empty audio data', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedKokoroTTSService'
      })
    }

    try {
      // 解码音频数据
      const audioBuffer = Buffer.from(response.audio_data, 'hex')
      
      if (audioBuffer.length === 0) {
        throw new Error('Audio buffer is empty after hex decoding')
      }

      if (audioBuffer.length < 100) {
        console.warn(`⚠️ Audio buffer suspiciously small: ${audioBuffer.length} bytes`)
      }

      // 生成文件名和路径
      const timestamp = Date.now()
      const filename = `tts_audio_${timestamp}.wav`
      const filepath = path.join(process.cwd(), 'public', filename)

      // 确保public目录存在
      const publicDir = path.join(process.cwd(), 'public')
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }

      // 写入文件
      fs.writeFileSync(filepath, audioBuffer)

      // 验证文件写入
      const savedSize = fs.statSync(filepath).size
      if (savedSize !== audioBuffer.length) {
        throw new Error(`File write mismatch: expected ${audioBuffer.length}, got ${savedSize} bytes`)
      }

      // 注册到文件管理器
      this.audioFileManager.addFile(filename, filepath)

      console.log(`💾 Audio saved: ${filename} (${audioBuffer.length} bytes)`)
      
      return `/${filename}`
    } catch (error) {
      throw new AppError('Failed to process audio response', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedKokoroTTSService',
        operation: 'processAudioResponse'
      }, error as Error)
    }
  }

  private sendRequest(request: KokoroRequest): void {
    if (!this.process?.stdin || this.process.stdin.destroyed) {
      throw new AppError('TTS process stdin not available', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.HIGH,
        component: 'EnhancedKokoroTTSService'
      })
    }

    try {
      const requestLine = JSON.stringify(request) + '\n'
      this.process.stdin.write(requestLine)
    } catch (error) {
      throw new AppError('Failed to send request to TTS process', {
        type: ErrorType.TTS_SERVICE,
        severity: ErrorSeverity.HIGH,
        component: 'EnhancedKokoroTTSService'
      }, error as Error)
    }
  }

  private processQueue(): void {
    // 这里可以实现更复杂的队列处理逻辑
    // 当前实现已经在handleResponse中处理了队列
  }

  private killProcess(): void {
    if (this.process) {
      try {
        this.process.kill('SIGTERM')
        
        // 如果进程5秒内没有退出，强制杀死
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
        }, 5000)
      } catch (error) {
        console.error('Error killing TTS process:', error)
      }
    }

    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout)
      this.initializationTimeout = null
    }
  }

  async isReady(): Promise<boolean> {
    return this.state === ServiceState.READY
  }

  getStats(): TTSServiceStats {
    const now = Date.now()
    return {
      state: this.state,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      successRate: this.stats.totalRequests > 0 ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 0,
      averageResponseTime: this.stats.averageResponseTime,
      concurrentRequests: this.concurrentRequests,
      queueLength: this.requestQueue.size,
      uptime: now - this.stats.uptime,
      lastErrorTime: this.stats.lastErrorTime,
      audioFileStats: this.audioFileManager.getStats()
    }
  }

  async healthCheck(): Promise<{
    isHealthy: boolean
    state: ServiceState
    issues: string[]
  }> {
    const issues: string[] = []
    
    if (this.state !== ServiceState.READY) {
      issues.push(`Service state is ${this.state}, expected READY`)
    }

    if (!this.process || this.process.killed) {
      issues.push('Python process is not running')
    }

    if (this.concurrentRequests >= this.maxConcurrentRequests) {
      issues.push('Service is at maximum concurrent request limit')
    }

    if (this.requestQueue.size > 10) {
      issues.push(`Request queue is large: ${this.requestQueue.size} items`)
    }

    const successRate = this.stats.totalRequests > 0 ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100
    if (successRate < 80) {
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`)
    }

    return {
      isHealthy: issues.length === 0 && this.state === ServiceState.READY,
      state: this.state,
      issues
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down enhanced Kokoro TTS service...')
    
    this.state = ServiceState.SHUTDOWN
    
    // 停止监控
    if (this.processMonitor) {
      clearInterval(this.processMonitor)
      this.processMonitor = null
    }

    // 取消所有操作
    this.operationCanceller.cancelAllOperations()

    // 清理请求队列
    for (const [_requestId, queuedRequest] of this.requestQueue) {
      clearTimeout(queuedRequest.timeout)
      queuedRequest.reject(new Error('Service is shutting down'))
    }
    this.requestQueue.clear()

    // 关闭Python进程
    this.killProcess()

    // 清理文件管理器
    this.audioFileManager.shutdown()

    this.removeAllListeners()
    
    console.log('✅ Enhanced Kokoro TTS service shutdown complete')
  }
}

// 装饰器实现
function withRetry<P extends unknown[], R>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<(...args: P) => Promise<R>>
) {
  const method = descriptor.value;
  if (!method) return;

  descriptor.value = function (this: EnhancedKokoroTTSService, ...args: P): Promise<R> {
    const operationName = `${target.constructor.name}.${propertyName}`
    const retryWrapper = retryFunction(
      method.bind(this),
      {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 10000,
        backoffFactor: 2,
        retryableErrors: ['ECONNRESET', 'timeout', 'not ready', 'process exited']
      },
      operationName
    )
    return retryWrapper(...args)
  }
}

function withTimeout(timeoutMs: number) {
  return function <P extends unknown[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: P) => Promise<R>>
  ) {
    const method = descriptor.value;
    if (!method) return;

    descriptor.value = function (this: EnhancedKokoroTTSService, ...args: P): Promise<R> {
      const timeoutWrapper = timeoutFunction(method.bind(this), timeoutMs);
      return timeoutWrapper(...args)
    }
  };
}

// 导出单例实例
export const enhancedKokoroTTS = new EnhancedKokoroTTSService()

// 优雅关闭处理
process.on('SIGINT', async () => {
  await enhancedKokoroTTS.shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await enhancedKokoroTTS.shutdown()
  process.exit(0)
})

export default enhancedKokoroTTS