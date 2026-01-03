import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/database'

const prisma = getPrismaClient()

export async function GET(_request: NextRequest) {
  try {
    // 获取最近的练习会话
    const sessions = await prisma.practiceSession.findMany({
      select: {
        id: true,
        difficulty: true,
        language: true,
        topic: true,
        accuracy: true,
        score: true,
        duration: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 最近50条记录
    })

    return NextResponse.json({
      sessions: sessions
    })

  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}
