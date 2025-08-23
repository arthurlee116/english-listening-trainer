import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'
import { generateAssessmentReport, formatAssessmentHistory } from '@/lib/assessment-utils'

export async function GET(request: NextRequest) {
  try {
    // 这里应该添加管理员认证逻辑
    // 暂时简化处理，实际使用时需要验证管理员权限
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // 获取评估历史记录
    const assessmentHistory = dbOperations.getAssessmentHistory(limit)
    
    // 获取难度分布统计
    const difficultyDistribution = dbOperations.getDifficultyDistribution()
    
    // 生成报告数据
    const report = generateAssessmentReport(assessmentHistory)
    
    // 格式化历史记录用于显示
    const formattedHistory = formatAssessmentHistory(assessmentHistory)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAssessments: report.totalTests,
          averageDifficulty: report.averageDifficulty,
          difficultyDistribution,
          recentTrends: report.recentTrends
        },
        history: formattedHistory.slice(0, 20), // 限制返回最近20条记录
        totalHistoryCount: assessmentHistory.length
      }
    })

  } catch (error) {
    console.error('获取评估统计数据失败:', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    // 简单的密码验证（实际应用中应使用更安全的方式）
    if (password !== 'admin123') {
      return NextResponse.json(
        { error: '管理员密码错误' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '管理员身份验证成功'
    })

  } catch (error) {
    console.error('管理员身份验证失败:', error)
    return NextResponse.json(
      { error: '身份验证失败' },
      { status: 500 }
    )
  }
}