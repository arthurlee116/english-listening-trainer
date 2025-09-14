/**
 * 分块TTS服务 - 支持长文本分块处理和音频拼接
 */

import { kokoroTTSGPU } from './kokoro-service-gpu'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

interface ChunkedTTSOptions {
  maxChunkLength?: number  // 每个分块的最大字符数
  speed?: number
  language?: string
}

export class ChunkedTTSService {
  private maxChunkLength = 200  // 默认每块200字符，确保TTS质量
  
  constructor() {}

  /**
   * 将长文本分割成适合TTS处理的短句
   */
  private splitTextIntoChunks(text: string, maxLength: number = this.maxChunkLength): string[] {
    if (text.length <= maxLength) {
      return [text.trim()]
    }

    const chunks: string[] = []
    
    // 按句子分割（优先级：句号 > 感叹号 > 问号 > 分号 > 逗号）
    const sentences = text.split(/([.!?;,]\s+)/).filter(s => s.trim())
    
    let currentChunk = ''
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (!sentence) continue
      
      // 如果当前句子加上现有chunk超过限制
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          // 单个句子就超过限制，强制按词分割
          const words = sentence.split(/\s+/)
          let wordChunk = ''
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 > maxLength) {
              if (wordChunk.trim()) {
                chunks.push(wordChunk.trim())
                wordChunk = word
              } else {
                // 单个词就超过限制，直接添加
                chunks.push(word)
              }
            } else {
              wordChunk += (wordChunk ? ' ' : '') + word
            }
          }
          
          if (wordChunk.trim()) {
            currentChunk = wordChunk
          }
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks
  }

  /**
   * 使用ffmpeg拼接WAV音频文件
   */
  private async concatenateAudioFiles(audioFiles: string[]): Promise<string> {
    if (audioFiles.length === 1) {
      return audioFiles[0]
    }

    const timestamp = Date.now()
    const outputFilename = `tts_concatenated_${timestamp}.wav`
    const outputPath = path.join(process.cwd(), 'public', outputFilename)
    
    return new Promise((resolve, reject) => {
      // 创建临时文件列表
      const tempListFile = path.join(process.cwd(), 'public', `temp_list_${timestamp}.txt`)
      const fileList = audioFiles.map(file => {
        const fullPath = path.join(process.cwd(), 'public', file.replace(/^\//, ''))
        return `file '${fullPath}'`
      }).join('\n')
      
      fs.writeFileSync(tempListFile, fileList)
      
      // 使用ffmpeg拼接
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', tempListFile,
        '-c', 'copy',
        outputPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      ffmpeg.on('close', (code) => {
        // 清理临时文件
        try {
          fs.unlinkSync(tempListFile)
          // 清理原始分块音频文件
          audioFiles.forEach(file => {
            const fullPath = path.join(process.cwd(), 'public', file.replace(/^\//, ''))
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath)
            }
          })
        } catch (error) {
          console.warn('清理临时文件失败:', error)
        }
        
        if (code === 0) {
          console.log(`✅ 音频拼接成功: ${outputFilename}`)
          resolve(`/${outputFilename}`)
        } else {
          console.error('ffmpeg stderr:', stderr)
          reject(new Error(`音频拼接失败，ffmpeg退出码: ${code}`))
        }
      })
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`ffmpeg执行失败: ${error.message}`))
      })
    })
  }

  /**
   * 生成长文本音频（支持分块处理和拼接）
   */
  async generateLongTextAudio(text: string, options: ChunkedTTSOptions = {}): Promise<string> {
    const { maxChunkLength = this.maxChunkLength, speed = 1.0, language = 'en-US' } = options
    
    console.log(`🎤 开始长文本TTS处理，文本长度: ${text.length} 字符`)
    
    // 检查GPU服务是否就绪
    const isReady = await kokoroTTSGPU.isReady()
    if (!isReady) {
      throw new Error('GPU TTS服务未就绪')
    }
    
    // 分割文本
    const chunks = this.splitTextIntoChunks(text, maxChunkLength)
    console.log(`📝 文本分为 ${chunks.length} 个分块`)
    
    if (chunks.length === 1) {
      // 单个分块，直接生成
      console.log('📝 单个分块，直接生成音频')
      return await kokoroTTSGPU.generateAudio(chunks[0], speed, language)
    }
    
    // 多个分块，逐个生成音频
    const audioFiles: string[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`🎵 处理分块 ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}${chunk.length > 50 ? '...' : ''}"`)
      
      try {
        const audioUrl = await kokoroTTSGPU.generateAudio(chunk, speed, language)
        audioFiles.push(audioUrl)
        console.log(`✅ 分块 ${i + 1} 音频生成成功: ${audioUrl}`)
        
        // 添加短暂延迟避免GPU过载
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`❌ 分块 ${i + 1} 音频生成失败:`, error)
        throw new Error(`第 ${i + 1} 个分块音频生成失败: ${error}`)
      }
    }
    
    console.log(`🔗 开始拼接 ${audioFiles.length} 个音频文件`)
    
    try {
      const concatenatedAudio = await this.concatenateAudioFiles(audioFiles)
      console.log(`✅ 长文本音频生成完成: ${concatenatedAudio}`)
      return concatenatedAudio
    } catch (error) {
      console.error('❌ 音频拼接失败:', error)
      throw new Error(`音频拼接失败: ${error}`)
    }
  }
}

// 导出单例实例
export const chunkedTTSService = new ChunkedTTSService()