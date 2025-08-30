import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor, getMemoryUsage, apiCache, audioCache, aiCache } from '@/lib/performance-optimizer'

export async function GET(request: NextRequest) {
  try {
    // 获取性能指标
    const performanceStats = performanceMonitor.getAllStats()
    
    // 获取内存使用情况
    const memoryUsage = getMemoryUsage()
    
    // 获取缓存统计
    const cacheStats = {
      api: apiCache.getStats(),
      audio: audioCache.getStats(),
      ai: aiCache.getStats()
    }
    
    // 系统运行时间
    const uptime = process.uptime()
    
    // 获取当前时间戳
    const timestamp = new Date().toISOString()
    
    // 定义缓存统计信息的接口
    interface CacheStats {
      size?: number
      maxSize?: number
    }

    // 计算缓存命中率（如果有相关数据）
    const calculateCacheHitRate = (stats: CacheStats) => {
      const total = stats.size || 0
      const max = stats.maxSize || 1
      return total > 0 ? (total / max * 100).toFixed(2) : "0.00"
    }
    
    const metrics = {
      timestamp,
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime)
      },
      memory: memoryUsage ? {
        ...memoryUsage,
        unit: "MB"
      } : null,
      performance: performanceStats,
      cache: {
        api: {
          ...cacheStats.api,
          utilizationPercent: calculateCacheHitRate(cacheStats.api)
        },
        audio: {
          ...cacheStats.audio,
          utilizationPercent: calculateCacheHitRate(cacheStats.audio)
        },
        ai: {
          ...cacheStats.ai,
          utilizationPercent: calculateCacheHitRate(cacheStats.ai)
        }
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development'
      }
    }
    
    // 如果请求包含详细信息参数，添加更多详细数据
    const includeDetails = request.nextUrl.searchParams.get('details') === 'true'
    
    if (includeDetails) {
      // 添加详细的性能历史数据
      const detailedMetrics = {
        ...metrics,
        detailed: {
          performanceHistory: getPerformanceHistory(),
          resourceUtilization: getResourceUtilization(),
          errorRates: getErrorRates()
        }
      }
      
      return NextResponse.json(detailedMetrics)
    }
    
    return NextResponse.json(metrics)
    
  } catch (error) {
    console.error('Failed to get performance metrics:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// 格式化运行时间
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

// 定义性能历史记录项的接口
interface PerformanceHistoryItem {
  latest: number
  trend: 'improving' | 'stable' | 'degrading'
  reliability: 'high' | 'medium' | 'low'
}

// 获取性能历史数据
function getPerformanceHistory() {
  const stats = performanceMonitor.getAllStats()
  const history: Record<string, PerformanceHistoryItem> = {}
  
  for (const [label, data] of Object.entries(stats)) {
    if (data && typeof data === 'object' && data !== null && 'average' in data && 'count' in data) {
      history[label] = {
        latest: (data as { average: number }).average,
        trend: calculateTrend(label),
        reliability: (data as { count: number }).count > 10 ? 'high' : (data as { count: number }).count > 5 ? 'medium' : 'low'
      }
    }
  }
  
  return history
}

// 计算趋势（简化版本）
function calculateTrend(label: string): 'improving' | 'stable' | 'degrading' {
  const stats = performanceMonitor.getStats(label)
  if (!stats || stats.count < 5) return 'stable'
  
  // 简单的趋势计算：比较最近的平均值和总体平均值
  const recentAvg = stats.p50
  const overallAvg = stats.average
  
  const variance = Math.abs(recentAvg - overallAvg) / overallAvg
  
  if (variance < 0.1) return 'stable'
  return recentAvg < overallAvg ? 'improving' : 'degrading'
}

// 获取资源利用率
function getResourceUtilization() {
  const memory = getMemoryUsage()
  
  return {
    memory: memory ? {
      heapUsagePercent: memory.heapUsed / memory.heapTotal * 100,
      status: memory.heapUsed / memory.heapTotal > 0.8 ? 'high' : 
              memory.heapUsed / memory.heapTotal > 0.6 ? 'medium' : 'low'
    } : null,
    cache: {
      totalCacheItems: apiCache.getStats().size + audioCache.getStats().size + aiCache.getStats().size,
      status: 'normal' // 可以根据实际情况计算
    }
  }
}

// 获取错误率（简化版本）
function getErrorRates() {
  // 这里应该从实际的错误监控系统获取数据
  // 目前返回模拟数据
  return {
    api: {
      total: 0,
      rate: 0,
      status: 'healthy'
    },
    tts: {
      total: 0,
      rate: 0,
      status: 'healthy'
    },
    ai: {
      total: 0,
      rate: 0,
      status: 'healthy'
    }
  }
}

// 健康检查端点
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}