import { NextResponse } from 'next/server'
import { refreshNews, getLastRefreshTime, getNextRefreshTime } from '@/lib/news/scheduler'

export async function POST() {
  try {
    const result = await refreshNews()
    
    const [lastRefresh, nextRefresh] = await Promise.all([
      getLastRefreshTime(),
      getNextRefreshTime()
    ])

    return NextResponse.json({
      success: true,
      ...result,
      lastRefresh: lastRefresh?.toISOString(),
      nextRefresh: nextRefresh?.toISOString()
    })
  } catch (error) {
    console.error('Failed to refresh news:', error)
    return NextResponse.json(
      { error: 'Failed to refresh news', details: String(error) },
      { status: 500 }
    )
  }
}
