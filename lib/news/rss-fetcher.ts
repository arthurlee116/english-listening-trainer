import 'server-only'
import Parser from 'rss-parser'
import { HttpsProxyAgent } from 'https-proxy-agent'
import type { Agent } from 'http'

function resolveRssProxyUrl(): string | undefined {
  const explicit = process.env.RSS_PROXY_URL?.trim()
  if (explicit) return explicit

  if (process.env.RSS_USE_SYSTEM_PROXY === 'true') {
    const systemProxy =
      process.env.HTTPS_PROXY?.trim() ||
      process.env.https_proxy?.trim() ||
      process.env.HTTP_PROXY?.trim() ||
      process.env.http_proxy?.trim()
    return systemProxy || undefined
  }

  return undefined
}

const proxyUrl = resolveRssProxyUrl()
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; EnglishListeningTrainer/1.0)'
  },
  ...(proxyUrl
    ? {
        requestOptions: {
          agent: new HttpsProxyAgent(proxyUrl) as unknown as Agent
        }
      }
    : {})
})

export type NewsCategory = 'general' | 'tech' | 'business' | 'science' | 'world'

export interface RSSSource {
  name: string
  url: string
  language?: 'en-US' | 'en-GB'
  category: NewsCategory
}

export interface FetchedArticle {
  source: string
  sourceUrl: string
  title: string
  summary: string
  publishedAt: Date
  category: NewsCategory
}

// 综合新闻RSS源（按类别分组）
export const RSS_SOURCES: RSSSource[] = [
  // General News
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', language: 'en-GB', category: 'general' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', language: 'en-US', category: 'general' },
  { name: 'VOA News', url: 'https://www.voanews.com/api/zqboml-vomx-tpeivmy', language: 'en-US', category: 'general' },
  
  // World News
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', language: 'en-US', category: 'world' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', language: 'en-GB', category: 'world' },
  { name: 'VOA Africa', url: 'https://www.voanews.com/api/z-botl-vomx-tpertmq', language: 'en-US', category: 'world' },
  
  // Tech News
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', language: 'en-US', category: 'tech' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', language: 'en-US', category: 'tech' },
  
  // Business News
  { name: 'BBC Business', url: 'http://feeds.bbci.co.uk/news/business/rss.xml', language: 'en-GB', category: 'business' },
  
  // Science News
  { name: 'BBC Science', url: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml', language: 'en-GB', category: 'science' },
]

// 类别显示名称
export const CATEGORY_LABELS: Record<NewsCategory, { en: string; zh: string }> = {
  general: { en: 'General', zh: '综合' },
  tech: { en: 'Technology', zh: '科技' },
  business: { en: 'Business', zh: '商业' },
  science: { en: 'Science', zh: '科学' },
  world: { en: 'World', zh: '国际' }
}

async function fetchSingleFeed(source: RSSSource): Promise<FetchedArticle[]> {
  try {
    const feed = await parser.parseURL(source.url)
    return (feed.items || []).slice(0, 15).map(item => ({
      source: source.name,
      sourceUrl: item.link || '',
      title: item.title || '',
      summary: item.contentSnippet || item.content || '',
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      category: source.category
    })).filter(a => a.title && a.sourceUrl)
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, error)
    return []
  }
}

export async function fetchAllNews(categories?: NewsCategory[]): Promise<FetchedArticle[]> {
  const sourcesToFetch = categories?.length
    ? RSS_SOURCES.filter(s => categories.includes(s.category))
    : RSS_SOURCES

  const results = await Promise.allSettled(
    sourcesToFetch.map(source => fetchSingleFeed(source))
  )
  
  const articles: FetchedArticle[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }
  
  // 按发布时间排序，最新的在前
  return articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}
