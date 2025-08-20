import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.json({ 
        error: '缺少邀请码参数' 
      }, { status: 400 })
    }

    const invitationCode = code.trim().toUpperCase()
    
    // 验证邀请码是否存在
    const isValid = dbOperations.verifyInvitationCode(invitationCode)
    
    if (!isValid) {
      return NextResponse.json({ 
        error: '邀请码不存在' 
      }, { status: 404 })
    }

    // 获取今日使用次数
    const todayUsage = dbOperations.getTodayUsageCount(invitationCode)
    const remainingUsage = Math.max(0, 5 - todayUsage)
    
    return NextResponse.json({ 
      success: true,
      code: invitationCode,
      todayUsage,
      remainingUsage,
      canUse: remainingUsage > 0
    })

  } catch (error) {
    console.error('Invitation check failed:', error)
    return NextResponse.json({ 
      error: '检查失败，请稍后重试' 
    }, { status: 500 })
  }
}