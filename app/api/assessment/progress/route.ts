import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth'
import { getAssessmentProgress, markAssessmentCompleted } from '@/lib/db/assessment-progress'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error ?? '未登录' },
        { status: 401 }
      )
    }

    const progress = await getAssessmentProgress(authResult.user.userId)

    return NextResponse.json({
      assessmentCompletedAt: progress.assessmentCompletedAt
        ? progress.assessmentCompletedAt.toISOString()
        : null,
    })
  } catch (error) {
    console.error('Failed to load assessment progress:', error)
    return NextResponse.json(
      { error: '获取评估状态失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error ?? '未登录' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({})) as {
      assessmentCompletedAt?: string
    }

    const completedAt = body.assessmentCompletedAt
      ? new Date(body.assessmentCompletedAt)
      : new Date()

    if (Number.isNaN(completedAt.getTime())) {
      return NextResponse.json(
        { error: '无效的评估完成时间' },
        { status: 400 }
      )
    }

    const progress = await markAssessmentCompleted(authResult.user.userId, completedAt)

    return NextResponse.json({
      assessmentCompletedAt: progress.assessmentCompletedAt
        ? progress.assessmentCompletedAt.toISOString()
        : null,
    })
  } catch (error) {
    console.error('Failed to update assessment progress:', error)
    return NextResponse.json(
      { error: '更新评估状态失败，请稍后重试' },
      { status: 500 }
    )
  }
}
