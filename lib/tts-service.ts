import type { ListeningLanguage } from './types'

export interface TTSOptions {
  speed?: number
  language?: ListeningLanguage
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
    throw new Error(data.error || `API请求失败: ${response.status}`)
  }

  if (!data.success) {
    throw new Error(data.error || '音频生成失败')
  }

  if (!data.audioUrl) {
    throw new Error('音频生成失败：未返回音频URL')
  }

  return {
    audioUrl: data.audioUrl,
    duration: typeof data.duration === 'number' ? data.duration : undefined,
    byteLength: typeof data.byteLength === 'number' ? data.byteLength : undefined,
    provider: data.provider,
  }
}
