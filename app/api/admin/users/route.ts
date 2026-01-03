import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/database'

const prisma = getPrismaClient()

export async function GET(_request: NextRequest) {
  try {
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
