import { NextRequest, NextResponse } from 'next/server'
import { kokoroTTS } from '@/lib/kokoro-service'
import { createTTSApiHandler } from '@/lib/performance-middleware'
import { ttsRequestLimiter, audioCache } from '@/lib/performance-optimizer'
import crypto from 'crypto'
import type { GeneratedAudioResult } from '@/lib/audio-utils'

// 生成音频缓存键
function generateCacheKey(text: string, speed: number = 1.0): string {
  const content = `${text}:${speed}`
  return crypto.createHash('md5').update(content).digest('hex')
}

// TTS请求处理器
async function ttsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { text, speed = 1.0 } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '文本内容不能为空' },
        { status: 400 }
      )
    }

    // 检查文本长度
    if (text.length > 2000) {
      return NextResponse.json(
        { error: '文本长度超过限制（最大2000字符）' },
        { status: 400 }
      )
    }

    // 生成缓存键
    const cacheKey = generateCacheKey(text, speed)
    
    // 检查缓存
    const cachedAudio = audioCache.get(cacheKey) as GeneratedAudioResult | undefined
    if (cachedAudio) {
      console.log(`🎯 TTS缓存命中: ${cacheKey}`)
      return NextResponse.json({
        success: true,
        audioUrl: cachedAudio.audioUrl,
        duration: cachedAudio.duration,
        byteLength: cachedAudio.byteLength,
        cached: true,
        message: 'Audio retrieved from cache'
      })
    }

    // 使用并发限制器执行TTS生成
    const audioResult = await ttsRequestLimiter.execute(async () => {
      console.log(`🎵 开始生成TTS音频，文本长度: ${text.length}`)
      
      // 确保TTS服务已准备好
      const isReady = await kokoroTTS.isReady()
      if (!isReady) {
        throw new Error('TTS服务未就绪，请稍后重试')
      }

      // 生成音频
      const audio = await kokoroTTS.generateAudio(text, speed)
      
      // 缓存音频URL
      audioCache.set(cacheKey, audio, 30 * 60 * 1000) // 30分钟TTL
      
      console.log(`✅ TTS音频生成完成: ${audio.audioUrl}`)
      return audio
    })

    return NextResponse.json({
      success: true,
      audioUrl: audioResult.audioUrl,
      duration: audioResult.duration,
      byteLength: audioResult.byteLength,
      cached: false,
      message: 'Audio generated successfully'
    })

  } catch (error) {
    console.error('TTS生成失败:', error)
    
    const errorMessage = error instanceof Error ? error.message : '音频生成失败'
    const isServiceError = errorMessage.includes('TTS服务') || errorMessage.includes('未就绪')
    
    return NextResponse.json(
      { 
        error: errorMessage,
        suggestion: isServiceError 
          ? '请检查TTS服务状态，或联系管理员' 
          : '请检查输入文本内容，或稍后重试'
      },
      { status: isServiceError ? 503 : 500 }
    )
  }
}

// 应用性能优化中间件
export const POST = createTTSApiHandler(ttsHandler)

// 健康检查端点
export async function GET() {
  try {
    const isReady = await kokoroTTS.isReady()
    
    return NextResponse.json({
      status: isReady ? 'ready' : 'initializing',
      message: isReady ? 'TTS service is ready' : 'TTS service is initializing',
      cacheStats: audioCache.getStats(),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
