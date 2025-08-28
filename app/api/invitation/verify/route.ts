import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ 
        error: '邀请码不能为空' 
      }, { status: 400 })
    }

    // 转换为大写并验证格式
    const invitationCode = code.trim().toUpperCase()
    
    if (!/^[A-Z0-9]{6,8}$/.test(invitationCode)) {
      return NextResponse.json({ 
        error: '邀请码格式不正确，应为6-8位字母数字组合' 
      }, { status: 400 })
    }

    // 验证邀请码是否存在
    const isValid = await databaseAdapter.verifyInvitationCode(invitationCode)
    
    if (!isValid) {
      return NextResponse.json({ 
        error: '邀请码不存在或已过期' 
      }, { status: 404 })
    }

    // 检查今日使用次数
    const todayUsage = await databaseAdapter.getTodayUsageCount(invitationCode)
    
    return NextResponse.json({ 
      success: true,
      code: invitationCode,
      todayUsage,
      remainingUsage: Math.max(0, 5 - todayUsage),
      message: '邀请码验证成功'
    })

  } catch (error) {
    console.error('Invitation verification failed:', error)
    return NextResponse.json({ 
      error: '验证失败，请稍后重试' 
    }, { status: 500 })
  }
}