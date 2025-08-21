/**
 * 优化的练习历史查询API - v1
 * 支持分页、缓存、排序和筛选
 */

import { NextRequest } from 'next/server'
import { 
  createPaginatedResponse, 
  withErrorHandler,
  validatePaginationParams,
  buildPaginationInfo,
  createApiError
} from '@/lib/api-response'
import { 
  validateQueryParams 
} from '@/lib/validation'
import { withMiddleware } from '@/lib/middleware'
import { compatibleDbOperations } from '@/lib/db-simple'
import { appCache, cacheKeys } from '@/lib/cache'

/**
 * 练习历史查询处理器
 */
async function getExerciseHistoryHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // 获取邀请码（应该从认证中间件传递）
  const invitationCode = request.headers.get('x-invitation-code')
  if (!invitationCode) {
    throw createApiError.missingParameters(['invitationCode'])
  }
  
  // 验证分页参数
  const { page, limit, offset } = validatePaginationParams(searchParams)
  
  // 验证其他查询参数
  const querySchema = {
    difficulty: {
      type: 'string' as const,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
    },
    topic: {
      type: 'string' as const,
      min: 1,
      max: 100
    },
    sortBy: {
      type: 'string' as const,
      enum: ['created_at', 'difficulty', 'accuracy'] as const
    },
    sortOrder: {
      type: 'string' as const,
      enum: ['asc', 'desc'] as const
    },
    minAccuracy: {
      type: 'number' as const,
      min: 0,
      max: 100
    },
    maxAccuracy: {
      type: 'number' as const,
      min: 0,
      max: 100
    }
  }
  
  const { data: filters } = validateQueryParams(searchParams, querySchema)
  
  // 检查缓存
  const cacheKey = cacheKeys.exerciseHistory(
    invitationCode, 
    limit, 
    offset
  ) + `:${JSON.stringify(filters)}`
  
  const cachedData = appCache.getCachedExerciseHistory(
    invitationCode, 
    limit, 
    offset
  )
  
  if (cachedData && Object.keys(filters).length === 0) {
    // 只有在没有额外筛选条件时才使用缓存
    return createPaginatedResponse(
      cachedData.exercises,
      buildPaginationInfo(page, limit, cachedData.total),
      { cached: true }
    )
  }
  
  try {
    // 构建数据库查询参数
    const dbFilters = {
      ...filters,
      limit,
      offset,
      sortBy: filters.sortBy || 'created_at',
      sortOrder: filters.sortOrder || 'desc'
    }
    
    // 从数据库获取数据
    const { exercises, total } = compatibleDbOperations.getExerciseHistory(
      invitationCode,
      limit,
      offset
    )
    
    // 应用客户端筛选（如果有的话）
    let filteredExercises = exercises
    
    if (filters.difficulty) {
      filteredExercises = filteredExercises.filter(ex => ex.difficulty === filters.difficulty)
    }
    
    if (filters.topic) {
      filteredExercises = filteredExercises.filter(ex => 
        ex.topic.toLowerCase().includes(filters.topic!.toLowerCase())
      )
    }
    
    if (filters.minAccuracy !== undefined || filters.maxAccuracy !== undefined) {
      filteredExercises = filteredExercises.filter(ex => {
        const accuracy = (ex.results.filter((r: any) => r.is_correct).length / ex.results.length) * 100
        
        if (filters.minAccuracy !== undefined && accuracy < filters.minAccuracy) {
          return false
        }
        
        if (filters.maxAccuracy !== undefined && accuracy > filters.maxAccuracy) {
          return false
        }
        
        return true
      })
    }
    
    // 添加计算字段
    const enrichedExercises = filteredExercises.map(exercise => ({
      id: exercise.id,
      difficulty: exercise.difficulty,
      topic: exercise.topic,
      wordCount: exercise.transcript.split(' ').length,
      questionsCount: exercise.questions.length,
      correctAnswers: exercise.results.filter((r: any) => r.is_correct).length,
      accuracy: Math.round(
        (exercise.results.filter((r: any) => r.is_correct).length / exercise.questions.length) * 100
      ),
      createdAt: exercise.createdAt,
      duration: calculateDuration(exercise), // 如果有的话
      tags: extractTopicTags(exercise.topic)
    }))
    
    // 缓存结果（只缓存基本查询）
    if (Object.keys(filters).length === 0) {
      appCache.cacheExerciseHistory(invitationCode, limit, offset, {
        exercises: enrichedExercises,
        total
      })
    }
    
    // 构建分页信息
    const paginationInfo = buildPaginationInfo(page, limit, total)
    
    // 添加统计信息
    const stats = {
      totalExercises: total,
      averageAccuracy: enrichedExercises.length > 0 
        ? Math.round(enrichedExercises.reduce((sum, ex) => sum + ex.accuracy, 0) / enrichedExercises.length)
        : 0,
      difficultyDistribution: getDifficultyDistribution(enrichedExercises),
      recentStreak: calculateRecentStreak(enrichedExercises)
    }
    
    return createPaginatedResponse(
      enrichedExercises,
      paginationInfo,
      { 
        cached: false,
        stats,
        filters: filters
      }
    )
    
  } catch (error) {
    console.error('Exercise history query failed:', error)
    
    if (error instanceof ApiError) {
      throw error
    }
    
    throw createApiError.databaseError({
      message: '查询练习历史时发生数据库错误',
      originalError: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 计算练习时长（如果有时间戳记录）
 */
function calculateDuration(exercise: any): number | null {
  // 这里可以根据实际的时间戳字段计算
  // 目前返回估算值
  return exercise.questions.length * 30 // 假设每题30秒
}

/**
 * 从主题中提取标签
 */
function extractTopicTags(topic: string): string[] {
  const commonTags = [
    'business', 'travel', 'education', 'technology', 'health',
    'environment', 'culture', 'sports', 'food', 'entertainment'
  ]
  
  const topicLower = topic.toLowerCase()
  return commonTags.filter(tag => topicLower.includes(tag))
}

/**
 * 获取难度分布统计
 */
function getDifficultyDistribution(exercises: any[]): Record<string, number> {
  const distribution: Record<string, number> = {}
  
  exercises.forEach(exercise => {
    distribution[exercise.difficulty] = (distribution[exercise.difficulty] || 0) + 1
  })
  
  return distribution
}

/**
 * 计算最近连续练习天数
 */
function calculateRecentStreak(exercises: any[]): number {
  if (exercises.length === 0) return 0
  
  // 按日期分组
  const dateGroups = new Map<string, number>()
  
  exercises.forEach(exercise => {
    const date = new Date(exercise.createdAt).toISOString().split('T')[0]
    dateGroups.set(date, (dateGroups.get(date) || 0) + 1)
  })
  
  // 计算连续天数
  const sortedDates = Array.from(dateGroups.keys()).sort().reverse()
  let streak = 0
  let currentDate = new Date()
  
  for (const dateStr of sortedDates) {
    const exerciseDate = new Date(dateStr)
    const diffDays = Math.floor((currentDate.getTime() - exerciseDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === streak) {
      streak++
      currentDate = exerciseDate
    } else {
      break
    }
  }
  
  return streak
}

// 应用中间件并导出处理器
export const GET = withMiddleware({
  requireAuth: true,
  rateLimit: true,
  cors: true
})(withErrorHandler(getExerciseHistoryHandler))