import { NextRequest, NextResponse } from 'next/server'
import { getLanguageConfig, isLanguageSupported } from '@/lib/language-config'
import { cleanupOldAudioFiles, ttsRequestLimiter, audioCache } from '@/lib/performance-optimizer'
import crypto from 'crypto'
import { generateTogetherTtsAudio, isTogetherTtsError } from '@/lib/together-tts-service'

type CachedTtsAudio = {
  filename: string
  duration: number
  byteLength: number
  voiceUsed: string
  modelUsed: string
}

// 生成音频缓存键（不包含 speed：speed 仅用于前端 playbackRate）
function generateCacheKey(text: string, language: string, voice: string, model: string): string {
  const content = `${text}:${language}:${voice}:${model}`
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

    // 字符限制已移除，支持无限长度文本

    if (!isLanguageSupported(language)) {
      return NextResponse.json({ error: `不支持的语言: ${language}` }, { status: 400 })
    }

    if (!Number.isFinite(effectiveSpeed) || effectiveSpeed <= 0.2 || effectiveSpeed > 3) {
      return NextResponse.json({ error: '语速超出范围（0.2 ~ 3.0）' }, { status: 400 })
    }

    const languageConfig = getLanguageConfig(language)
    const voice = languageConfig.voice

    // 生成缓存键并检查缓存
    const model = process.env.TOGETHER_TTS_MODEL || 'hexgrad/Kokoro-82M'
    const cacheKey = generateCacheKey(text, language, voice, model)
    const cachedAudio = audioCache.get(cacheKey) as unknown as CachedTtsAudio | undefined
    if (cachedAudio) {
      const apiAudioUrl = `/api/audio/${cachedAudio.filename}`

      return NextResponse.json({
        success: true,
        audioUrl: apiAudioUrl,
        staticUrl: `/audio/${cachedAudio.filename}`,
        duration: cachedAudio.duration,
        byteLength: cachedAudio.byteLength,
        cached: true,
        provider: 'together-kokoro',
        message: 'Audio retrieved from cache'
      })
    }

    // 使用并发限制器执行TTS生成
    const audioResult = await ttsRequestLimiter.execute(async () => {
      const generated = await generateTogetherTtsAudio({
        text,
        voice,
        timeoutMs: 60_000,
      })
      return generated
    })

    // 缓存音频结果
    audioCache.set(
      cacheKey,
      {
        filename: audioResult.filename,
        duration: audioResult.duration,
        byteLength: audioResult.byteLength,
        voiceUsed: audioResult.voiceUsed,
        modelUsed: audioResult.modelUsed,
      } satisfies CachedTtsAudio as unknown as Record<string, unknown>,
      30 * 60 * 1000
    )

    // best-effort cleanup (24h) for public/audio
    void cleanupOldAudioFiles(24 * 60 * 60 * 1000)

    const apiAudioUrl = `/api/audio/${audioResult.filename}`

    return NextResponse.json({
      success: true,
      audioUrl: apiAudioUrl,
      staticUrl: `/audio/${audioResult.filename}`,
      duration: audioResult.duration,
      byteLength: audioResult.byteLength,
      cached: false,
      provider: 'together-kokoro',
      message: 'Audio generated successfully'
    })

  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '未知错误'
    const normalizedMessage = rawMessage.toLowerCase()

    let statusCode = 500
    let userFacingMessage = '音频生成失败'

    if (normalizedMessage.includes('queue is full')) {
      statusCode = 429
      userFacingMessage = 'TTS请求排队已满，请稍后重试'
    }

    if (normalizedMessage.includes('timeout')) {
      statusCode = 504
      userFacingMessage = '音频生成超时，长文本需要更多时间，请稍后重试'
    } else if (
      normalizedMessage.includes('tts服务未就绪') ||
      normalizedMessage.includes('初始化中')
    ) {
      statusCode = 503
      userFacingMessage = 'TTS服务初始化中，请稍后重试'
    } else if (normalizedMessage.includes('text cannot be empty')) {
      statusCode = 400
      userFacingMessage = '文本内容不能为空'
    } else if (normalizedMessage.includes('failed to save audio file')) {
      statusCode = 500
      userFacingMessage = '音频文件保存失败'
    } else if (normalizedMessage.includes('together') && normalizedMessage.includes('api_key')) {
      statusCode = 503
      userFacingMessage = 'TTS服务未配置（缺少 TOGETHER_API_KEY）'
    } else if (normalizedMessage.includes('content-type') || normalizedMessage.includes('not wav')) {
      statusCode = 503
      userFacingMessage = 'TTS服务返回了非WAV音频，请稍后重试'
    }

    return NextResponse.json({
      error: userFacingMessage,
      details: rawMessage,
      provider: 'together-kokoro',
      together: isTogetherTtsError(error) ? { status: error.status, requestId: error.requestId } : undefined
    }, { status: statusCode })
  }
}

// 健康检查端点
export async function GET() {
  try {
    return NextResponse.json({
      status: 'ready',
      message: 'TTS service is available (Together)',
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
