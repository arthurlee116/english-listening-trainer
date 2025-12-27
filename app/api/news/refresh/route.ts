import { NextResponse } from 'next/server'
import { refreshNews, getLastRefreshTime, getNextRefreshTime } from '@/lib/news/scheduler'

export async function POST() {
  try {
    const result = await refreshNews()
    
    return NextResponse.json({
      success: true,
      ...result,
      lastRefresh: getLastRefreshTime()?.toISOString(),
      nextRefresh: getNextRefreshTime()?.toISOString()
    })
  } catch (error) {
    console.error('Failed to refresh news:', error)
    return NextResponse.json(
      { error: 'Failed to refresh news', details: String(error) },
      { status: 500 }
    )
  }
}
