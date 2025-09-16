import { NextRequest, NextResponse } from 'next/server'
import { chunkedTTSService } from '@/lib/chunked-tts-service'
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

    console.log('🎤 开始分块Kokoro TTS生成...')
    console.log(`🌍 语言: ${language}`)
    console.log(`📝 文本长度: ${text.length} 字符`)
    console.log(`⚡ 语速: ${speed}x`)

    // 检查Kokoro GPU服务是否就绪（通过分块服务内部检查）
    const isReady = await (await import('@/lib/kokoro-service-gpu')).kokoroTTSGPU.isReady()
    if (!isReady) {
      return NextResponse.json({ 
        error: 'GPU TTS服务未就绪，请稍后重试' 
      }, { status: 503 })
    }

    // 使用分块服务生成并拼接音频
    const audioUrl = await chunkedTTSService.generateLongTextAudio(text, {
      // 放宽单块长度，保证每块语义完整，但不过长
      maxChunkLength: 400,
      speed,
      language,
    })
    
    console.log('✅ GPU音频生成成功:', audioUrl)
    
    return NextResponse.json({ 
      success: true, 
      audioUrl: audioUrl,
      language: language,
      message: 'GPU加速音频生成成功',
      provider: 'kokoro-gpu-chunked',
      format: 'wav'
    })

  } catch (error) {
    console.error('❌ GPU TTS生成失败:', error)
    
    let errorMessage = 'GPU音频生成失败'
    let statusCode = 500
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // 根据错误类型设置状态码
      if (errorMessage.includes('timeout')) {
        statusCode = 504
        errorMessage = 'GPU音频生成超时，长文本需要更多时间，请稍后重试'
      } else if (errorMessage.includes('Audio generation timeout')) {
        statusCode = 504
        errorMessage = `GPU音频生成超时：文本长度 ${text.length} 字符，预计需要 ${Math.ceil(text.length / 10)} 秒，请稍后重试`
      } else if (errorMessage.includes('not initialized') || errorMessage.includes('not ready')) {
        statusCode = 503
        errorMessage = 'GPU TTS服务初始化中，请稍后重试'
      } else if (errorMessage.includes('Text cannot be empty')) {
        statusCode = 400
        errorMessage = '文本内容不能为空'
      } else if (errorMessage.includes('Failed to save audio file')) {
        statusCode = 500
        errorMessage = '音频文件保存失败'
      } else if (errorMessage.includes('Kokoro modules not available')) {
        statusCode = 503
        errorMessage = 'Kokoro模块不可用，请检查服务器配置'
      } else if (errorMessage.includes('CUDA') || errorMessage.includes('GPU')) {
        statusCode = 503
        errorMessage = 'GPU加速服务异常，请检查CUDA配置'
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : '未知错误',
      provider: 'kokoro-gpu-chunked'
    }, { status: statusCode })
  }
}
