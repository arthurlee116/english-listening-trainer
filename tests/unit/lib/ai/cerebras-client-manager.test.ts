import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIServiceConfig } from '@/lib/config-manager'
import { getCerebrasClientManager } from '@/lib/ai/cerebras-client-manager'

const modelsListMock = vi.fn()
const cerebrasConstructor = vi.fn().mockImplementation(() => ({
  models: { list: modelsListMock },
  chat: {
    completions: {
      create: vi.fn()
    }
  }
}))

vi.mock('@cerebras/cerebras_cloud_sdk', () => ({
  default: cerebrasConstructor
}))

vi.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: vi.fn().mockImplementation(() => ({}))
}))

const baseConfig: AIServiceConfig = {
  cerebrasApiKey: 'csk-test',
  baseUrl: 'https://api.test',
  timeout: 5000,
  maxRetries: 3,
  defaultModel: 'model-a',
  defaultTemperature: 0.3,
  defaultMaxTokens: 1024,
  proxyUrl: null,
  enableProxyHealthCheck: true
}

describe('CerebrasClientManager', () => {
  beforeEach(() => {
    cerebrasConstructor.mockClear()
    modelsListMock.mockReset()
    getCerebrasClientManager().reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('recreates clients when configuration fingerprint changes', () => {
    const manager = getCerebrasClientManager()
    manager.getClient('direct', baseConfig)
    manager.getClient('direct', baseConfig)

    expect(cerebrasConstructor).toHaveBeenCalledTimes(1)

    const updatedConfig = {
      ...baseConfig,
      defaultModel: 'model-b'
    }

    manager.getClient('direct', updatedConfig)
    expect(cerebrasConstructor).toHaveBeenCalledTimes(2)
  })

  it('caches proxy health checks within debounce window', async () => {
    const manager = getCerebrasClientManager()
    const configWithProxy: AIServiceConfig = {
      ...baseConfig,
      proxyUrl: 'http://proxy.internal'
    }

    modelsListMock.mockResolvedValueOnce(undefined)

    const firstCheck = await manager.isProxyHealthy(configWithProxy)
    expect(firstCheck).toBe(true)
    expect(modelsListMock).toHaveBeenCalledTimes(1)

    const secondCheck = await manager.isProxyHealthy(configWithProxy)
    expect(secondCheck).toBe(true)
    expect(modelsListMock).toHaveBeenCalledTimes(1)

    manager.markProxyFailure(new Error('proxy offline'))
    const thirdCheck = await manager.isProxyHealthy(configWithProxy)
    expect(thirdCheck).toBe(false)
    expect(modelsListMock).toHaveBeenCalledTimes(1)
  })
})
