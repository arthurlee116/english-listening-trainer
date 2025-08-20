import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'
import type { Exercise } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { exercise, invitationCode } = await request.json()
    
    if (!exercise || !invitationCode) {
      return NextResponse.json({ 
        error: '缺少必要参数' 
      }, { status: 400 })
    }

    // 验证练习数据格式
    if (!exercise.id || !exercise.difficulty || !exercise.topic || !exercise.transcript) {
      return NextResponse.json({ 
        error: '练习数据格式不正确' 
      }, { status: 400 })
    }

    const code = invitationCode.trim().toUpperCase()
    
    // 验证邀请码是否存在
    const isValid = dbOperations.verifyInvitationCode(code)
    
    if (!isValid) {
      return NextResponse.json({ 
        error: '邀请码不存在' 
      }, { status: 404 })
    }

    // 保存练习记录
    const success = dbOperations.saveExercise(exercise as Exercise, code)
    
    if (!success) {
      return NextResponse.json({ 
        error: '保存失败' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: '练习记录保存成功'
    })

  } catch (error) {
    console.error('Exercise save failed:', error)
    return NextResponse.json({ 
      error: '保存失败，请稍后重试' 
    }, { status: 500 })
  }
}