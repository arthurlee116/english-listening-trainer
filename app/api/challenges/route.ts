import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { getChallengeProgress } from '@/lib/analytics/challenge-progress'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    // 获取用户的挑战列表
    const challenges = await prisma.challenge.findMany({
      where: {
        userId: authResult.user.userId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // 为每个挑战计算进度统计
    const challengesWithStats = await Promise.all(
      challenges.map(async (challenge) => {
        const stats = await getChallengeProgress(challenge.id)
        return {
          ...challenge,
          stats
        }
      })
    )

    return NextResponse.json({
      challenges: challengesWithStats
    })

  } catch (error) {
    console.error('List challenges error:', error)
    return NextResponse.json(
      { error: '获取挑战列表失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    const { topic, minDifficulty, maxDifficulty, targetSessionCount, deadline } = await request.json()

    // 验证必填字段
    if (!topic || !minDifficulty || !maxDifficulty || !targetSessionCount) {
      return NextResponse.json(
        { error: '挑战参数不完整' },
        { status: 400 }
      )
    }

    // 验证难度级别
    const validDifficulties = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    if (!validDifficulties.includes(minDifficulty) || !validDifficulties.includes(maxDifficulty)) {
      return NextResponse.json(
        { error: '无效的难度级别' },
        { status: 400 }
      )
    }

    // 验证目标次数
    if (targetSessionCount < 1 || targetSessionCount > 100) {
      return NextResponse.json(
        { error: '目标练习次数应在1-100之间' },
        { status: 400 }
      )
    }

    // 如果提供了截止日期，验证格式
    let parsedDeadline: Date | undefined
    if (deadline) {
      parsedDeadline = new Date(deadline)
      if (isNaN(parsedDeadline.getTime())) {
        return NextResponse.json(
          { error: '无效的截止日期格式' },
          { status: 400 }
        )
      }
      // 可以添加逻辑来处理截止日期，比如存储在metadata中
    }

    // 使用事务创建挑战
    const challenge = await prisma.challenge.create({
      data: {
        userId: authResult.user.userId,
        topic,
        minDifficulty,
        maxDifficulty,
        targetSessionCount,
        completedSessionCount: 0,
        status: 'active',
        // 可以扩展schema来存储deadline等额外字段
      }
    })

    return NextResponse.json({
      message: '挑战创建成功',
      challenge: {
        id: challenge.id,
        topic: challenge.topic,
        minDifficulty: challenge.minDifficulty,
        maxDifficulty: challenge.maxDifficulty,
        targetSessionCount: challenge.targetSessionCount,
        status: challenge.status,
        createdAt: challenge.createdAt
      }
    })

  } catch (error) {
    console.error('Create challenge error:', error)
    return NextResponse.json(
      { error: '创建挑战失败，请稍后重试' },
      { status: 500 }
    )
  }
}
