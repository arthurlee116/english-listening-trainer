/**
 * 邀请码使用API - v1
 * 增加使用次数并检查限制
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

/**
 * 邀请码使用处理器
 */
async function useInvitationHandler(request: NextRequest) {
  // 验证请求体
  const { data } = await validateRequestBody(request, commonSchemas.invitationCode)
  const { code } = data
  
  const invitationCode = code.trim().toUpperCase()
  
  // 验证邀请码是否存在
  const isValid = DatabaseOperations.verifyInvitationCode(invitationCode)
  
  if (!isValid) {
    throw createApiError.invitationCodeNotFound()
  }

  // 检查今日使用次数
  const todayUsage = DatabaseOperations.getTodayUsageCount(invitationCode)
  
  if (todayUsage >= 5) {
    throw createApiError.rateLimitExceeded('今日使用次数已达上限（5次）')
  }

  // 增加使用次数
  const success = DatabaseOperations.incrementUsageCount(invitationCode)
  
  if (!success) {
    throw createApiError.databaseError('使用次数更新失败')
  }

  // 清理相关缓存
  appCache.clearUserCache(invitationCode)

  const newUsage = DatabaseOperations.getTodayUsageCount(invitationCode)
  const remainingUsage = Math.max(0, 5 - newUsage)
  
  return createSuccessResponse({
    todayUsage: newUsage,
    remainingUsage,
    message: `使用次数已记录，今日还可使用 ${remainingUsage} 次`
  })
}

// 应用中间件并导出处理器
export const POST = withMiddleware({
  requireAuth: true,
  rateLimit: true,
  strictRateLimit: true, // 使用次数是重要操作，使用严格限流
  cors: true
})(withErrorHandler(useInvitationHandler))