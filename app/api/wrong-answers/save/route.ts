import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { exercise, invitationCode } = await request.json()

    if (!exercise || !invitationCode) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const wrongAnswers: any[] = []

    // 遍历练习结果，找出错题
    exercise.results.forEach((result: any, index: number) => {
      if (!result.is_correct && result.error_tags && result.error_tags.length > 0) {
        const question = exercise.questions[index]
        
        // 提取相关的听力片段（简化处理，取前后50个字符）
        const transcript = exercise.transcript
        const transcriptSnippet = transcript.length > 100 
          ? transcript.substring(0, 200) + '...'
          : transcript

        const wrongAnswer = {
          id: uuidv4(),
          invitation_code: invitationCode,
          exercise_id: exercise.id,
          question_index: index,
          question_data: question,
          user_answer: result.user_answer,
          correct_answer: result.correct_answer,
          transcript_snippet: transcriptSnippet,
          topic: exercise.topic,
          difficulty: exercise.difficulty,
          language: exercise.language || 'en-US',
          tags: result.error_tags || [],
          error_analysis: result.error_analysis || null
        }

        wrongAnswers.push(wrongAnswer)
      }
    })

    // 保存所有错题到数据库
    let savedCount = 0
    for (const wrongAnswer of wrongAnswers) {
      if (await databaseAdapter.saveWrongAnswer(wrongAnswer)) {
        savedCount++
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `成功保存 ${savedCount} 个错题记录`,
      savedCount 
    })

  } catch (error) {
    console.error('保存错题失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}