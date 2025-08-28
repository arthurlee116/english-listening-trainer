import { NextRequest, NextResponse } from 'next/server'
import { kokoroTTS } from '@/lib/kokoro-service'
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

    console.log('🎤 开始本地Kokoro TTS生成...')
    console.log(`🌍 语言: ${language}`)
    console.log(`📝 文本长度: ${text.length} 字符`)
    console.log(`⚡ 语速: ${speed}x`)

    // 检查Kokoro服务是否就绪
    const isReady = await kokoroTTS.isReady()
    if (!isReady) {
      return NextResponse.json({ 
        error: '本地TTS服务未就绪，请稍后重试' 
      }, { status: 503 })
    }

    // 调用本地Kokoro服务生成音频
    const audioUrl = await kokoroTTS.generateAudio(text, speed, language)
    
    console.log('✅ 本地音频生成成功:', audioUrl)
    
    return NextResponse.json({ 
      success: true, 
      audioUrl: audioUrl,
      language: language,
      message: '本地音频生成成功',
      provider: 'kokoro-local',
      format: 'wav'
    })

  } catch (error) {
    console.error('❌ 本地TTS生成失败:', error)
    
    let errorMessage = '本地音频生成失败'
    let statusCode = 500
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // 根据错误类型设置状态码
      if (errorMessage.includes('timeout')) {
        statusCode = 504
        errorMessage = '音频生成超时，长文本需要更多时间，请稍后重试'
      } else if (errorMessage.includes('Audio generation timeout')) {
        statusCode = 504
        errorMessage = `音频生成超时：文本长度 ${text.length} 字符，预计需要 ${Math.ceil(text.length / 10)} 秒，请稍后重试`
      } else if (errorMessage.includes('not initialized') || errorMessage.includes('not ready')) {
        statusCode = 503
        errorMessage = 'TTS服务初始化中，请稍后重试'
      } else if (errorMessage.includes('Text cannot be empty')) {
        statusCode = 400
        errorMessage = '文本内容不能为空'
      } else if (errorMessage.includes('Failed to save audio file')) {
        statusCode = 500
        errorMessage = '音频文件保存失败'
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : '未知错误',
      provider: 'kokoro-local'
    }, { status: statusCode })
  }
}