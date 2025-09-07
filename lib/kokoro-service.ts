import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { getLanguageConfig } from './language-config'
import { validateDeviceConfig, generateDeviceReport } from './device-detection'
import type { ListeningLanguage } from './types'

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
  private maxRestartAttempts = 3

  constructor() {
    super()
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
      const pythonPath = path.join(process.cwd(), 'kokoro-local', 'kokoro_wrapper_real.py')
      
      if (!fs.existsSync(pythonPath)) {
        reject(new Error(`Kokoro wrapper not found at ${pythonPath}`))
        return
      }

      console.log('🚀 Starting Kokoro Python process...')
      
      // 设置环境变量以支持多种加速方式
      const kokoroDevice = process.env.KOKORO_DEVICE || 'auto'
      const env = {
        ...process.env,
        PYTORCH_ENABLE_MPS_FALLBACK: '1',
        KOKORO_DEVICE: kokoroDevice, // 传递设备选择给Python
        PYTHONPATH: path.join(process.cwd(), 'kokoro-main-ref') + ':' + (process.env.PYTHONPATH || ''),
        // 添加CUDA路径支持
        PATH: `/usr/local/cuda-12.2/bin:${(process.env.PATH || '')}`,
        LD_LIBRARY_PATH: `/usr/local/cuda-12.2/lib64:${(process.env.LD_LIBRARY_PATH || '')}`
      }
      
      console.log(`📱 Kokoro device preference: ${kokoroDevice}`)
      console.log(`🔧 CUDA PATH: ${env.PATH}`)
      console.log(`🔧 CUDA LD_LIBRARY_PATH: ${env.LD_LIBRARY_PATH}`)

      const venvPythonPath = path.join(process.cwd(), 'kokoro-local', 'venv', 'bin', 'python3')
      const venvPath = path.join(process.cwd(), 'kokoro-local', 'venv')
      
      // 设置虚拟环境的环境变量
      const venvEnv = {
        ...env,
        VIRTUAL_ENV: venvPath,
        PATH: `${venvPath}/bin:${(env as Record<string, string | undefined>).PATH || process.env.PATH || ''}`,
        PYTHONPATH: path.join(process.cwd(), 'kokoro-main-ref') + ':' + path.join(venvPath, 'lib', 'python3.10', 'site-packages') + ':' + (process.env.PYTHONPATH || '')
      }
      
      // 启动Python进程
      
      this.process = spawn(venvPythonPath, [pythonPath], {
        cwd: path.join(process.cwd(), 'kokoro-local'),
        env: venvEnv,
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

    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++
      console.log(`🔄 Restarting Kokoro process (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`)
      
      setTimeout(() => {
        this.initialize().catch(error => {
          console.error('Failed to restart Kokoro process:', error)
        })
      }, 5000) // 5秒后重试
    } else {
      console.error('❌ Max restart attempts reached. Kokoro service unavailable.')
      this.emit('error', new Error('Kokoro service unavailable after max restart attempts'))
    }
  }

  async generateAudio(text: string, speed: number = 1.0, language: ListeningLanguage = 'en-US'): Promise<string> {
    if (!this.initialized || !this.process) {
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
              
              resolve(`/${filename}`)
            } catch (error) {
              reject(new Error(`Failed to save audio file: ${error}`))
            }
          } else {
            reject(new Error(response.error || 'Failed to generate audio'))
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout)
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
    if (this.initialized && this.process) {
      return true
    }
    
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.initialized) {
          resolve(true)
        } else {
          setTimeout(checkReady, 1000)
        }
      }
      checkReady()
    })
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