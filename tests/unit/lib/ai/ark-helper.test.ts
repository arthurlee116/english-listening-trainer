import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = {
  cerebrasApiKey: 'csk-test',
  baseUrl: 'https://api.cerebras.ai',
  timeout: 1000,
  maxRetries: 2,
  defaultModel: 'model-x',
  defaultTemperature: 0.2,
  defaultMaxTokens: 512,
  proxyUrl: 'http://proxy.internal',
  enableProxyHealthCheck: true
}

const getAIConfigMock = vi.fn(() => mockConfig)

vi.mock('@/lib/config-manager', () => ({
  configManager: {
    getAIConfig: getAIConfigMock
  }
}))

const emitTelemetryMock = vi.fn()

vi.mock('@/lib/ai/telemetry', () => ({
  emitAiTelemetry: emitTelemetryMock
}))

const proxyCreateMock = vi.fn<[], Promise<never>>().mockImplementation(async () => {
  throw new Error('proxy network failure')
})

const directCreateMock = vi.fn().mockResolvedValue({
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

const proxyClient = {
  chat: {
    completions: {
      create: proxyCreateMock
    }
  }
}

const directClient = {
  chat: {
    completions: {
      create: directCreateMock
    }
  }
}

const markProxyFailureMock = vi.fn()
const isProxyHealthyMock = vi.fn().mockResolvedValue(true)

const managerMock = {
  reset: vi.fn(),
  getClient: vi.fn((variant: 'proxy' | 'direct') =>
    variant === 'proxy' ? proxyClient : directClient
  ),
  isProxyHealthy: isProxyHealthyMock,
  markProxyFailure: markProxyFailureMock,
  getProxyStatus: vi.fn(() => ({
    proxyUrl: mockConfig.proxyUrl,
    healthy: true,
    lastCheckedAt: Date.now()
  }))
}

vi.mock('@/lib/ai/cerebras-client-manager', () => ({
  getCerebrasClientManager: () => managerMock
}))

import { callArkAPI } from '@/lib/ark-helper'

describe('callArkAPI retry behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    proxyCreateMock.mockClear()
    directCreateMock.mockClear()
    markProxyFailureMock.mockClear()
    isProxyHealthyMock.mockClear()
    emitTelemetryMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to direct client after proxy failure without repeating attempts', async () => {
    const promise = callArkAPI<{ ok: boolean }>({
      messages: [{ role: 'user', content: 'hello' }],
      schemaName: 'test_schema'
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(proxyCreateMock).toHaveBeenCalledTimes(1)
    expect(directCreateMock).toHaveBeenCalledTimes(1)
    expect(markProxyFailureMock).toHaveBeenCalledTimes(1)
    expect(isProxyHealthyMock).toHaveBeenCalledTimes(1)

    const telemetryCalls = emitTelemetryMock.mock.calls
    expect(telemetryCalls).toHaveLength(2)
    const finalEvent = telemetryCalls[1][0]
    expect(finalEvent.fallbackPath).toBe('proxy->direct')
    expect(finalEvent.success).toBe(true)
  })
})

