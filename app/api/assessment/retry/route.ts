import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { invitationCode } = await request.json()

    if (!invitationCode) {
      return NextResponse.json(
        { error: '缺少邀请码' },
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

    // 删除现有的难度评估记录（保留历史记录）
    const deleteSuccess = dbOperations.deleteDifficultyAssessment(invitationCode)

    if (!deleteSuccess) {
      return NextResponse.json(
        { error: '清除评估记录失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '评估记录已清除，可以重新开始测试'
    })

  } catch (error) {
    console.error('重新测试准备失败:', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}