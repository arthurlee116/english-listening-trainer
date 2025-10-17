import { describe, expect, it, vi } from 'vitest'
import { RetryPolicy, executeWithCoverageRetry } from '@/lib/ai/retry-strategy'

describe('RetryPolicy', () => {
  it('computes exponential backoff with jitter', () => {
    const policy = new RetryPolicy({ baseDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0.5 })

    expect(policy.getDelay(1, () => 0)).toBe(100)
    expect(policy.getDelay(2, () => 0)).toBe(200)
    expect(policy.getDelay(3, () => 0)).toBe(400)
    expect(policy.getDelay(5, () => 0)).toBe(800)
    expect(policy.getDelay(6, () => 1)).toBeLessThanOrEqual(1000)
  })
})

describe('executeWithCoverageRetry', () => {
  it('returns the highest scoring result and stops when threshold met', async () => {
    const dataSequence = [
      { value: 'first' },
      { value: 'second' }
    ]
    const coverageSequence = [
      { coverage: 0.4 },
      { coverage: 0.75 }
    ]

    const generate = vi.fn(async () => dataSequence.shift() ?? null)
    const evaluate = vi.fn(() => coverageSequence.shift() ?? { coverage: 0 })
    const shouldRetry = vi.fn((evaluation: { coverage: number }) => ({
      retry: evaluation.coverage < 0.7
    }))
    const buildRetryPrompt = vi.fn((basePrompt: string) => `${basePrompt} retry`)

    const result = await executeWithCoverageRetry({
      basePrompt: 'prompt',
      maxAttempts: 3,
      generate,
      evaluate,
      shouldRetry,
      buildRetryPrompt,
      score: (evaluation) => evaluation.coverage
    })

    expect(result.best?.data).toEqual({ value: 'second' })
    expect(result.best?.evaluation.coverage).toBe(0.75)
    expect(result.attempts).toBe(2)
    expect(result.degradationReason).toBeUndefined()
    expect(generate).toHaveBeenCalledTimes(2)
    expect(buildRetryPrompt).toHaveBeenCalledTimes(1)
  })

  it('records degradation reason from shouldRetry callback', async () => {
    const generate = vi.fn(async () => ({ value: 'only' }))
    const evaluate = vi.fn(() => ({ coverage: 0.3 }))
    const shouldRetry = vi.fn(() => ({
      retry: false,
      degradationReason: 'insufficient coverage'
    }))
    const buildRetryPrompt = vi.fn((basePrompt: string) => `${basePrompt} retry`)

    const result = await executeWithCoverageRetry({
      basePrompt: 'prompt',
      maxAttempts: 1,
      generate,
      evaluate,
      shouldRetry,
      buildRetryPrompt,
      score: (evaluation) => evaluation.coverage
    })

    expect(result.best?.data).toEqual({ value: 'only' })
    expect(result.degradationReason).toBe('insufficient coverage')
  })
})
