import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

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

    // 从 URL 查询参数获取分页信息
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // 查询用户的练习历史
    const [sessions, totalCount] = await Promise.all([
      prisma.practiceSession.findMany({
        where: { userId: authResult.user.userId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          difficulty: true,
          language: true,
          topic: true,
          accuracy: true,
          score: true,
          duration: true,
          createdAt: true,
          exerciseData: true
        }
      }),
      prisma.practiceSession.count({
        where: { userId: authResult.user.userId }
      })
    ])

    // 解析 exerciseData JSON
    const formattedSessions = sessions.map(session => ({
      ...session,
      exerciseData: JSON.parse(session.exerciseData)
    }))

    return NextResponse.json({
      sessions: formattedSessions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Get practice history error:', error)
    return NextResponse.json(
      { error: '获取练习历史失败，请稍后重试' },
      { status: 500 }
    )
  }
}