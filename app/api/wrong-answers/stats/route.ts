import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationCode = searchParams.get('code')

    if (!invitationCode) {
      return NextResponse.json({ error: '邀请码缺失' }, { status: 400 })
    }

    const tagStats = dbOperations.getUserTagStats(invitationCode)
    const userWeakness = dbOperations.getUserWeakness(invitationCode, 10)
    const allTags = dbOperations.getAllErrorTags()

    // 按类别分组标签统计
    const statsByCategory = tagStats.reduce((acc, stat) => {
      if (!acc[stat.category]) {
        acc[stat.category] = []
      }
      acc[stat.category].push(stat)
      return acc
    }, {} as Record<string, any[]>)

    // 计算总体统计
    const totalErrors = tagStats.reduce((sum, stat) => sum + stat.count, 0)
    const mostCommonError = tagStats.length > 0 ? tagStats[0] : null
    const categoryCounts = Object.keys(statsByCategory).map(category => ({
      category,
      count: statsByCategory[category].reduce((sum, stat) => sum + stat.count, 0),
      tags: statsByCategory[category].length
    }))

    return NextResponse.json({
      success: true,
      data: {
        tagStats,
        userWeakness,
        statsByCategory,
        allTags,
        summary: {
          totalErrors,
          mostCommonError,
          categoryCounts,
          totalTags: tagStats.length
        }
      }
    })

  } catch (error) {
    console.error('获取错题统计失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}