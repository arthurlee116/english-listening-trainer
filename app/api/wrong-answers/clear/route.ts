import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationCode = searchParams.get('code')

    if (!invitationCode) {
      return NextResponse.json({ error: '邀请码缺失' }, { status: 400 })
    }

    const success = dbOperations.clearUserWrongAnswers(invitationCode)

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: '成功清空所有错题记录' 
      })
    } else {
      return NextResponse.json({ 
        error: '清空错题记录失败' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('清空错题记录失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, invitationCode } = await request.json()

    if (!id || !invitationCode) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const success = dbOperations.deleteWrongAnswer(id, invitationCode)

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: '成功删除错题记录' 
      })
    } else {
      return NextResponse.json({ 
        error: '删除错题记录失败' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('删除错题记录失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}