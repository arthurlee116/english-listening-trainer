import { describe, expect, it, vi } from 'vitest'
import { topicsSchema, type TopicsStructuredResponse } from '@/lib/ai/schemas'

const hasCerebrasKey = Boolean(process.env.CEREBRAS_API_KEY)
const hasTogetherKey = Boolean(process.env.TOGETHER_API_KEY)
const runRealServices = process.env.RUN_REAL_SERVICES === 'true'

const describeIf = runRealServices && hasCerebrasKey && hasTogetherKey ? describe : describe.skip

describeIf('real external services', () => {
  it('generates topics via Cerebras', async () => {
    vi.mock('server-only', () => ({}))
    const { invokeStructured } = await import('@/lib/ai/cerebras-service')
    const result = await invokeStructured<TopicsStructuredResponse>({
      messages: [{ role: 'user', content: 'Provide 3 short listening topics about travel.' }],
      schema: topicsSchema,
      schemaName: 'topics_response',
      options: {
        temperature: 0.3,
        maxTokens: 200,
      },
    })

    expect(Array.isArray(result.topics)).toBe(true)
    expect(result.topics.length).toBeGreaterThan(0)
  })

  it('runs Together TTS health probe', async () => {
    vi.mock('server-only', () => ({}))
    const { runTogetherTtsHealthProbe } = await import('@/lib/together-tts-service')
    const result = await runTogetherTtsHealthProbe({ timeoutMs: 15000 })
    expect(result.ok).toBe(true)
  })
})
