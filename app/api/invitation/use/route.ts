import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    
    if (!code) {
      return NextResponse.json({ 
        error: '缺少邀请码' 
      }, { status: 400 })
    }

    const invitationCode = code.trim().toUpperCase()
    
    // 验证邀请码是否存在
    const isValid = await databaseAdapter.verifyInvitationCode(invitationCode)
    
    if (!isValid) {
      return NextResponse.json({ 
        error: '邀请码不存在' 
      }, { status: 404 })
    }

    // 检查今日使用次数
    const todayUsage = await databaseAdapter.getTodayUsageCount(invitationCode)
    
    if (todayUsage >= 5) {
      return NextResponse.json({ 
        error: '今日使用次数已达上限（5次）' 
      }, { status: 429 })
    }

    // 增加使用次数
    const success = await databaseAdapter.incrementUsageCount(invitationCode)
    
    if (!success) {
      return NextResponse.json({ 
        error: '使用次数更新失败' 
      }, { status: 500 })
    }

    const newUsage = await databaseAdapter.getTodayUsageCount(invitationCode)
    const remainingUsage = Math.max(0, 5 - newUsage)
    
    return NextResponse.json({ 
      success: true,
      todayUsage: newUsage,
      remainingUsage,
      message: `使用次数已记录，今日还可使用 ${remainingUsage} 次`
    })

  } catch (error) {
    console.error('Usage increment failed:', error)
    return NextResponse.json({ 
      error: '操作失败，请稍后重试' 
    }, { status: 500 })
  }
}