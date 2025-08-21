/**
 * 优化的邀请码验证API - v1
 * 使用新的架构：统一响应格式、验证、缓存、中间件等
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
import { compatibleDbOperations } from '@/lib/db-simple'
import { appCache } from '@/lib/cache'

/**
 * 邀请码验证处理器
 */
async function verifyInvitationHandler(request: NextRequest) {
  // 验证请求体
  const { data } = await validateRequestBody(request, commonSchemas.invitationCode)
  const { code } = data
  
  // 检查缓存
  const cachedResult = appCache.getCachedInvitationVerification(code)
  if (cachedResult !== null) {
    if (!cachedResult) {
      throw createApiError.invitationCodeNotFound()
    }
    
    // 即使缓存命中，也要检查使用次数（实时数据）
    const todayUsage = compatibleDbOperations.getTodayUsageCount(code)
    
    return createSuccessResponse({
      code,
      todayUsage,
      remainingUsage: Math.max(0, 5 - todayUsage),
      message: '邀请码验证成功',
      cached: true
    })
  }
  
  // 验证邀请码是否存在
  const isValid = compatibleDbOperations.verifyInvitationCode(code)
  
  // 缓存验证结果
  appCache.cacheInvitationVerification(code, isValid)
  
  if (!isValid) {
    throw createApiError.invitationCodeNotFound()
  }

  // 检查今日使用次数
  const todayUsage = compatibleDbOperations.getTodayUsageCount(code)
  
  return createSuccessResponse({
    code,
    todayUsage,
    remainingUsage: Math.max(0, 5 - todayUsage),
    message: '邀请码验证成功',
    cached: false
  })
}

// 应用中间件并导出处理器
export const POST = withMiddleware({
  rateLimit: true,
  cors: true
})(withErrorHandler(verifyInvitationHandler))