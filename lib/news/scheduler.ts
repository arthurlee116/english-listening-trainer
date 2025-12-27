import 'server-only'
import { getPrismaClient } from '@/lib/database'
import { fetchAllNews, type NewsCategory } from './rss-fetcher'
import { processAndStoreNews, cleanupExpiredData } from './news-processor'
import { generateAllPendingTranscripts } from './transcript-generator'

const prisma = getPrismaClient()

const REFRESH_INTERVAL_HOURS = 6

interface RefreshResult {
  articlesProcessed: number
  topicsCreated: number
  transcriptsGenerated: number
  duration: number
}

// 存储上次刷新时间（内存中）
let lastRefreshTime: Date | null = null
let isRefreshing = false

export async function shouldRefresh(): Promise<boolean> {
  if (isRefreshing) return false
  
  if (!lastRefreshTime) {
    // 检查数据库中是否有活跃话题
    const activeCount = await prisma.dailyTopic.count({
      where: { expiresAt: { gt: new Date() } }
    })
    return activeCount === 0
  }
  
  const hoursSinceRefresh = (Date.now() - lastRefreshTime.getTime()) / (1000 * 60 * 60)
  return hoursSinceRefresh >= REFRESH_INTERVAL_HOURS
}

export async function refreshNews(categories?: NewsCategory[]): Promise<RefreshResult> {
  if (isRefreshing) {
    return { articlesProcessed: 0, topicsCreated: 0, transcriptsGenerated: 0, duration: 0 }
  }
  
  isRefreshing = true
  const startTime = Date.now()
  
  try {
    console.log('[News Scheduler] Starting news refresh...')
    
    // 1. 清理过期数据
    await cleanupExpiredData()
    console.log('[News Scheduler] Cleaned up expired data')
    
    // 2. 抓取新闻
    const articles = await fetchAllNews(categories)
    console.log(`[News Scheduler] Fetched ${articles.length} articles`)
    
    // 3. 处理并存储
    const topicsCreated = await processAndStoreNews(articles)
    console.log(`[News Scheduler] Created ${topicsCreated} topics`)
    
    // 4. 生成稿子
    const transcriptsGenerated = await generateAllPendingTranscripts()
    console.log(`[News Scheduler] Generated ${transcriptsGenerated} transcripts`)
    
    lastRefreshTime = new Date()
    
    const duration = Date.now() - startTime
    console.log(`[News Scheduler] Refresh completed in ${duration}ms`)
    
    return {
      articlesProcessed: articles.length,
      topicsCreated,
      transcriptsGenerated,
      duration
    }
  } finally {
    isRefreshing = false
  }
}

export async function initScheduler() {
  // 启动时检查是否需要刷新
  if (await shouldRefresh()) {
    console.log('[News Scheduler] Initial refresh needed, starting...')
    // 异步执行，不阻塞启动
    refreshNews().catch(err => console.error('[News Scheduler] Initial refresh failed:', err))
  } else {
    console.log('[News Scheduler] Data is fresh, skipping initial refresh')
  }
}

export function getLastRefreshTime(): Date | null {
  return lastRefreshTime
}

export function getNextRefreshTime(): Date | null {
  if (!lastRefreshTime) return null
  return new Date(lastRefreshTime.getTime() + REFRESH_INTERVAL_HOURS * 60 * 60 * 1000)
}

export function isCurrentlyRefreshing(): boolean {
  return isRefreshing
}
