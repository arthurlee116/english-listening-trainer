import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const authResult = await requireAdmin(request)
    
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '需要管理员权限' },
        { status: 403 }
      )
    }

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