import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'
import { validateAssessmentScores, generateAssessmentSummary } from '@/lib/assessment-utils'
import { calculateDifficultyLevel, getDifficultyRange } from '@/lib/difficulty-service'

export async function POST(request: NextRequest) {
  try {
    const { invitationCode, scores } = await request.json()

    if (!invitationCode) {
      return NextResponse.json(
        { error: '缺少邀请码' },
        { status: 400 }
      )
    }

    // 验证邀请码是否有效
    const isValidCode = await databaseAdapter.verifyInvitationCode(invitationCode)
    if (!isValidCode) {
      return NextResponse.json(
        { error: '无效的邀请码' },
        { status: 401 }
      )
    }

    // 验证评分数据
    const validation = validateAssessmentScores(scores)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // 计算难度等级
    const difficultyLevel = calculateDifficultyLevel(scores)
    const difficultyRange = getDifficultyRange(difficultyLevel)

    // 生成评估摘要
    const summary = generateAssessmentSummary(scores, difficultyLevel)

    // 保存评估结果到数据库
    const saveSuccess = await databaseAdapter.saveDifficultyAssessment(
      invitationCode,
      scores,
      difficultyLevel
    )

    if (!saveSuccess) {
      return NextResponse.json(
        { error: '保存评估结果失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        difficultyLevel,
        difficultyRange: {
          min: difficultyRange.min,
          max: difficultyRange.max,
          name: difficultyRange.name,
          nameEn: difficultyRange.nameEn,
          description: difficultyRange.description
        },
        scores,
        summary: summary.summary,
        details: summary.details,
        recommendation: summary.recommendation
      }
    })

  } catch (error) {
    console.error('提交评估结果失败:', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}