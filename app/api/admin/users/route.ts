import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth'

const prisma = getPrismaClient()

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '需要管理员权限' },
        { status: 401 }
      )
    }

    // 获取所有用户及其练习会话计数
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            practiceSessions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      users: users
    })

  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}
