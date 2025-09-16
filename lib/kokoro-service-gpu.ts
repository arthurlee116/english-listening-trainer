import { EventEmitter } from 'events'

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * 增强版Kokoro TTS服务，专为GPU服务器优化
 * 支持CUDA加速和真实Kokoro模型
 */
export class KokoroTTSGPUService extends EventEmitter {  // extend EventEmitter directly
  private process: ChildProcess | null = null
  private initialized = false
  private pendingRequests: Map<number, { resolve: (response: { success: boolean; audio_data?: string; device?: string; error?: string }) => void; reject: (error: Error) => void }> = new Map()
  private requestIdCounter = 0

  constructor() {
    super()
    console.log('🚀 Initializing Kokoro GPU TTS Service...')
    this.startPythonProcess().catch(error => console.error('Init failed:', error))
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
    console.log('🔄 Kokoro GPU process will restart automatically...')
    
    setTimeout(() => {
      this.startPythonProcess().catch(error => {
        console.error('Failed to restart Kokoro GPU process:', error)
      })
    }, 5000)
  }

  async generateAudio(text: string, speed: number = 1.0, _language: string = 'en-US'): Promise<string> {
    if (!this.initialized || !this.process) {
      throw new Error('Kokoro GPU TTS service not initialized')
    }

    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty')
    }

    return new Promise((resolve, reject) => {
      const requestId = this.requestIdCounter++
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('GPU audio generation timeout'))
      }, 300000) // 5分钟超时

      this.pendingRequests.set(requestId, {
        resolve: (response: { success: boolean; audio_data?: string; device?: string; error?: string }) => {
          clearTimeout(timeout)
          
          if (response.success && response.audio_data) {
            try {
              const audioBuffer = Buffer.from(response.audio_data, 'hex')
              
              if (audioBuffer.length === 0) {
                reject(new Error('Audio buffer is empty after hex decoding'))
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
              
              resolve(`/${filename}`)
            } catch (error) {
              reject(new Error(`Failed to save GPU audio file: ${error instanceof Error ? error.message : String(error)}`))
            }
          } else {
            reject(new Error(response.error || 'Failed to generate GPU audio'))
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout)
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
          throw new Error('GPU Python process stdin is not available')
        }
        
        this.process.stdin.write(requestLine)
      } catch (error) {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Failed to send request to GPU process: ${error instanceof Error ? error.message : String(error)}`))
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