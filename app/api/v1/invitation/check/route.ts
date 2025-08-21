/**
 * 邀请码检查API - v1
 * 使用新的架构：统一响应格式、验证、缓存、中间件等
 */

import { NextRequest } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandler, 
  createApiError
} from '@/lib/api-response'
import { withMiddleware } from '@/lib/middleware'
import { DatabaseOperations } from '@/lib/db-unified'
import { appCache } from '@/lib/cache'

/**
 * 邀请码检查处理器
 */
async function checkInvitationHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    throw createApiError.validationError({
      field: 'code',
      message: '缺少邀请码参数'
    })
  }

  const invitationCode = code.trim().toUpperCase()
  
  // 检查缓存
  const cachedResult = appCache.getCachedInvitationVerification(invitationCode)
  if (cachedResult !== null) {
    if (!cachedResult) {
      throw createApiError.invitationCodeNotFound()
    }
    
    // 即使缓存命中，也要检查使用次数（实时数据）
    const todayUsage = DatabaseOperations.getTodayUsageCount(invitationCode)
    
    return createSuccessResponse({
      code: invitationCode,
      todayUsage,
      remainingUsage: Math.max(0, 5 - todayUsage),
      canUse: Math.max(0, 5 - todayUsage) > 0,
      message: '邀请码验证成功',
      cached: true
    })
  }
  
  // 验证邀请码是否存在
  const isValid = DatabaseOperations.verifyInvitationCode(invitationCode)
  
  // 缓存验证结果
  appCache.cacheInvitationVerification(invitationCode, isValid)
  
  if (!isValid) {
    throw createApiError.invitationCodeNotFound()
  }

  // 检查今日使用次数
  const todayUsage = DatabaseOperations.getTodayUsageCount(invitationCode)
  const remainingUsage = Math.max(0, 5 - todayUsage)
  
  return createSuccessResponse({
    code: invitationCode,
    todayUsage,
    remainingUsage,
    canUse: remainingUsage > 0,
    message: '邀请码验证成功',
    cached: false
  })
}

// 应用中间件并导出处理器
export const GET = withMiddleware({
  rateLimit: true,
  cors: true
})(withErrorHandler(checkInvitationHandler))