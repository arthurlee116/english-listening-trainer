import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { getLanguageConfig } from './language-config'
import { validateDeviceConfig, generateDeviceReport } from './device-detection'
import { getWavAudioMetadata, GeneratedAudioResult } from './audio-utils'
import type { ListeningLanguage } from './types'
import {
  buildKokoroPythonEnv,
  resolveKokoroPythonExecutable,
  resolveKokoroWorkingDirectory,
  resolveKokoroWrapperPath
} from './kokoro-env'
import type { KokoroDevicePreference } from './kokoro-env'

/**
 * 电路断路器状态机
 */
enum CircuitState {
  CLOSED = 'closed',     // 正常状态
  OPEN = 'open',         // 故障状态，快速失败
  HALF_OPEN = 'half_open' // 半开放，测试是否恢复
}

/**
 * 电路断路器配置
 */
interface CircuitBreakerConfig {
  failureThreshold: number      // 失败阈值
  successThreshold: number      // 半开放状态下的成功阈值
  timeoutMs: number            // open状态超时时间
  retryDelayMs: number         // 半开放重试间隔
  maxRetryDelayMs: number      // 最大重试延迟
  exponentialBackoff: boolean  // 是否启用指数退避
}

/**
 * 电路断路器实现
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures = 0
  private successes = 0
  private lastFailureTime = 0
  private nextAttemptTime = 0

  constructor(private config: CircuitBreakerConfig) {}

  canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true
      case CircuitState.OPEN:
        if (Date.now() >= this.nextAttemptTime) {
          this.state = CircuitState.HALF_OPEN
          return true
        }
        return false
      case CircuitState.HALF_OPEN:
        return true
      default:
        return false
    }
  }

  recordSuccess(): void {
    this.failures = 0
    this.successes++

    if (this.state === CircuitState.HALF_OPEN && this.successes >= this.config.successThreshold) {
      this.state = CircuitState.CLOSED
      this.successes = 0
      console.log('🚧 Circuit breaker: CLOSED (recovered)')
    }
  }

  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
      this.successes = 0
      this.nextAttemptTime = Date.now() + this.calculateRetryDelay()
      console.log('🚧 Circuit breaker: OPEN (half-open failure)')
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + this.calculateRetryDelay()
      console.log('🚧 Circuit breaker: OPEN (threshold exceeded)')
    }
  }

  private calculateRetryDelay(): number {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelayMs
    }

    // 指数退避：baseDelay * 2^(failures-1)
    const baseDelay = this.config.retryDelayMs
    const multiplier = Math.pow(2, Math.min(this.failures - 1, 5)) // 最多2^5倍
    return Math.min(baseDelay * multiplier, this.config.maxRetryDelayMs)
  }

  getState(): CircuitState {
    return this.state
  }

  getFailures(): number {
    return this.failures
  }

  getNextAttemptTime(): number {
    return this.nextAttemptTime
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successes = 0
    this.lastFailureTime = 0
    this.nextAttemptTime = 0
  }
}

interface PendingRequest {
  resolve: (response: KokoroResponse) => void
  reject: (error: Error) => void
}

export interface KokoroRequest {
  text: string
  speed?: number
  lang_code?: string
  voice?: string
}

export interface KokoroResponse {
  success: boolean
  audio_data?: string
  device?: string
  message?: string
  error?: string
}

export class KokoroTTSService extends EventEmitter {
  private process: ChildProcess | null = null
  private initialized = false
  private pendingRequests: Map<number, PendingRequest> = new Map()
  private requestIdCounter = 0
  private restartAttempts = 0
  private maxRestartAttempts = 10
  private circuitBreaker: CircuitBreaker
  private lastError: string = ''

  constructor() {
    super()

    // 初始化电路断路器
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,        // 5次失败后打开
      successThreshold: 3,        // 半开放状态需3次成功
      timeoutMs: 60 * 1000,       // 1分钟后半开放
      retryDelayMs: 5 * 1000,     // 5秒基础重试延迟
      maxRetryDelayMs: 5 * 60 * 1000, // 5分钟最大延迟
      exponentialBackoff: true
    })

    console.log('🚀 Initializing CPU Kokoro TTS Service...')
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      // 验证设备配置
      const deviceValidation = await validateDeviceConfig()
      if (!deviceValidation.valid) {
        console.warn(`⚠️ ${deviceValidation.message}`)
      } else {
        console.log(`📱 ${deviceValidation.message}`)
      }
      
      await this.startPythonProcess()
      this.initialized = true
      this.emit('ready')
      console.log('✅ Kokoro TTS service initialized successfully')
      
      // 在开发环境下生成设备报告
      if (process.env.NODE_ENV === 'development') {
        const report = await generateDeviceReport()
        console.log('\n' + report)
      }
    } catch (error) {
      console.error('❌ Failed to initialize Kokoro TTS service:', error)
      this.emit('error', error)
    }
  }

  private async startPythonProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 使用真实的Kokoro包装器而不是模拟版本
      const pythonPath = resolveKokoroWrapperPath()

      if (!fs.existsSync(pythonPath)) {
        reject(new Error(`Kokoro wrapper not found at ${pythonPath}`))
        return
      }

      console.log('🚀 Starting Kokoro Python process...')

      // 设置环境变量以支持多种加速方式
      const kokoroDeviceEnv = (process.env.KOKORO_DEVICE || 'auto').toLowerCase()
      const validDevices: KokoroDevicePreference[] = ['auto', 'cuda', 'cpu', 'mps']
      const preferDevice: KokoroDevicePreference = validDevices.includes(
        kokoroDeviceEnv as KokoroDevicePreference
      )
        ? (kokoroDeviceEnv as KokoroDevicePreference)
        : 'auto'
      const env = buildKokoroPythonEnv({ preferDevice })

      console.log(`📱 Kokoro device preference: ${env.KOKORO_DEVICE}`)
      if (env.PATH) {
        console.log(`🔧 PATH: ${env.PATH}`)
      }
      const libraryKey = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH'
      if (env[libraryKey]) {
        console.log(`🔧 ${libraryKey}: ${env[libraryKey]}`)
      }

      let pythonExecutable = resolveKokoroPythonExecutable()
      if ((path.isAbsolute(pythonExecutable) || pythonExecutable.includes(path.sep)) && !fs.existsSync(pythonExecutable)) {
        console.warn(`⚠️ Python executable ${pythonExecutable} not found, falling back to system python3`)
        pythonExecutable = 'python3'
      }

      // 启动Python进程

      this.process = spawn(pythonExecutable, [pythonPath], {
        cwd: resolveKokoroWorkingDirectory(),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // 处理标准输出 - 使用缓冲机制处理大JSON
      let jsonBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        
        // 将数据添加到缓冲区
        jsonBuffer += output
        
        // 尝试解析缓冲区中的JSON
        try {
          const response: KokoroResponse = JSON.parse(jsonBuffer)
          this.handleResponse(response)
          jsonBuffer = '' // 清空缓冲区
          return
        } catch (e) {
          // 如果是Unterminated string错误，继续等待更多数据
          if (e instanceof Error && e.message.includes('Unterminated string')) {
            return
          }
          
          // 如果是其他错误，尝试按行解析
          const lines = jsonBuffer.split('\n').filter(line => line.trim())
          
          lines.forEach(line => {
            try {
              const response: KokoroResponse = JSON.parse(line)
              this.handleResponse(response)
              jsonBuffer = '' // 清空缓冲区
            } catch {
              // 忽略解析错误
            }
          })
        }
      })

      // 处理标准错误
      this.process.stderr?.on('data', (data: Buffer) => {
        const errorOutput = data.toString()
        if (!errorOutput.includes('Defaulting repo_id')) { // 过滤掉默认警告
          console.error('🐍 Kokoro Python stderr:', errorOutput)
        }
        
        // 检查是否为初始化完成
        if (errorOutput.includes('🚀 Kokoro TTS service is ready')) {
          this.initialized = true
          this.emit('ready')
          resolve(undefined)
        }
      })

      // 处理进程退出
      this.process.on('exit', (code, signal) => {
        console.log(`📴 Kokoro process exited with code ${code}, signal: ${signal}`)
        this.handleProcessExit()
      })

      this.process.on('error', (error) => {
        console.error('💥 Kokoro process error:', error)
        reject(error)
      })
      
      // 监控stdin状态
      this.process.stdin?.on('error', (error) => {
        console.error('💥 Kokoro stdin error:', error)
      })
      
      this.process.stdin?.on('close', () => {
        console.log('📴 Kokoro stdin closed')
      })

      // 等待初始化完成
      const timeout = setTimeout(() => {
        if (!this.initialized) {
          reject(new Error('Kokoro initialization timeout'))
        }
      }, 120000) // 120秒超时

      this.once('ready', () => {
        clearTimeout(timeout)
        resolve(undefined)
      })
    })
  }

  private handleResponse(response: KokoroResponse): void {
    // 这里简化处理，实际应用中可能需要请求ID匹配
    if (this.pendingRequests.size > 0) {
      const requestId = Array.from(this.pendingRequests.keys())[0]
      const { resolve, reject } = this.pendingRequests.get(requestId)!
      this.pendingRequests.delete(requestId)

      if (response.success) {
        resolve(response)
      } else {
        reject(new Error(response.error || 'Unknown error'))
      }
    }
  }

  private handleProcessExit(): void {
    this.initialized = false
    this.process = null
    this.circuitBreaker.recordFailure()
    this.restartAttempts++

    const state = this.circuitBreaker.getState()
    const delay = Math.min(5 * 1000 * Math.pow(2, this.restartAttempts), 5 * 60 * 1000) // 指数退避，最大5分钟

    if (state === 'open') {
      console.log(`🔄 Circuit breaker OPEN, retry delay: ${delay}ms`)
    } else if (this.restartAttempts > this.maxRestartAttempts) {
      console.error('❌ Max restart attempts reached, service unavailable')
      this.lastError = 'TTS service unavailable after maximum restart attempts'
      return
    }

    console.log(`🔄 Restarting CPU TTS (attempt ${this.restartAttempts}/${this.maxRestartAttempts}) in ${delay}ms...`)

    setTimeout(() => {
      this.initialize().catch(error => {
        console.error('❌ Failed to restart CPU TTS process:', error instanceof Error ? error.message : String(error))
        this.lastError = `Restart failed: ${error instanceof Error ? error.message : String(error)}`
        this.circuitBreaker.recordFailure()
      })
    }, delay)
  }

  async generateAudio(text: string, speed: number = 1.0, language: ListeningLanguage = 'en-US'): Promise<GeneratedAudioResult> {
    // 检查电路断路器状态
    if (!this.circuitBreaker.canExecute()) {
      const state = this.circuitBreaker.getState()
      const nextAttempt = this.circuitBreaker.getNextAttemptTime()
      const waitTime = Math.max(0, nextAttempt - Date.now())

      throw new Error(`TTS service unavailable (circuit breaker ${state}). Next attempt in ${Math.ceil(waitTime / 1000)}s`)
    }

    if (!this.initialized || !this.process) {
      this.circuitBreaker.recordFailure()
      throw new Error('Kokoro TTS service not initialized')
    }

    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty')
    }

    return new Promise((resolve, reject) => {
      const requestId = this.requestIdCounter++
      
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Audio generation timeout'))
      }, 300000) // 5分钟超时，适应长文本生成

      this.pendingRequests.set(requestId, {
        resolve: (response: KokoroResponse) => {
          clearTimeout(timeout)
          
          if (response.success && response.audio_data) {
            try {
              // 验证音频数据
              if (!response.audio_data || response.audio_data.length === 0) {
                reject(new Error('Received empty audio data from TTS service'))
                return
              }
              
              // 保存音频文件
              const audioBuffer = Buffer.from(response.audio_data, 'hex')
              
              // 验证音频缓冲区大小
              if (audioBuffer.length === 0) {
                reject(new Error('Audio buffer is empty after hex decoding'))
                return
              }
              
              // 检查音频文件最小大小 (WAV header + some audio data)
              if (audioBuffer.length < 100) {
                console.warn(`⚠️ Audio buffer suspiciously small: ${audioBuffer.length} bytes`)
              }
              
              const timestamp = Date.now()
              const filename = `tts_audio_${timestamp}.wav`
              const filepath = path.join(process.cwd(), 'public', filename)
              
              fs.writeFileSync(filepath, audioBuffer)
              
              console.log(`💾 Audio saved: ${filename} (${audioBuffer.length} bytes)`)
              console.log(`🎵 Hex data length: ${response.audio_data.length} chars`)
              
              // 验证文件是否正确写入
              const savedSize = fs.statSync(filepath).size
              if (savedSize !== audioBuffer.length) {
                reject(new Error(`File write mismatch: expected ${audioBuffer.length}, got ${savedSize} bytes`))
                return
              }
              
              const metadata = getWavAudioMetadata(audioBuffer)

              // 成功时记录到电路断路器
              this.circuitBreaker.recordSuccess()
              this.restartAttempts = 0 // 重置重启计数
              this.lastError = '' // 清除错误

              resolve({
                audioUrl: `/${filename}`,
                duration: metadata.duration,
                byteLength: audioBuffer.length
              })
            } catch (error) {
              reject(new Error(`Failed to save audio file: ${error}`))
            }
          } else {
            reject(new Error(response.error || 'Failed to generate audio'))
          }
        },
        reject: (error: Error) => {
           clearTimeout(timeout)
           console.error('❌ CPU audio generation error:', error)
           this.circuitBreaker.recordFailure()
           this.lastError = error.message
           reject(error)
         }
      })

      // 获取语言配置
      const config = getLanguageConfig(language)
      
      // 发送请求到Python进程
      const request: KokoroRequest = { 
        text, 
        speed, 
        lang_code: config.code, 
        voice: config.voice 
      }
      const requestLine = JSON.stringify(request) + '\n'
      
      try {
        // 确保stdin流没有关闭
        if (!this.process?.stdin || this.process.stdin.destroyed) {
          throw new Error('Python process stdin is not available or destroyed')
        }
        
        // 写入数据
        this.process.stdin.write(requestLine)
        
      } catch (error) {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Failed to send request to Python process: ${error}`))
      }
    })
  }

  async isReady(): Promise<boolean> {
    // 检查电路断路器状态
    if (!this.circuitBreaker.canExecute()) {
      console.warn(`🚧 Circuit breaker blocked request: ${this.circuitBreaker.getState()}`)
      return false
    }

    if (this.initialized && this.process) {
      // 服务已正常运行，记录成功
      this.circuitBreaker.recordSuccess()
      return true
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup()
        // 初始化超时也算失败
        this.circuitBreaker.recordFailure()
        resolve(this.initialized && this.process !== null)
      }, 10000) // 10秒超时，增加一点时间

      const handleReady = () => {
        cleanup()
        this.circuitBreaker.recordSuccess()
        resolve(true)
      }

      const handleError = () => {
        cleanup()
        this.circuitBreaker.recordFailure()
        resolve(false)
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.off('ready', handleReady)
        this.off('error', handleError)
      }

      this.once('ready', handleReady)
      this.once('error', handleError)
    })
  }

  /**
   * 获取服务状态和错误信息
   */
  getServiceStatus() {
    return {
      state: this.circuitBreaker.getState(),
      failures: this.circuitBreaker.getFailures(),
      initialized: this.initialized,
      processAlive: this.process !== null,
      lastError: this.lastError || 'None',
      restartAttempts: this.restartAttempts
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Kokoro TTS service...')

    if (this.process) {
      this.process.kill()
      this.process = null
    }

    this.initialized = false
    this.pendingRequests.clear()
    this.removeAllListeners()

    console.log('✅ Kokoro TTS service shutdown complete')
  }
}

// 全局单例实例
export const kokoroTTS = new KokoroTTSService()

// 优雅关闭处理
process.on('SIGINT', async () => {
  await kokoroTTS.shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await kokoroTTS.shutdown()
  process.exit(0)
})
