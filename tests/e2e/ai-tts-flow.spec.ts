import { test, expect } from '@playwright/test'

const hasCerebrasKey = Boolean(process.env.CEREBRAS_API_KEY)
const hasTogetherKey = Boolean(process.env.TOGETHER_API_KEY)

test.describe('ai + tts flow', () => {
  test.skip(!hasCerebrasKey || !hasTogetherKey, 'Missing external service credentials')

  test('generates topics and speech audio', async ({ request }) => {
    const topicsResponse = await request.post('/api/ai/topics', {
      data: {
        difficulty: 'B1',
        wordCount: 80,
        language: 'en-US',
      }
    })

    expect(topicsResponse.ok()).toBe(true)
    const topicsPayload = await topicsResponse.json()
    expect(topicsPayload.success).toBe(true)
    expect(Array.isArray(topicsPayload.topics)).toBe(true)
    expect(topicsPayload.topics.length).toBeGreaterThan(0)

    const ttsResponse = await request.post('/api/tts', {
      data: {
        text: 'Hello, this is a short test sentence.',
        language: 'en-US',
        speed: 1.0,
      }
    })

    expect(ttsResponse.ok()).toBe(true)
    const ttsPayload = await ttsResponse.json()
    expect(ttsPayload.success).toBe(true)
    expect(typeof ttsPayload.audioUrl).toBe('string')

    const audioResponse = await request.get(ttsPayload.audioUrl)
    expect(audioResponse.ok()).toBe(true)
  })
})
