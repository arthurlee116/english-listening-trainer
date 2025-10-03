import { NextRequest, NextResponse } from 'next/server'
import { kokoroTTSGPU } from '@/lib/kokoro-service-gpu'
import { isLanguageSupported } from '@/lib/language-config'

export async function POST(request: NextRequest) {
  let text = ''
  try {
    const body = await request.json()
    text = body.text
    const speed = body.speed || 1.0
    const language = body.language || 'en-US'
    
    if (!text) {
      return NextResponse.json({ error: '文本内容不能为空' }, { status: 400 })
    }
    
    if (!isLanguageSupported(language)) {
      return NextResponse.json({ error: `不支持的语言: ${language}` }, { status: 400 })
    }

    console.log('🎤 开始GPU加速Kokoro TTS生成...')
    console.log(`🌍 语言: ${language}`)
    console.log(`📝 文本长度: ${text.length} 字符`)
    console.log(`⚡ 语速: ${speed}x`)

    // 检查Kokoro GPU服务是否就绪
    const isReady = await kokoroTTSGPU.isReady()
    if (!isReady) {
      return NextResponse.json({ 
        error: 'GPU TTS服务未就绪，请稍后重试' 
      }, { status: 503 })
    }

    // 调用GPU加速的Kokoro服务生成音频
    const audioResult = await kokoroTTSGPU.generateAudio(text, speed, language)
    
    console.log('✅ GPU音频生成成功:', audioResult.audioUrl)
    
    // 提取文件名并构建 API 路由 URL
    const filename = audioResult.audioUrl.replace('/', '')
    const apiAudioUrl = `/api/audio/${filename}`
    
    console.log('📡 音频 API URL:', apiAudioUrl)
    
    return NextResponse.json({ 
      success: true, 
      audioUrl: apiAudioUrl, // 使用 API 路由而不是直接的静态文件路径
      staticUrl: audioResult.audioUrl, // 保留原始 URL 作为备用
      duration: audioResult.duration,
      byteLength: audioResult.byteLength,
      language: language,
      message: 'GPU加速音频生成成功',
      provider: 'kokoro-gpu',
      format: 'wav'
    })

  } catch (error) {
    console.error('❌ GPU TTS生成失败:', error)

    const rawMessage = error instanceof Error ? error.message : '未知错误'
    const normalizedMessage = rawMessage.toLowerCase()

    let statusCode = 500
    let userFacingMessage = 'GPU音频生成失败'

    if (normalizedMessage.includes('timeout')) {
      statusCode = 504
      userFacingMessage = 'GPU音频生成超时，长文本需要更多时间，请稍后重试'
    } else if (normalizedMessage.includes('not initialized') || normalizedMessage.includes('not ready')) {
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
