import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

import { getWavAudioMetadata, GeneratedAudioResult } from './audio-utils'

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

/**
 * 增强版Kokoro TTS服务，专为GPU服务器优化
 * 支持CUDA加速和真实Kokoro模型
 * 集成电路断路器防止级联故障
 */
export class KokoroTTSGPUService extends EventEmitter {
  private process: ChildProcess | null = null
  private initialized = false
  private pendingRequests: Map<number, { resolve: (response: { success: boolean; audio_data?: string; device?: string; error?: string }) => void; reject: (error: Error) => void }> = new Map()
  private requestIdCounter = 0
  private circuitBreaker: CircuitBreaker
  private restartAttempts = 0
  private maxRestartAttempts = 10
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

    console.log('🚀 Initializing Kokoro GPU TTS Service...')
    this.startPythonProcess().catch(error => console.error('Init failed:', error instanceof Error ? error.message : String(error)))
  }

  // Add shutdown method
  async shutdown(): Promise<void> {
    console.log('Shutting down GPU TTS service...')
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.pendingRequests.clear()
    this.initialized = false
  }

  private async startPythonProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 使用真实的Kokoro GPU包装器
      const pythonPath = path.join(process.cwd(), 'kokoro-local', 'kokoro_wrapper_real.py')
      
      if (!fs.existsSync(pythonPath)) {
        console.error('❌ Kokoro GPU wrapper not found:', pythonPath)
        reject(new Error(`Kokoro GPU wrapper not found at ${pythonPath}`))
        return
      }

      console.log('🚀 Starting Kokoro GPU Python process...')
      
      // 为GPU服务器优化的环境变量
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PYTORCH_ENABLE_MPS_FALLBACK: '1',
        KOKORO_DEVICE: 'cuda',
        PYTHONPATH: path.join(process.cwd(), 'kokoro-main-ref') + ':' + (process.env.PYTHONPATH || ''),
        PATH: `/usr/local/cuda-12.2/bin:${process.env.PATH || ''}`,
        LD_LIBRARY_PATH: `/usr/local/cuda-12.2/lib64:${process.env.LD_LIBRARY_PATH || ''}`,
        https_proxy: process.env.https_proxy || 'http://81.71.93.183:10811',
        http_proxy: process.env.http_proxy || 'http://81.71.93.183:10811'
      }
      
      console.log(`🔧 CUDA Device: cuda`)
      console.log(`🔧 CUDA PATH: ${env.PATH}`)
      console.log(`🌐 Proxy: ${env.https_proxy}`)

      const venvPythonPath = path.join(process.cwd(), 'kokoro-local', 'venv', 'bin', 'python3')
      
      if (!fs.existsSync(venvPythonPath)) {
        console.warn('⚠️ Virtual environment Python not found, using system Python')
      }
      
      const pythonExecutable = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python3'

      // 启动Python进程
      this.process = spawn(pythonExecutable, [pythonPath], {
        cwd: path.join(process.cwd(), 'kokoro-local'),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // 处理标准输出
      let jsonBuffer = ''
      if (this.process.stdout) {
        this.process.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          jsonBuffer += output
          
          try {
            const response = JSON.parse(jsonBuffer) as { success: boolean; error?: string; audio_data?: string; device?: string }
            this.handleResponse(response)
            jsonBuffer = ''
          } catch (e) {
            // 处理分块的JSON数据
            if (e instanceof Error && e.message.includes('Unterminated string')) {
              return
            }
            
            const lines = jsonBuffer.split('\n').filter(line => line.trim())
            lines.forEach(line => {
              try {
                const response = JSON.parse(line) as { success: boolean; error?: string; audio_data?: string; device?: string }
                this.handleResponse(response)
                jsonBuffer = ''
              } catch {
                // ignore invalid JSON lines
              }
            })
          }
        })
      }

      // 处理标准错误（日志）
      if (this.process.stderr) {
        this.process.stderr.on('data', (data: Buffer) => {
          const errorOutput = data.toString()
          console.log('🐍 Kokoro GPU stderr:', errorOutput.trim())
          
          // 检查初始化完成
          if (errorOutput.includes('Kokoro TTS service is ready')) {
            this.initialized = true
            this.emit('ready')
            resolve(undefined)
          }
        })
      }

      // 处理进程退出
      if (this.process) {
        this.process.on('exit', (code, signal) => {
          console.log(`📴 Kokoro GPU process exited with code ${code}, signal: ${signal}`)
          // intentionally restart via handler
          this.handleProcessExit()
        })

        this.process.on('error', (error) => {
          console.error('💥 Kokoro GPU process error:', error)
          reject(error)
        })
      }

      // 超时设置
      const timeout = setTimeout(() => {
        if (!this.initialized) {
          reject(new Error('Kokoro GPU initialization timeout'))
        }
      }, 180000) // 3分钟超时，给GPU初始化更多时间

      this.once('ready', () => {
        clearTimeout(timeout)
        resolve(undefined)
      })
    })
  }

  private handleResponse(response: { success: boolean; error?: string; audio_data?: string; device?: string }): void {
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

    console.log(`🔄 Restarting GPU TTS (attempt ${this.restartAttempts}/${this.maxRestartAttempts}) in ${delay}ms...`)

    setTimeout(() => {
      this.startPythonProcess().catch(error => {
        console.error('❌ Failed to restart GPU TTS process:', error instanceof Error ? error.message : String(error))
        this.lastError = `Restart failed: ${error instanceof Error ? error.message : String(error)}`
        this.circuitBreaker.recordFailure()
      })
    }, delay)
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

  async generateAudio(text: string, speed: number = 1.0, _language: string = 'en-US'): Promise<GeneratedAudioResult> {
    // 检查电路断路器状态
    if (!this.circuitBreaker.canExecute()) {
      const state = this.circuitBreaker.getState()
      const nextAttempt = this.circuitBreaker.getNextAttemptTime()
      const waitTime = Math.max(0, nextAttempt - Date.now())

      throw new Error(`TTS service unavailable (circuit breaker ${state}). Next attempt in ${Math.ceil(waitTime / 1000)}s`)
    }

    if (!this.initialized || !this.process) {
      this.circuitBreaker.recordFailure()
      throw new Error('Kokoro GPU TTS service not initialized')
    }

    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty')
    }

    return new Promise((resolve, reject) => {
      const requestId = this.requestIdCounter++

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        console.error('⏰ GPU audio generation timeout')
        this.circuitBreaker.recordFailure()
        this.lastError = 'Audio generation timeout'
        reject(new Error('GPU audio generation timeout after 5 minutes'))
      }, 300000) // 5分钟超时

      this.pendingRequests.set(requestId, {
        resolve: (response: { success: boolean; audio_data?: string; device?: string; error?: string }) => {
          clearTimeout(timeout)

          if (response.success && response.audio_data) {
            try {
              const audioBuffer = Buffer.from(response.audio_data, 'hex')

              if (audioBuffer.length === 0) {
                const error = new Error('Audio buffer is empty after hex decoding')
                this.circuitBreaker.recordFailure()
                this.lastError = error.message
                reject(error)
                return
              }

              if (audioBuffer.length < 100) {
                console.warn(`⚠️ Audio buffer suspiciously small: ${audioBuffer.length} bytes`)
              }

              const timestamp = Date.now()
              const filename = `tts_audio_${timestamp}.wav`
              const filepath = path.join(process.cwd(), 'public', filename)

              fs.writeFileSync(filepath, audioBuffer)

              console.log(`💾 GPU Audio saved: ${filename} (${audioBuffer.length} bytes)`)
              console.log(`🔥 Generated using device: ${response.device || 'unknown'}`)

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
              console.error('❌ Failed to save GPU audio file:', error)
              this.circuitBreaker.recordFailure()
              const errorMessage = error instanceof Error ? error.message : String(error)
              this.lastError = `File save error: ${errorMessage}`
              reject(new Error(`Failed to save GPU audio file: ${errorMessage}`))
            }
          } else {
            const errorMsg = response.error || 'Failed to generate GPU audio'
            console.error('❌ GPU audio generation failed:', errorMsg)
            this.circuitBreaker.recordFailure()
            this.lastError = errorMsg
            reject(new Error(errorMsg))
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout)
          console.error('❌ GPU audio generation error:', error)
          this.circuitBreaker.recordFailure()
          this.lastError = error.message
          reject(error)
        }
      })

      const request = {
        text,
        speed,
        lang_code: 'en-us',
        voice: 'af'
      }

      const requestLine = JSON.stringify(request) + '\n'

      try {
        if (!this.process?.stdin || this.process.stdin.destroyed) {
          throw new Error('GPU Python process stdin is not available or destroyed')
        }

        this.process.stdin.write(requestLine)
        console.log(`📤 GPU TTS request sent: ${text.length} chars`)
      } catch (error) {
        console.error('❌ Failed to send GPU TTS request:', error)
        this.pendingRequests.delete(requestId)
        this.circuitBreaker.recordFailure()
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.lastError = `Send failure: ${errorMessage}`
        reject(new Error(`Failed to send request to GPU process: ${errorMessage}`))
      }
    })
  }
}

// 导出增强版服务
export const kokoroTTSGPU = new KokoroTTSGPUService()

// 优雅关闭处理
process.on('SIGINT', async () => {
  await kokoroTTSGPU.shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await kokoroTTSGPU.shutdown()
  process.exit(0)
})
