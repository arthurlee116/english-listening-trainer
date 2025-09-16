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
  private maxChunkLength = 400  // 默认每块400字符，更长但仍安全
  
  constructor() {}

  /**
   * 将长文本分割成适合TTS处理的短句
   */
  private splitTextIntoChunks(text: string, maxLength: number = this.maxChunkLength): string[] {
    if (text.length <= maxLength) {
      return [text.trim()]
    }

    const chunks: string[] = []
    
    // 按句子分割（优先级：句号 > 感叹号 > 问号）；保留标点作为句子的一部分
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    let currentChunk = ''
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (!sentence) continue
      
      // 如果当前句子加上现有chunk超过限制
      if (currentChunk.length + (currentChunk ? 1 : 0) + sentence.length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          // 单个句子就超过限制，强制按词分割
          const words = sentence.split(/\s+/)
          let wordChunk = ''
          
          for (const word of words) {
            if (wordChunk.length + (wordChunk ? 1 : 0) + word.length > maxLength) {
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
        // 统一采样率、声道，避免不同块参数不一致导致拼接异常
        '-ar', '24000',
        '-ac', '1',
        '-c', 'pcm_s16le',
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
    
    // 多个分块，并发生成音频（保持有序拼接）
    const concurrency = Math.min(3, Math.max(1, parseInt(process.env.TTS_CHUNK_CONCURRENCY || '2', 10)))
    type Job = { index: number; text: string }
    const queue: Job[] = chunks.map((c, i) => ({ index: i, text: c }))
    const results: (string | null)[] = Array(chunks.length).fill(null)
    let failed: Error | null = null

    const worker = async (id: number) => {
      while (queue.length && !failed) {
        const job = queue.shift()!
        console.log(`🎵[W${id}] 处理分块 ${job.index + 1}/${chunks.length}: "${job.text.substring(0, 50)}${job.text.length > 50 ? '...' : ''}"`)
        try {
          const audioUrl = await kokoroTTSGPU.generateAudio(job.text, speed, language)
          results[job.index] = audioUrl
          console.log(`✅[W${id}] 分块 ${job.index + 1} 成功: ${audioUrl}`)
        } catch (error) {
          console.error(`❌[W${id}] 分块 ${job.index + 1} 失败:`, error)
          failed = new Error(`第 ${job.index + 1} 个分块音频生成失败: ${error}`)
        }
      }
    }

    const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1))
    await Promise.all(workers)
    if (failed) throw failed

    const audioFiles: string[] = results as string[]

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
