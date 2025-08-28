import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationCode = searchParams.get('code')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const category = searchParams.get('category')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    if (!invitationCode) {
      return NextResponse.json({ error: '邀请码缺失' }, { status: 400 })
    }

    // 构建筛选条件
    const filters: any = { limit, offset }
    if (tags && tags.length > 0) {
      filters.tags = tags
    }
    if (category) {
      filters.category = category
    }

    const wrongAnswers = await databaseAdapter.getWrongAnswers(invitationCode, filters)
    const tagStats = await databaseAdapter.getUserTagStats(invitationCode)
    const allTags = await databaseAdapter.getAllErrorTags()

    return NextResponse.json({
      success: true,
      wrongAnswers,
      tagStats,
      allTags,
      total: wrongAnswers.length
    })

  } catch (error) {
    console.error('获取错题列表失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}