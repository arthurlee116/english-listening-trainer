import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

// 简单的管理员密码验证
const ADMIN_PASSWORD = 'admin123'

function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')
    
    // 验证管理员密码
    if (!verifyAdminPassword(password || '')) {
      return NextResponse.json({ 
        error: '管理员密码错误' 
      }, { status: 401 })
    }

    // 获取使用统计
    const exerciseStats = dbOperations.getUsageStats()
    const dailyStats = dbOperations.getDailyUsageStats()
    
    // 计算总体统计
    const totalInvitations = dbOperations.getAllInvitationCodes().length
    const totalExercises = exerciseStats.reduce((sum, stat) => sum + stat.total_exercises, 0)
    const activeToday = dailyStats.filter(stat => {
      const today = new Date().toISOString().split('T')[0]
      return stat.date === today && stat.usage_count > 0
    }).length

    return NextResponse.json({ 
      success: true,
      summary: {
        totalInvitations,
        totalExercises,
        activeToday,
        averageExercisesPerCode: totalInvitations > 0 ? (totalExercises / totalInvitations).toFixed(2) : 0
      },
      exerciseStats,
      dailyStats: dailyStats.slice(0, 20) // 只返回最近20条记录
    })

  } catch (error) {
    console.error('Admin get usage stats failed:', error)
    return NextResponse.json({ 
      error: '获取统计失败，请稍后重试' 
    }, { status: 500 })
  }
}