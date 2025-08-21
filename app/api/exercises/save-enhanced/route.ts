/**
 * 增强版练习保存API
 * 使用统一数据库操作和事务处理
 */

import { NextRequest, NextResponse } from 'next/server'
import { DatabaseOperations } from '@/lib/db-unified'
import { ErrorHandler, ErrorCode, ErrorSeverity } from '@/lib/error-handler'
import type { Exercise } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { exercise, invitationCode, wrongAnswers } = await request.json()
    
    // 验证必需字段
    if (!exercise || !invitationCode) {
      const error = ErrorHandler.createError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Missing required fields',
        ErrorSeverity.LOW,
        '缺少必需字段'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 400 })
    }

    // 验证练习数据结构
    if (!exercise.id || !exercise.topic || !exercise.questions) {
      const error = ErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid exercise data structure',
        ErrorSeverity.MEDIUM,
        '练习数据格式不正确'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 400 })
    }

    // 使用重试机制保存练习
    const saveOperation = async () => {
      const success = DatabaseOperations.saveExercise(exercise as Exercise, invitationCode)
      if (!success) {
        throw new Error('Failed to save exercise to database')
      }
      return success
    }

    await ErrorHandler.withRetry(saveOperation, 3, 1000)

    // 如果有错题，保存错题记录
    if (wrongAnswers && Array.isArray(wrongAnswers) && wrongAnswers.length > 0) {
      for (const wrongAnswer of wrongAnswers) {
        try {
          const wrongAnswerData = {
            id: `${exercise.id}_${wrongAnswer.questionIndex}_${Date.now()}`,
            invitation_code: invitationCode,
            exercise_id: exercise.id,
            question_index: wrongAnswer.questionIndex,
            question_data: wrongAnswer.question,
            user_answer: wrongAnswer.userAnswer,
            correct_answer: wrongAnswer.correctAnswer,
            transcript_snippet: wrongAnswer.transcriptSnippet,
            topic: exercise.topic,
            difficulty: exercise.difficulty,
            tags: wrongAnswer.tags || [],
            error_analysis: wrongAnswer.errorAnalysis
          }

          DatabaseOperations.saveWrongAnswer(wrongAnswerData)
        } catch (wrongAnswerError) {
          console.warn('Failed to save wrong answer:', wrongAnswerError)
          // 继续处理其他错题，不因单个错题失败而中断
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: '练习保存成功',
      exerciseId: exercise.id
    })

  } catch (error) {
    const appError = ErrorHandler.wrapError(
      error as Error,
      ErrorCode.SAVE_FAILED,
      ErrorSeverity.HIGH,
      '保存练习失败，请稍后重试'
    )
    
    return NextResponse.json({ 
      error: appError.userMessage 
    }, { status: 500 })
  }
}

// 获取练习历史（支持分页）
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const invitationCode = url.searchParams.get('code')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    if (!invitationCode) {
      const error = ErrorHandler.createError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Missing invitation code',
        ErrorSeverity.LOW,
        '缺少邀请码参数'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 400 })
    }

    if (limit > 50) {
      const error = ErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Limit too large',
        ErrorSeverity.LOW,
        '单次查询数量不能超过50条'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 400 })
    }

    const result = DatabaseOperations.getExerciseHistory(invitationCode, limit, offset)
    
    return NextResponse.json({
      success: true,
      data: result.exercises,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.hasMore
      }
    })

  } catch (error) {
    const appError = ErrorHandler.wrapError(
      error as Error,
      ErrorCode.DATABASE_ERROR,
      ErrorSeverity.HIGH,
      '获取练习历史失败'
    )
    
    return NextResponse.json({ 
      error: appError.userMessage 
    }, { status: 500 })
  }
}