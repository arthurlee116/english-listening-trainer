/**
 * API中间件系统
 * 提供认证、限流、日志等中间件功能
 */

import { NextRequest } from 'next/server'
import { dbOperations } from './db'
import { ApiError, createApiError, generateRequestId, ErrorCode } from './api-response'
import { validateAndCleanInvitationCode } from './validation'

// 请求上下文接口
export interface RequestContext {
  requestId: string
  timestamp: string
  invitationCode?: string
  userAgent?: string
  ip?: string
  startTime: number
}

/**
 * 创建请求上下文
 */
export function createRequestContext(request: NextRequest): RequestContext {
  const startTime = Date.now()
  const requestId = generateRequestId()
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'

  return {
    requestId,
    timestamp: new Date().toISOString(),
    userAgent,
    ip,
    startTime
  }
}

/**
 * 邀请码认证中间件
 */
export function withInvitationAuth(invitationCode: string): RequestContext & { invitationCode: string } {
  const cleanedCode = validateAndCleanInvitationCode(invitationCode)
  
  // 验证邀请码是否存在
  const isValid = dbOperations.verifyInvitationCode(cleanedCode)
  
  if (!isValid) {
    throw createApiError.invitationCodeNotFound()
  }
  
  // 检查今日使用次数
  const todayUsage = dbOperations.getTodayUsageCount(cleanedCode)
  
  if (todayUsage >= 5) {
    throw createApiError.dailyLimitExceeded(todayUsage, 5)
  }
  
  return {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    startTime: Date.now(),
    invitationCode: cleanedCode
  }
}

/**
 * 使用次数消费中间件
 */
export function withUsageConsumption(invitationCode: string): boolean {
  const cleanedCode = validateAndCleanInvitationCode(invitationCode)
  
  const success = dbOperations.incrementUsageCount(cleanedCode)
  
  if (!success) {
    throw createApiError.dailyLimitExceeded(5, 5)
  }
  
  return true
}

/**
 * 管理员认证中间件
 */
export function withAdminAuth(request: NextRequest): void {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(ErrorCode.ACCESS_DENIED, '缺少认证信息')
  }
  
  const token = authHeader.substring(7)
  
  // 这里应该实现真正的JWT验证，暂时使用简单的密码验证
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  
  if (token !== adminPassword) {
    throw new ApiError(ErrorCode.ACCESS_DENIED, '认证失败')
  }
}

/**
 * 速率限制中间件
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map()
  private readonly windowMs: number
  private readonly maxRequests: number
  
  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    
    // 定期清理过期记录
    setInterval(() => {
      const now = Date.now()
      for (const [key, value] of this.requests.entries()) {
        if (now > value.resetTime) {
          this.requests.delete(key)
        }
      }
    }, this.windowMs)
  }
  
  checkLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const current = this.requests.get(identifier)
    
    if (!current || now > current.resetTime) {
      // 新的时间窗口
      const resetTime = now + this.windowMs
      this.requests.set(identifier, { count: 1, resetTime })
      return { allowed: true, remaining: this.maxRequests - 1, resetTime }
    }
    
    if (current.count >= this.maxRequests) {
      // 超出限制
      return { allowed: false, remaining: 0, resetTime: current.resetTime }
    }
    
    // 增加计数
    current.count++
    this.requests.set(identifier, current)
    return { allowed: true, remaining: this.maxRequests - current.count, resetTime: current.resetTime }
  }
}

// 全局速率限制器实例
const globalRateLimiter = new RateLimiter(60000, 100) // 每分钟100次请求
const strictRateLimiter = new RateLimiter(60000, 20)  // 每分钟20次请求（用于AI生成等耗时操作）

/**
 * 速率限制中间件
 */
export function withRateLimit(
  request: NextRequest,
  strict: boolean = false
): void {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  const limiter = strict ? strictRateLimiter : globalRateLimiter
  const result = limiter.checkLimit(ip)
  
  if (!result.allowed) {
    throw new ApiError(ErrorCode.TOO_MANY_REQUESTS, '请求过于频繁，请稍后再试', {
      resetTime: new Date(result.resetTime).toISOString(),
      remaining: result.remaining
    })
  }
}

/**
 * 请求日志中间件
 */
export class RequestLogger {
  private static instance: RequestLogger
  private logs: Array<{
    requestId: string
    method: string
    url: string
    ip: string
    userAgent: string
    timestamp: string
    duration?: number
    status?: number
    error?: string
  }> = []
  
  static getInstance(): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger()
    }
    return RequestLogger.instance
  }
  
  logRequest(context: RequestContext, request: NextRequest): void {
    this.logs.push({
      requestId: context.requestId,
      method: request.method,
      url: request.url,
      ip: context.ip || 'unknown',
      userAgent: context.userAgent || 'unknown',
      timestamp: context.timestamp
    })
    
    // 保持最近1000条日志
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000)
    }
  }
  
  logResponse(requestId: string, status: number, duration: number, error?: string): void {
    const log = this.logs.find(l => l.requestId === requestId)
    if (log) {
      log.status = status
      log.duration = duration
      log.error = error
    }
  }
  
  getRecentLogs(limit: number = 100): typeof this.logs {
    return this.logs.slice(-limit)
  }
  
  getLogsByTimeRange(startTime: string, endTime: string): typeof this.logs {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    
    return this.logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime()
      return logTime >= start && logTime <= end
    })
  }
}

/**
 * 性能监控中间件
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Array<{
    endpoint: string
    method: string
    duration: number
    timestamp: string
    status: number
  }> = []
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }
  
  recordMetric(
    endpoint: string,
    method: string,
    duration: number,
    status: number
  ): void {
    this.metrics.push({
      endpoint,
      method,
      duration,
      status,
      timestamp: new Date().toISOString()
    })
    
    // 保持最近5000条记录
    if (this.metrics.length > 5000) {
      this.metrics = this.metrics.slice(-5000)
    }
  }
  
  getAverageResponseTime(endpoint?: string, hours: number = 24): number {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    const filtered = this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp).getTime()
      return metricTime >= cutoff && (!endpoint || m.endpoint === endpoint)
    })
    
    if (filtered.length === 0) return 0
    
    const total = filtered.reduce((sum, m) => sum + m.duration, 0)
    return total / filtered.length
  }
  
  getSlowRequests(threshold: number = 5000, hours: number = 24): typeof this.metrics {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    return this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp).getTime()
      return metricTime >= cutoff && m.duration > threshold
    })
  }
  
  getErrorRate(hours: number = 24): number {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    const filtered = this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp).getTime()
      return metricTime >= cutoff
    })
    
    if (filtered.length === 0) return 0
    
    const errors = filtered.filter(m => m.status >= 400).length
    return (errors / filtered.length) * 100
  }
}

/**
 * CORS中间件配置
 */
export function getCorsHeaders(origin?: string) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-domain.com' // 生产环境域名
  ]
  
  const isAllowedOrigin = origin && allowedOrigins.includes(origin)
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400' // 24小时
  }
}

/**
 * 综合中间件组合器
 */
export function withMiddleware(config: {
  requireAuth?: boolean
  requireAdmin?: boolean
  consumeUsage?: boolean
  rateLimit?: boolean
  strictRateLimit?: boolean
  cors?: boolean
}) {
  return (handler: (request: NextRequest, context: RequestContext) => Promise<any>) => {
    return async (request: NextRequest) => {
      const logger = RequestLogger.getInstance()
      const monitor = PerformanceMonitor.getInstance()
      const context = createRequestContext(request)
      
      try {
        // 记录请求开始
        logger.logRequest(context, request)
        
        // CORS预检请求处理
        if (config.cors && request.method === 'OPTIONS') {
          const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined)
          return new Response(null, { status: 200, headers: corsHeaders })
        }
        
        // 速率限制
        if (config.rateLimit || config.strictRateLimit) {
          withRateLimit(request, config.strictRateLimit)
        }
        
        // 管理员认证
        if (config.requireAdmin) {
          withAdminAuth(request)
        }
        
        // 邀请码认证
        if (config.requireAuth) {
          // 这里需要从请求中获取邀请码，具体实现取决于API设计
          const body = await request.clone().json().catch(() => ({}))
          const invitationCode = body.invitationCode || body.code || request.headers.get('x-invitation-code')
          
          if (!invitationCode) {
            throw createApiError.missingParameters(['invitationCode'])
          }
          
          const authContext = withInvitationAuth(invitationCode)
          Object.assign(context, authContext)
        }
        
        // 消费使用次数
        if (config.consumeUsage && context.invitationCode) {
          withUsageConsumption(context.invitationCode)
        }
        
        // 执行实际处理器
        const result = await handler(request, context)
        
        // 记录成功响应
        const duration = Date.now() - context.startTime
        logger.logResponse(context.requestId, 200, duration)
        monitor.recordMetric(request.url, request.method, duration, 200)
        
        // 添加CORS头
        if (config.cors && result instanceof Response) {
          const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined)
          Object.entries(corsHeaders).forEach(([key, value]) => {
            result.headers.set(key, value)
          })
        }
        
        return result
        
      } catch (error) {
        const duration = Date.now() - context.startTime
        const status = error instanceof ApiError ? 400 : 500
        const message = error instanceof Error ? error.message : String(error)
        
        // 记录错误响应
        logger.logResponse(context.requestId, status, duration, message)
        monitor.recordMetric(request.url, request.method, duration, status)
        
        // 重新抛出错误让上层处理
        throw error
      }
    }
  }
}