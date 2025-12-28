import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getPrismaClient } from '@/lib/database'

const prisma = getPrismaClient()

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

    // 获取系统统计数据
    const [
      totalUsers,
      totalSessions,
      activeUsers,
      accuracyData
    ] = await Promise.all([
      // 总用户数
      prisma.user.count(),
      
      // 总练习次数
      prisma.practiceSession.count(),
      
      // 活跃用户数（最近7天有练习的用户）
      prisma.user.count({
        where: {
          practiceSessions: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
              }
            }
          }
        }
      }),
      
      // 平均准确率计算
      prisma.practiceSession.aggregate({
        _avg: {
          accuracy: true
        },
        where: {
          accuracy: {
            not: null
          }
        }
      })
    ])

    const stats = {
      totalUsers,
      totalSessions,
      activeUsers,
      averageAccuracy: accuracyData._avg.accuracy || 0
    }

    return NextResponse.json({
      stats: stats
    })

  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}