import { NextRequest, NextResponse } from 'next/server'
import { refreshNews, getLastRefreshTime, getNextRefreshTime } from '@/lib/news/scheduler'

export const maxDuration = 60

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return false
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshNews()
    const [lastRefresh, nextRefresh] = await Promise.all([
      getLastRefreshTime(),
      getNextRefreshTime(),
    ])

    return NextResponse.json({
      success: true,
      ...result,
      lastRefresh: lastRefresh?.toISOString(),
      nextRefresh: nextRefresh?.toISOString(),
    })
  } catch (error) {
    console.error('Failed to refresh news via cron:', error)
    return NextResponse.json(
      { error: 'Failed to refresh news', details: String(error) },
      { status: 500 }
    )
  }
}
