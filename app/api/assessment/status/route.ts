import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationCode = searchParams.get('code')

    if (!invitationCode) {
      return NextResponse.json(
        { error: '缺少邀请码参数' },
        { status: 400 }
      )
    }

    // 验证邀请码是否有效
    const isValidCode = dbOperations.verifyInvitationCode(invitationCode)
    if (!isValidCode) {
      return NextResponse.json(
        { error: '无效的邀请码' },
        { status: 401 }
      )
    }

    // 检查用户是否已完成难度评估
    const assessmentStatus = dbOperations.checkUserDifficultyAssessment(invitationCode)

    return NextResponse.json({
      success: true,
      data: {
        hasAssessment: assessmentStatus.hasAssessment,
        difficultyLevel: assessmentStatus.difficultyLevel,
        testDate: assessmentStatus.testDate
      }
    })

  } catch (error) {
    console.error('检查评估状态失败:', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}