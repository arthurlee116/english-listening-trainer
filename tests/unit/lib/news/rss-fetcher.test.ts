import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('rss-fetcher proxy configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    ;(globalThis as any).__rssParserOptions = undefined
    vi.doMock('server-only', () => ({}))
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('does not create a proxy agent by default', async () => {
    const HttpsProxyAgent = vi.fn()

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent }))
    vi.doMock('rss-parser', () => ({
      default: class ParserMock {
        constructor(options: unknown) {
          ;(globalThis as any).__rssParserOptions = options
        }
        // eslint-disable-next-line @typescript-eslint/require-await
        async parseURL() {
          return { items: [] }
        }
      }
    }))

    await import('@/lib/news/rss-fetcher')

    expect(HttpsProxyAgent).not.toHaveBeenCalled()
    expect((globalThis as any).__rssParserOptions?.requestOptions).toBeUndefined()
  })

  it('creates a proxy agent when RSS_PROXY_URL is set', async () => {
    process.env.RSS_PROXY_URL = 'http://127.0.0.1:10808'
    const agentInstance = { kind: 'proxy-agent' }
    const HttpsProxyAgent = vi.fn().mockImplementation(() => agentInstance)

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent }))
    vi.doMock('rss-parser', () => ({
      default: class ParserMock {
        constructor(options: unknown) {
          ;(globalThis as any).__rssParserOptions = options
        }
        // eslint-disable-next-line @typescript-eslint/require-await
        async parseURL() {
          return { items: [] }
        }
      }
    }))

    await import('@/lib/news/rss-fetcher')

    expect(HttpsProxyAgent).toHaveBeenCalledTimes(1)
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://127.0.0.1:10808')
    expect((globalThis as any).__rssParserOptions?.requestOptions?.agent).toBe(agentInstance)
  })

  it('uses system proxy variables when RSS_USE_SYSTEM_PROXY=true', async () => {
    process.env.RSS_USE_SYSTEM_PROXY = 'true'
    process.env.HTTPS_PROXY = 'http://corp-proxy.example:3128'
    const agentInstance = { kind: 'system-proxy-agent' }
    const HttpsProxyAgent = vi.fn().mockImplementation(() => agentInstance)

    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent }))
    vi.doMock('rss-parser', () => ({
      default: class ParserMock {
        constructor(options: unknown) {
          ;(globalThis as any).__rssParserOptions = options
        }
        // eslint-disable-next-line @typescript-eslint/require-await
        async parseURL() {
          return { items: [] }
        }
      }
    }))

    await import('@/lib/news/rss-fetcher')

    expect(HttpsProxyAgent).toHaveBeenCalledTimes(1)
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://corp-proxy.example:3128')
    expect((globalThis as any).__rssParserOptions?.requestOptions?.agent).toBe(agentInstance)
  })
})
