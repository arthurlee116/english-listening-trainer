import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    const { exerciseData, difficulty, language, topic, accuracy, score, duration } = await request.json()

    // 验证必填字段
    if (!exerciseData || !difficulty || !topic) {
      return NextResponse.json(
        { error: '练习数据不完整' },
        { status: 400 }
      )
    }

    // 保存练习记录
    const practiceSession = await prisma.practiceSession.create({
      data: {
        userId: authResult.user.userId,
        exerciseData: JSON.stringify(exerciseData),
        difficulty,
        language: language || 'en-US',
        topic,
        accuracy: accuracy || null,
        score: score || null,
        duration: duration || null
      }
    })

    return NextResponse.json({
      message: '练习记录保存成功',
      session: {
        id: practiceSession.id,
        createdAt: practiceSession.createdAt
      }
    })

  } catch (error) {
    console.error('Save practice session error:', error)
    return NextResponse.json(
      { error: '保存失败，请稍后重试' },
      { status: 500 }
    )
  }
}