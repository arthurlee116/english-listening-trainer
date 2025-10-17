import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/config-manager', () => ({
  configManager: {
    getAIConfig: vi.fn(() => ({
      cerebrasApiKey: 'csk-test',
      baseUrl: 'https://api.cerebras.ai',
      timeout: 1000,
      maxRetries: 2,
      defaultModel: 'model-x',
      defaultTemperature: 0.2,
      defaultMaxTokens: 512
    }))
  }
}))

vi.mock('@/lib/ai/telemetry', () => ({
  emitAiTelemetry: vi.fn()
}))

const createMock = vi.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: '{"ok":true}'
      }
    }
  ],
  usage: {
    total_tokens: 10
  }
})

const client = {
  chat: {
    completions: {
      create: createMock
    }
  }
}

vi.mock('@/lib/ai/cerebras-client-manager', () => ({
  getCerebrasClientManager: () => ({
    reset: vi.fn(),
    getClient: vi.fn(() => client),
    getProxyStatus: vi.fn(() => ({
      proxyUrl: 'http://81.71.93.183:10811',
      healthy: true,
      lastCheckedAt: Date.now()
    }))
  })
}))

import { callArkAPI } from '@/lib/ark-helper'

describe('callArkAPI retry behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    createMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('successfully calls Cerebras API through proxy', async () => {
    const promise = callArkAPI<{ ok: boolean }>({
      messages: [{ role: 'user', content: 'hello' }],
      schemaName: 'test_schema'
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

