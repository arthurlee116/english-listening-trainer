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

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRIES = 2
const BASE_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function generateAudio(text: string, options: TTSOptions = {}): Promise<GeneratedAudio> {
  if (!text || text.trim() === '') {
    throw new Error('文本内容不能为空')
  }

  let lastError: Error | null = null
  const isRetryableError = (error: unknown) =>
    error instanceof TypeError || (error instanceof Error && (error as Error & { retryable?: boolean }).retryable === true)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
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

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const errorMessage = data?.error || `API请求失败: ${response.status}`
        const retryable = RETRYABLE_STATUS_CODES.has(response.status)
        if (retryable && attempt < MAX_RETRIES) {
          lastError = new Error(errorMessage)
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 5000)
          await sleep(delay + Math.random() * 200)
          continue
        }
        const error = new Error(errorMessage)
        ;(error as Error & { retryable?: boolean }).retryable = retryable
        throw error
      }

      if (!data?.success) {
        throw new Error(data?.error || '音频生成失败')
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 5000)
        await sleep(delay + Math.random() * 200)
        continue
      }
      break
    }
  }

  throw lastError ?? new Error('音频生成失败')
}
