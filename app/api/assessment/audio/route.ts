import { NextRequest, NextResponse } from 'next/server'
import { ASSESSMENT_AUDIOS } from '@/lib/difficulty-service'

export async function GET(_request: NextRequest) {
  try {
    // 返回评估音频信息（不包含完整transcript，避免泄露答案）
    const audioInfo = ASSESSMENT_AUDIOS.map(audio => ({
      id: audio.id,
      filename: audio.filename,
      difficulty: audio.difficulty,
      weight: audio.weight,
      topic: audio.topic,
      description: audio.description,
      audioUrl: `/assessment-audio/${audio.filename}`
    }))

    return NextResponse.json({
      success: true,
      data: {
        audios: audioInfo,
        totalAudios: audioInfo.length,
        instruction: '请仔细聆听每段音频，根据您的理解程度对每段音频进行1-10分评分。评分越高表示您理解得越好。'
      }
    })

  } catch (error) {
    console.error('获取评估音频信息失败:', error)
    const message = error instanceof Error ? error.message : '服务器内部错误'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}