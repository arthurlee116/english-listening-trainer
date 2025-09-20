// Local Kokoro TTS Service - Client Side
// 本地Kokoro TTS服务客户端接口
//
// 修复说明：
// - 集成了新的音频格式检测工具，支持多种音频格式
// - 添加了音频文件清理机制，避免磁盘空间问题
// - 改进了错误处理和重试机制

import type { ListeningLanguage } from './types'

export interface TTSOptions {
  speed?: number  // 语速，默认1.0
  language?: ListeningLanguage  // 语言，默认'en-US'
}

export interface GeneratedAudio {
  audioUrl: string
  duration?: number
  byteLength?: number
  provider?: string
}

export async function generateAudio(text: string, options: TTSOptions = {}): Promise<GeneratedAudio> {
  if (!text || text.trim() === '') {
    throw new Error('文本内容不能为空')
  }

  // 显示文本长度信息（长文本将自动分块处理）
  if (text.length > 500) {
    console.log(`📝 长文本 (${text.length} 字符)，将自动分块处理`)
  }

  try {
    console.log('🎤 正在调用本地Kokoro TTS服务...')
    console.log(`📝 文本内容: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`)
    console.log(`📊 文本长度: ${text.length} 字符`)
    
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text, 
        speed: options.speed || 1.0,
        language: options.language || 'en-US'
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error(`❌ TTS API响应错误: ${response.status} ${response.statusText}`)
      console.error(`❌ 错误详情:`, data)
      throw new Error(data.error || `API请求失败: ${response.status}`)
    }

    if (!data.success) {
      console.error(`❌ TTS服务返回失败:`, data)
      throw new Error(data.error || '音频生成失败')
    }

    // 验证返回的音频URL
    if (!data.audioUrl) {
      console.error(`❌ TTS服务返回空的audioUrl:`, data)
      throw new Error('音频生成失败：未返回音频URL')
    }

    console.log(`✅ 本地音频生成成功: ${data.format} 格式`)
    console.log(`🔗 音频URL: ${data.audioUrl}`)
    
    return {
      audioUrl: data.audioUrl,
      duration: typeof data.duration === 'number' ? data.duration : undefined,
      byteLength: typeof data.byteLength === 'number' ? data.byteLength : undefined,
      provider: data.provider,
    }
    
  } catch (error) {
    console.error('❌ 本地TTS服务调用失败:', error)
    
    // 提供更详细的错误信息
    if (error instanceof Error) {
      if (error.message.includes('网络连接') || error.message.includes('fetch')) {
        throw new Error('本地TTS服务连接失败，请确保Python环境已正确配置')
      } else if (error.message.includes('未就绪') || error.message.includes('初始化中')) {
        throw new Error('本地TTS服务正在启动，请稍后重试')
      } else if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
        throw new Error('音频生成超时，文本较长需要更多时间，请稍后重试')
      } else if (error.message.includes('timeout')) {
        throw new Error('音频生成超时，请尝试缩短文本或稍后重试')
      } else {
        throw new Error(`本地音频生成失败: ${error.message}`)
      }
    } else {
      throw new Error('本地音频生成失败: 未知错误')
    }
  }
}
