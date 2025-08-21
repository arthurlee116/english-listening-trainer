/**
 * 优化的练习保存API - v1
 * 包含完整的验证、事务处理、缓存清理等
 */

import { NextRequest } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandler, 
  createApiError
} from '@/lib/api-response'
import { 
  validateRequestBody, 
  commonSchemas 
} from '@/lib/validation'
import { withMiddleware } from '@/lib/middleware'
import { DatabaseOperations } from '@/lib/db-unified'
import { appCache } from '@/lib/cache'
import type { Exercise } from '@/lib/types'

/**
 * 练习保存处理器
 */
async function saveExerciseHandler(request: NextRequest) {
  // 验证请求体
  const { data } = await validateRequestBody(request, commonSchemas.exerciseSave)
  const { exercise, invitationCode } = data
  
  // 详细验证练习数据结构
  validateExerciseData(exercise)
  
  try {
    // 保存练习记录（包含事务处理）
    const success = DatabaseOperations.saveExercise(exercise as Exercise, invitationCode)
    
    if (!success) {
      throw createApiError.databaseError('练习保存失败')
    }
    
    // 清理相关缓存
    appCache.clearUserCache(invitationCode)
    
    // 返回成功响应
    return createSuccessResponse({
      exerciseId: exercise.id,
      message: '练习记录保存成功',
      stats: {
        totalQuestions: exercise.questions.length,
        correctAnswers: exercise.results.filter((r: any) => r.is_correct).length,
        accuracy: Math.round(
          (exercise.results.filter((r: any) => r.is_correct).length / exercise.questions.length) * 100
        )
      }
    })
    
  } catch (error) {
    console.error('Exercise save failed:', error)
    
    if (error instanceof ApiError) {
      throw error
    }
    
    throw createApiError.databaseError({
      message: '保存练习时发生数据库错误',
      originalError: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 验证练习数据结构
 */
function validateExerciseData(exercise: any): void {
  const requiredFields = ['id', 'difficulty', 'topic', 'transcript', 'questions', 'answers', 'results']
  
  for (const field of requiredFields) {
    if (!exercise[field]) {
      throw createApiError.validationError({
        field,
        message: `练习数据缺少必需字段: ${field}`
      })
    }
  }
  
  // 验证难度级别
  const validDifficulties = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  if (!validDifficulties.includes(exercise.difficulty)) {
    throw createApiError.validationError({
      field: 'difficulty',
      message: `无效的难度级别: ${exercise.difficulty}`,
      validValues: validDifficulties
    })
  }
  
  // 验证问题数组
  if (!Array.isArray(exercise.questions) || exercise.questions.length === 0) {
    throw createApiError.validationError({
      field: 'questions',
      message: '练习必须包含至少一个问题'
    })
  }
  
  // 验证结果数组
  if (!Array.isArray(exercise.results) || exercise.results.length !== exercise.questions.length) {
    throw createApiError.validationError({
      field: 'results',
      message: '结果数组长度必须与问题数组长度相同'
    })
  }
  
  // 验证每个问题的结构
  exercise.questions.forEach((question: any, index: number) => {
    if (!question.type || !['single', 'short'].includes(question.type)) {
      throw createApiError.validationError({
        field: `questions[${index}].type`,
        message: '问题类型必须是 single 或 short'
      })
    }
    
    if (!question.question || typeof question.question !== 'string') {
      throw createApiError.validationError({
        field: `questions[${index}].question`,
        message: '问题文本不能为空'
      })
    }
    
    if (!question.answer || typeof question.answer !== 'string') {
      throw createApiError.validationError({
        field: `questions[${index}].answer`,
        message: '问题答案不能为空'
      })
    }
  })
  
  // 验证每个结果的结构
  exercise.results.forEach((result: any, index: number) => {
    if (typeof result.is_correct !== 'boolean') {
      throw createApiError.validationError({
        field: `results[${index}].is_correct`,
        message: '结果必须包含布尔类型的 is_correct 字段'
      })
    }
    
    if (!result.user_answer || typeof result.user_answer !== 'string') {
      throw createApiError.validationError({
        field: `results[${index}].user_answer`,
        message: '结果必须包含用户答案'
      })
    }
    
    if (!result.correct_answer || typeof result.correct_answer !== 'string') {
      throw createApiError.validationError({
        field: `results[${index}].correct_answer`,
        message: '结果必须包含正确答案'
      })
    }
  })
  
  // 验证时间戳
  if (!exercise.createdAt || !isValidISODate(exercise.createdAt)) {
    throw createApiError.validationError({
      field: 'createdAt',
      message: '创建时间必须是有效的ISO 8601格式'
    })
  }
}

/**
 * 验证ISO日期格式
 */
function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString()
}

// 应用中间件并导出处理器
export const POST = withMiddleware({
  requireAuth: true,
  consumeUsage: true,
  rateLimit: true,
  strictRateLimit: true, // 练习保存是重要操作，使用严格限流
  cors: true
})(withErrorHandler(saveExerciseHandler))