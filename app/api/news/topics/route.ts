import { NextRequest, NextResponse } from 'next/server'
import { getActiveTopics } from '@/lib/news/news-processor'
import { getLastRefreshTime, getNextRefreshTime, isCurrentlyRefreshing } from '@/lib/news/scheduler'
import { CATEGORY_LABELS } from '@/lib/news/rss-fetcher'
import '@/lib/news/init' // 触发自动初始化

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const difficulty = searchParams.get('difficulty') || undefined
  const category = searchParams.get('category') || undefined

  const topics = await getActiveTopics(difficulty, category)
  
  // 按难度分组
  const byDifficulty: Record<string, typeof topics> = {}
  for (const topic of topics) {
    if (!byDifficulty[topic.difficulty]) {
      byDifficulty[topic.difficulty] = []
    }
    byDifficulty[topic.difficulty].push(topic)
  }

  const [lastRefresh, nextRefresh, refreshing] = await Promise.all([
    getLastRefreshTime(),
    getNextRefreshTime(),
    isCurrentlyRefreshing()
  ])

  return NextResponse.json({
    topics: byDifficulty,
    totalCount: topics.length,
    categories: CATEGORY_LABELS,
    lastRefresh: lastRefresh?.toISOString() || null,
    nextRefresh: nextRefresh?.toISOString() || null,
    isRefreshing: refreshing
  })
}
