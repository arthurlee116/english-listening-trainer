import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { ensureTableColumn } from '@/lib/database'
import { PrismaClient } from '@prisma/client'
import type { FocusArea } from '@/lib/types'
import type { Prisma } from '@prisma/client'

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

    const { 
      exerciseData, 
      difficulty, 
      language, 
      topic, 
      accuracy, 
      score, 
      duration, 
      achievementMetadata,
      // 专项练习相关字段
      focusAreas,
      focusCoverage,
      specializedMode
    } = await request.json()

    // 验证必填字段
    if (!exerciseData || !difficulty || !topic) {
      return NextResponse.json(
        { error: '练习数据不完整' },
        { status: 400 }
      )
    }

    // 安全解析和合并 exerciseData
    let parsedExerciseData: Record<string, unknown> = {}
    try {
      // 如果 exerciseData 是字符串，尝试解析
      if (typeof exerciseData === 'string') {
        parsedExerciseData = JSON.parse(exerciseData)
      } else {
        parsedExerciseData = { ...exerciseData }
      }
    } catch (error) {
      console.warn('Failed to parse exerciseData, using as object:', error)
      parsedExerciseData = typeof exerciseData === 'object' ? { ...exerciseData } : {}
    }

    // 计算专项成绩 (perFocusAccuracy)
    const perFocusAccuracy: Record<string, number> = {}
    if (specializedMode && focusAreas && Array.isArray(focusAreas) && parsedExerciseData.results) {
      const results = parsedExerciseData.results as Array<{is_correct?: boolean}>
      const questions = (parsedExerciseData.questions as Array<{focus_areas?: FocusArea[]}>) || []
      
      focusAreas.forEach((area: FocusArea) => {
        let areaCorrect = 0
        let areaTotal = 0
        
        questions.forEach((question, index: number) => {
          if (question.focus_areas && question.focus_areas.includes(area)) {
            areaTotal++
            if (results[index] && results[index].is_correct) {
              areaCorrect++
            }
          }
        })
        
        if (areaTotal > 0) {
          perFocusAccuracy[area] = Math.round((areaCorrect / areaTotal) * 100)
        }
      })
    }

    // 合并专项练习数据 (保留以兼容历史数据)
    const enhancedExerciseData = {
      ...parsedExerciseData,
      achievementMetadata: achievementMetadata || null,
      // 专项练习字段 (已废弃,但保留以兼容历史数据)
      ...(specializedMode && {
        focusAreas: focusAreas || [],
        focusCoverage: focusCoverage || null,
        specializedMode,
        perFocusAccuracy
      })
    }

    const hasFocusAreasColumn = await ensureTableColumn(prisma, 'practice_questions', 'focus_areas', 'TEXT')

    if (!hasFocusAreasColumn) {
      return NextResponse.json(
        { error: '数据库结构缺少 practice_questions.focus_areas 列，无法保存练习记录' },
        { status: 500 }
      )
    }

    // 检查是否有匹配的活跃挑战
    let linkedChallenge = null
    if (difficulty && topic) {
      const activeChallenges = await prisma.challenge.findMany({
        where: {
          userId: authResult.user!.userId,
          status: 'active',
          minDifficulty: { lte: difficulty },
          maxDifficulty: { gte: difficulty },
          topic: {
            // 简单的话题匹配 - 可以根据需要改进匹配逻辑
            contains: topic.split(' ').slice(0, 3).join(' ') // 匹配前几个词
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // 选择最相关的挑战（这里选择最新的）
      linkedChallenge = activeChallenges[0] || null
    }

    // 使用事务保存练习记录和题目数据
    const result = await prisma.$transaction(async (tx) => {
      // 保存练习会话
      const practiceSession = await tx.practiceSession.create({
        data: {
          userId: authResult.user!.userId,
          exerciseData: JSON.stringify(enhancedExerciseData),
          difficulty,
          language: language || 'en-US',
          topic,
          transcript: (parsedExerciseData.transcript as string) || '',
          accuracy: accuracy || null,
          score: score || null,
          duration: duration || null
        }
      })

      // 如果有题目数据，保存题目和答案
      if (parsedExerciseData.questions && Array.isArray(parsedExerciseData.questions)) {
        const questions = parsedExerciseData.questions as Array<Record<string, unknown>>
        const results = (parsedExerciseData.results as Array<Record<string, unknown>>) || []

        for (let i = 0; i < questions.length; i++) {
          const question = questions[i]
          
          // 安全解析 focus_areas
          let focusAreasJson: string | null = null
          if (question.focus_areas && Array.isArray(question.focus_areas)) {
            try {
              focusAreasJson = JSON.stringify(question.focus_areas)
            } catch (error) {
              console.warn('Failed to serialize focus_areas for question', { questionIndex: i, error })
            }
          }

          // 创建题目记录
          const questionData: Prisma.PracticeQuestionUncheckedCreateInput = {
            sessionId: practiceSession.id,
            index: i,
            type: (question.type as string) || 'single',
            question: (question.question as string) || '',
            options: question.options ? JSON.stringify(question.options) : null,
            correctAnswer: (question.answer as string) || '',
            explanation: (question.explanation as string) || null,
            transcriptSnapshot: null
          }

          if (hasFocusAreasColumn) {
            questionData.focusAreas = focusAreasJson
          }

          const practiceQuestion = await tx.practiceQuestion.create({
            data: questionData
          })

          // 如果有对应的答案结果，创建答案记录
          if (results[i]) {
            const result = results[i]
            await tx.practiceAnswer.create({
              data: {
                questionId: practiceQuestion.id,
                userAnswer: (result.user_answer as string) || '',
                isCorrect: (result.is_correct as boolean) || false,
                attemptedAt: new Date(),
                aiAnalysis: null,
                aiAnalysisGeneratedAt: null,
                tags: '[]',
                needsAnalysis: !(result.is_correct as boolean) // 错题需要分析
              }
            })
          }
        }
      }

      // 如果找到匹配的挑战，创建关联并更新挑战进度
      if (linkedChallenge) {
        await tx.challengeSession.create({
          data: {
            challengeId: linkedChallenge.id,
            sessionId: practiceSession.id
          }
        })

        // 更新挑战的完成会话数
        await tx.challenge.update({
          where: { id: linkedChallenge.id },
          data: {
            completedSessionCount: {
              increment: 1
            }
          }
        })
      }

      return practiceSession
    })

    return NextResponse.json({
      message: '练习记录保存成功',
      session: {
        id: result.id,
        createdAt: result.createdAt
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
