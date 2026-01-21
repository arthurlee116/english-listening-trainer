import 'server-only'
import { getPrismaClient } from '@/lib/database'
import { fetchAllNews, type NewsCategory } from './rss-fetcher'
import { processAndStoreNews, cleanupExpiredData } from './news-processor'
import { generateAllPendingTranscripts } from './transcript-generator'

const prisma = getPrismaClient()

const REFRESH_INTERVAL_HOURS = 6
const REFRESH_LOCK_TIMEOUT_MINUTES = 30
const REFRESH_STATE_ID = 'singleton'

interface RefreshResult {
  articlesProcessed: number
  topicsCreated: number
  transcriptsGenerated: number
  duration: number
}

async function getRefreshState() {
  const existing = await prisma.newsRefreshState.findUnique({
    where: { id: REFRESH_STATE_ID }
  })
  if (existing) {
    return existing
  }

  try {
    return await prisma.newsRefreshState.create({
      data: { id: REFRESH_STATE_ID, isRefreshing: false, lastRefreshAt: null }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('unique')) {
      const retry = await prisma.newsRefreshState.findUnique({
        where: { id: REFRESH_STATE_ID }
      })
      if (retry) {
        return retry
      }
    }
    throw error
  }
}

function isLockStale(updatedAt: Date) {
  const staleThreshold = Date.now() - REFRESH_LOCK_TIMEOUT_MINUTES * 60 * 1000
  return updatedAt.getTime() < staleThreshold
}

export async function shouldRefresh(): Promise<boolean> {
  const state = await getRefreshState()
  if (state.isRefreshing) {
    if (!isLockStale(state.updatedAt)) {
      return false
    }
    await prisma.newsRefreshState.update({
      where: { id: REFRESH_STATE_ID },
      data: { isRefreshing: false }
    })
  }

  if (!state.lastRefreshAt) {
    // 检查数据库中是否有活跃话题
    const activeCount = await prisma.dailyTopic.count({
      where: { expiresAt: { gt: new Date() } }
    })
    return activeCount === 0
  }

  const hoursSinceRefresh =
    (Date.now() - state.lastRefreshAt.getTime()) / (1000 * 60 * 60)
  return hoursSinceRefresh >= REFRESH_INTERVAL_HOURS
}

export async function refreshNews(categories?: NewsCategory[]): Promise<RefreshResult> {
  await getRefreshState()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - REFRESH_LOCK_TIMEOUT_MINUTES * 60 * 1000)
  const lockResult = await prisma.newsRefreshState.updateMany({
    where: {
      id: REFRESH_STATE_ID,
      OR: [{ isRefreshing: false }, { updatedAt: { lt: staleBefore } }]
    },
    data: { isRefreshing: true, updatedAt: now }
  })

  if (lockResult.count === 0) {
    return { articlesProcessed: 0, topicsCreated: 0, transcriptsGenerated: 0, duration: 0 }
  }

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
    
    await prisma.newsRefreshState.update({
      where: { id: REFRESH_STATE_ID },
      data: { lastRefreshAt: new Date() }
    })
    
    const duration = Date.now() - startTime
    console.log(`[News Scheduler] Refresh completed in ${duration}ms`)
    
    return {
      articlesProcessed: articles.length,
      topicsCreated,
      transcriptsGenerated,
      duration
    }
  } finally {
    await prisma.newsRefreshState.update({
      where: { id: REFRESH_STATE_ID },
      data: { isRefreshing: false }
    })
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

export async function getLastRefreshTime(): Promise<Date | null> {
  const state = await getRefreshState()
  return state.lastRefreshAt
}

export async function getNextRefreshTime(): Promise<Date | null> {
  const state = await getRefreshState()
  if (!state.lastRefreshAt) return null
  return new Date(state.lastRefreshAt.getTime() + REFRESH_INTERVAL_HOURS * 60 * 60 * 1000)
}

export async function isCurrentlyRefreshing(): Promise<boolean> {
  const state = await getRefreshState()
  if (state.isRefreshing && isLockStale(state.updatedAt)) {
    await prisma.newsRefreshState.update({
      where: { id: REFRESH_STATE_ID },
      data: { isRefreshing: false }
    })
    return false
  }
  return state.isRefreshing
}
