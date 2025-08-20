import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const limitParam = searchParams.get('limit')
    
    if (!code) {
      return NextResponse.json({ 
        error: '缺少邀请码参数' 
      }, { status: 400 })
    }

    const invitationCode = code.trim().toUpperCase()
    const limit = limitParam ? parseInt(limitParam, 10) : 10
    
    // 验证邀请码是否存在
    const isValid = dbOperations.verifyInvitationCode(invitationCode)
    
    if (!isValid) {
      return NextResponse.json({ 
        error: '邀请码不存在' 
      }, { status: 404 })
    }

    // 获取练习历史记录
    const history = dbOperations.getExerciseHistory(invitationCode, limit)
    
    return NextResponse.json({ 
      success: true,
      history,
      count: history.length
    })

  } catch (error) {
    console.error('Exercise history fetch failed:', error)
    return NextResponse.json({ 
      error: '获取历史记录失败，请稍后重试' 
    }, { status: 500 })
  }
}