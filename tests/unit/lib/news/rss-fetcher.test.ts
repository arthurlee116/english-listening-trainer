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
        parseURL() {
          return Promise.resolve({ items: [] })
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
        parseURL() {
          return Promise.resolve({ items: [] })
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
        parseURL() {
          return Promise.resolve({ items: [] })
        }
      }
    }))

    await import('@/lib/news/rss-fetcher')

    expect(HttpsProxyAgent).toHaveBeenCalledTimes(1)
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://corp-proxy.example:3128')
    expect((globalThis as any).__rssParserOptions?.requestOptions?.agent).toBe(agentInstance)
  })

  it('includes China Daily, MarketWatch and CNN RSS sources', async () => {
    vi.doMock('https-proxy-agent', () => ({ HttpsProxyAgent: vi.fn() }))
    vi.doMock('rss-parser', () => ({
      default: class ParserMock {
        constructor(_options: unknown) {}
        parseURL() {
          return Promise.resolve({ items: [] })
        }
      }
    }))

    const { RSS_SOURCES } = await import('@/lib/news/rss-fetcher')

    expect(RSS_SOURCES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'CNN (Top Stories)',
          url: 'http://rss.cnn.com/rss/edition.rss',
          category: 'general'
        }),
        expect.objectContaining({
          name: 'China Daily (China)',
          url: 'https://www.chinadaily.com.cn/rss/china_rss.xml',
          category: 'general'
        }),
        expect.objectContaining({
          name: 'MarketWatch (Top Stories)',
          url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
          category: 'general'
        }),
        expect.objectContaining({
          name: 'China Daily (World)',
          url: 'https://www.chinadaily.com.cn/rss/world_rss.xml',
          category: 'world'
        }),
        expect.objectContaining({
          name: 'CNN (World)',
          url: 'http://rss.cnn.com/rss/edition_world.rss',
          category: 'world'
        }),
        expect.objectContaining({
          name: 'CNN (Technology)',
          url: 'http://rss.cnn.com/rss/edition_technology.rss',
          category: 'tech'
        }),
        expect.objectContaining({
          name: 'CNN (Business)',
          url: 'http://rss.cnn.com/rss/edition_business.rss',
          category: 'business'
        }),
        expect.objectContaining({
          name: 'China Daily (BizChina)',
          url: 'https://www.chinadaily.com.cn/rss/bizchina_rss.xml',
          category: 'business'
        }),
        expect.objectContaining({
          name: 'MarketWatch (MarketPulse)',
          url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/',
          category: 'business'
        })
      ])
    )
  })
})
