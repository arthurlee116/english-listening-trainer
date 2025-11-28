import { NextRequest, NextResponse } from 'next/server'
import { kokoroTTSGPU } from '@/lib/kokoro-service-gpu'
import { getLanguageConfig, isLanguageSupported } from '@/lib/language-config'
import { ttsRequestLimiter, audioCache } from '@/lib/performance-optimizer'
import crypto from 'crypto'
import type { GeneratedAudioResult } from '@/lib/audio-utils'

// 生成音频缓存键（包含语音与可选模型版本）
function generateCacheKey(text: string, speed: number, language: string, voice: string): string {
  const modelVersion = process.env.KOKORO_MODEL_VERSION || 'default'
  const content = `${text}:${speed}:${language}:${voice}:${modelVersion}`
  return crypto.createHash('md5').update(content).digest('hex')
}

export async function POST(request: NextRequest) {
  let text = ''
  try {
    const body = await request.json()
    text = body.text
    const speed = body.speed || 1.0
    const language = body.language || 'en-US'
    const effectiveSpeed = Number(speed)

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: '文本内容不能为空' }, { status: 400 })
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: '文本长度超过限制（最大2000字符）' },
        { status: 400 }
      )
    }

    if (!isLanguageSupported(language)) {
      return NextResponse.json({ error: `不支持的语言: ${language}` }, { status: 400 })
    }

    if (!Number.isFinite(effectiveSpeed) || effectiveSpeed <= 0.2 || effectiveSpeed > 3) {
      return NextResponse.json({ error: '语速超出范围（0.2 ~ 3.0）' }, { status: 400 })
    }

    const languageConfig = getLanguageConfig(language)
    const voice = languageConfig.voice

    // 生成缓存键并检查缓存
    const cacheKey = generateCacheKey(text, effectiveSpeed, language, voice)
    const cachedAudio = audioCache.get(cacheKey) as GeneratedAudioResult | undefined
    if (cachedAudio) {
      const filename = cachedAudio.audioUrl.replace('/', '')
      const apiAudioUrl = `/api/audio/${filename}`

      return NextResponse.json({
        success: true,
        audioUrl: apiAudioUrl,
        staticUrl: cachedAudio.audioUrl,
        duration: cachedAudio.duration,
        byteLength: cachedAudio.byteLength,
        cached: true,
        provider: 'kokoro-gpu',
        message: 'Audio retrieved from cache'
      })
    }

    // 使用并发限制器执行TTS生成
    const audioResult = await ttsRequestLimiter.execute(async () => {
      // 检查TTS服务是否就绪
      const isReady = await kokoroTTSGPU.isReady()
      if (!isReady) {
        throw new Error('TTS服务未就绪，请稍后重试')
      }

      // 生成音频
      return await kokoroTTSGPU.generateAudio(text, effectiveSpeed, language)
    })

    // 缓存音频结果
    audioCache.set(cacheKey, audioResult as unknown as Record<string, unknown>, 30 * 60 * 1000) // 30分钟TTL

    // 提取文件名并构建 API 路由 URL
    const filename = audioResult.audioUrl.replace('/', '')
    const apiAudioUrl = `/api/audio/${filename}`

    return NextResponse.json({
      success: true,
      audioUrl: apiAudioUrl,
      staticUrl: audioResult.audioUrl,
      duration: audioResult.duration,
      byteLength: audioResult.byteLength,
      cached: false,
      provider: 'kokoro-gpu',
      message: 'Audio generated successfully'
    })

  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '未知错误'
    const normalizedMessage = rawMessage.toLowerCase()

    let statusCode = 500
    let userFacingMessage = 'GPU音频生成失败'

    if (normalizedMessage.includes('queue is full')) {
      statusCode = 429
      userFacingMessage = 'TTS请求排队已满，请稍后重试'
    }

    if (normalizedMessage.includes('timeout')) {
      statusCode = 504
      userFacingMessage = 'GPU音频生成超时，长文本需要更多时间，请稍后重试'
    } else if (
      normalizedMessage.includes('not initialized') ||
      normalizedMessage.includes('not ready') ||
      normalizedMessage.includes('tts服务未就绪') ||
      normalizedMessage.includes('初始化中')
    ) {
      statusCode = 503
      userFacingMessage = 'GPU TTS服务初始化中，请稍后重试'
    } else if (normalizedMessage.includes('text cannot be empty')) {
      statusCode = 400
      userFacingMessage = '文本内容不能为空'
    } else if (normalizedMessage.includes('failed to save audio file')) {
      statusCode = 500
      userFacingMessage = '音频文件保存失败'
    } else if (normalizedMessage.includes('kokoro modules not available')) {
      statusCode = 503
      userFacingMessage = 'Kokoro模块不可用，请检查服务器配置'
    } else if (normalizedMessage.includes('cuda') || normalizedMessage.includes('gpu')) {
      statusCode = 503
      userFacingMessage = 'GPU加速服务异常，请检查CUDA配置'
    }

    return NextResponse.json({
      error: userFacingMessage,
      details: rawMessage,
      provider: 'kokoro-gpu'
    }, { status: statusCode })
  }
}

// 健康检查端点
export async function GET() {
  try {
    const isReady = await kokoroTTSGPU.isReady()

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
