/**
 * 系统性能指标API
 * 提供详细的性能监控数据
 */

import { NextRequest } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandler,
  validatePaginationParams
} from '@/lib/api-response'
import { validateQueryParams } from '@/lib/validation'
import { withMiddleware } from '@/lib/middleware'
import { performanceMonitor, logger } from '@/lib/monitoring'

/**
 * 获取性能指标处理器
 */
async function getMetricsHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // 验证查询参数
  const querySchema = {
    metric: {
      type: 'string' as const,
      enum: [
        'api_request_duration',
        'database_operation_duration', 
        'memory_rss',
        'memory_heap_used',
        'database_records_affected'
      ] as const
    },
    hours: {
      type: 'number' as const,
      min: 1,
      max: 168 // 最多7天
    },
    format: {
      type: 'string' as const,
      enum: ['summary', 'detailed', 'raw'] as const
    }
  }
  
  const { data: params } = validateQueryParams(searchParams, querySchema)
  const { page, limit } = validatePaginationParams(searchParams)
  
  const hours = params.hours || 24
  const format = params.format || 'summary'
  
  try {
    if (params.metric) {
      // 获取特定指标
      const stats = performanceMonitor.getMetricStats(params.metric, hours)
      const recentMetrics = performanceMonitor.getRecentMetrics(params.metric, limit)
      
      if (format === 'raw') {
        return createSuccessResponse({
          metric: params.metric,
          data: recentMetrics,
          timeRange: `${hours}h`,
          count: recentMetrics.length
        })
      } else if (format === 'detailed') {
        return createSuccessResponse({
          metric: params.metric,
          statistics: stats,
          recentData: recentMetrics.slice(-20), // 最近20个数据点
          timeRange: `${hours}h`,
          count: recentMetrics.length
        })
      } else {
        return createSuccessResponse({
          metric: params.metric,
          statistics: stats,
          timeRange: `${hours}h`
        })
      }
    } else {
      // 获取所有指标的摘要
      const allMetrics = [
        'api_request_duration',
        'database_operation_duration',
        'memory_rss',
        'memory_heap_used'
      ]
      
      const summary: Record<string, any> = {}
      
      for (const metricName of allMetrics) {
        summary[metricName] = performanceMonitor.getMetricStats(metricName, hours)
      }
      
      return createSuccessResponse({
        summary,
        timeRange: `${hours}h`,
        activeRequests: performanceMonitor.getActiveRequestCount(),
        timestamp: new Date().toISOString()
      })
    }
    
  } catch (error) {
    logger.error('Metrics retrieval failed', error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

// 只允许管理员访问指标
export const GET = withMiddleware({
  requireAdmin: true,
  cors: true
})(withErrorHandler(getMetricsHandler))