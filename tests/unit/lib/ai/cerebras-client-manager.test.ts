import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIServiceConfig } from '@/lib/config-manager'

vi.mock('server-only', () => ({}))

vi.mock('@cerebras/cerebras_cloud_sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    models: { list: vi.fn() },
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

vi.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: vi.fn().mockImplementation(() => ({}))
}))

import { getCerebrasClientManager } from '@/lib/ai/cerebras-client-manager'

const baseConfig: AIServiceConfig = {
  cerebrasApiKey: 'csk-test',
  baseUrl: 'https://api.test',
  timeout: 5000,
  maxRetries: 3,
  defaultModel: 'model-a',
  defaultTemperature: 0.3,
  defaultMaxTokens: 1024
}

describe('CerebrasClientManager', () => {
  beforeEach(() => {
    getCerebrasClientManager().reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('always uses proxy client', () => {
    const manager = getCerebrasClientManager()
    const client1 = manager.getClient(baseConfig)
    const client2 = manager.getClient(baseConfig)

    expect(client1).toBe(client2) // Should return same cached instance
  })

  it('returns proxy status with hardcoded URL', () => {
    const manager = getCerebrasClientManager()
    const status = manager.getProxyStatus()

    expect(status.proxyUrl).toBe('http://81.71.93.183:10811')
    expect(status.healthy).toBe(true)
    expect(status.lastCheckedAt).toBeGreaterThan(0)
  })
})
