import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { getChallengeProgress } from '@/lib/analytics/challenge-progress'
import { generateChallengeSummary } from '@/lib/ai/challenge-summary'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    const { challengeId } = params

    // 获取挑战详情，包括关联的会话
    const challenge = await prisma.challenge.findFirst({
      where: {
        id: challengeId,
        userId: authResult.user.userId // 确保用户只能访问自己的挑战
      },
      include: {
        challengeSessions: {
          include: {
            session: {
              select: {
                id: true,
                topic: true,
                difficulty: true,
                accuracy: true,
                createdAt: true,
                score: true,
                duration: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!challenge) {
      return NextResponse.json(
        { error: '挑战不存在或无访问权限' },
        { status: 404 }
      )
    }

    // 计算进度统计
    const progressStats = await getChallengeProgress(challengeId)

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        topic: challenge.topic,
        minDifficulty: challenge.minDifficulty,
        maxDifficulty: challenge.maxDifficulty,
        targetSessionCount: challenge.targetSessionCount,
        completedSessionCount: challenge.completedSessionCount,
        status: challenge.status,
        lastSummaryAt: challenge.lastSummaryAt,
        summaryText: challenge.summaryText,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      },
      stats: progressStats,
      sessions: challenge.challengeSessions.map(cs => ({
        id: cs.session.id,
        topic: cs.session.topic,
        difficulty: cs.session.difficulty,
        accuracy: cs.session.accuracy,
        score: cs.session.score,
        duration: cs.session.duration,
        createdAt: cs.session.createdAt,
        linkedAt: cs.createdAt
      }))
    })

  } catch (error) {
    console.error('Get challenge error:', error)
    return NextResponse.json(
      { error: '获取挑战详情失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    const { challengeId } = params
    const { action } = await request.json()

    if (action !== 'complete') {
      return NextResponse.json(
        { error: '无效的操作' },
        { status: 400 }
      )
    }

    // 检查挑战是否存在且属于当前用户
    const challenge = await prisma.challenge.findFirst({
      where: {
        id: challengeId,
        userId: authResult.user.userId
      },
      include: {
        challengeSessions: {
          include: {
            session: true
          }
        }
      }
    })

    if (!challenge) {
      return NextResponse.json(
        { error: '挑战不存在或无访问权限' },
        { status: 404 }
      )
    }

    if (challenge.status === 'completed') {
      return NextResponse.json(
        { error: '挑战已完成' },
        { status: 400 }
      )
    }

    // 生成挑战总结
    const summaryText = await generateChallengeSummary({
      challengeId,
      topic: challenge.topic,
      stats: await getChallengeProgress(challengeId),
      sessions: challenge.challengeSessions.map(cs => cs.session)
    })

    // 更新挑战状态和总结
    const updatedChallenge = await prisma.challenge.update({
      where: { id: challengeId },
      data: {
        status: 'completed',
        lastSummaryAt: new Date(),
        summaryText
      }
    })

    return NextResponse.json({
      message: '挑战已完成',
      challenge: {
        id: updatedChallenge.id,
        status: updatedChallenge.status,
        lastSummaryAt: updatedChallenge.lastSummaryAt,
        summaryText: updatedChallenge.summaryText
      }
    })

  } catch (error) {
    console.error('Complete challenge error:', error)
    return NextResponse.json(
      { error: '完成挑战失败，请稍后重试' },
      { status: 500 }
    )
  }
}
