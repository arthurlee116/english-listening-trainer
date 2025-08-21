/**
 * 系统健康检查API
 * 提供系统状态、性能指标和健康检查结果
 */

import { NextRequest } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandler,
  createApiError
} from '@/lib/api-response'
import { withMiddleware } from '@/lib/middleware'
import { 
  healthChecker, 
  performanceMonitor, 
  logger 
} from '@/lib/monitoring'
import { DatabaseOperations } from '@/lib/db-unified'

/**
 * 健康检查处理器
 */
async function healthCheckHandler(request: NextRequest) {
  try {
    // 执行完整的健康检查
    const healthResult = await healthChecker.performHealthCheck()
    
    // 获取性能统计
    const performanceStats = {
      api_requests: performanceMonitor.getMetricStats('api_request_duration', 1),
      database_operations: performanceMonitor.getMetricStats('database_operation_duration', 1),
      memory_usage: performanceMonitor.getMetricStats('memory_rss', 1),
      active_requests: performanceMonitor.getActiveRequestCount()
    }
    
    // 获取最近的日志统计
    const recentLogs = logger.getLogs(undefined, 50)
    const logStats = {
      total: recentLogs.length,
      errors: recentLogs.filter(log => log.level === 'error').length,
      warnings: recentLogs.filter(log => log.level === 'warn').length
    }
    
    const responseData = {
      health: healthResult,
      performance: performanceStats,
      logs: logStats,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    }
    
    // 根据健康状态设置HTTP状态码
    const httpStatus = healthResult.status === 'unhealthy' ? 503 : 200
    
    return createSuccessResponse(responseData, {
      httpStatus
    })
    
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)))
    
    return createSuccessResponse({
      health: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      }
    }, {
      httpStatus: 503
    })
  }
}

// 只允许管理员访问健康检查
export const GET = withMiddleware({
  requireAdmin: true,
  cors: true
})(withErrorHandler(healthCheckHandler))