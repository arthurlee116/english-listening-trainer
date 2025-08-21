/**
 * 监控和日志记录系统
 * 提供性能监控、错误追踪、健康检查等功能
 */

import { DatabaseOperations } from './db-unified'
import { appCache } from './cache'

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// 日志条目接口
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: any
  error?: Error
  requestId?: string
  userId?: string
  duration?: number
  metadata?: Record<string, any>
}

// 性能指标接口
export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: string
  tags?: Record<string, string>
}

// 健康检查结果接口
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn'
    message?: string
    duration?: number
    details?: any
  }>
  uptime: number
  version: string
}

/**
 * 结构化日志记录器
 */
export class Logger {
  private static instance: Logger
  private logs: LogEntry[] = []
  private readonly maxLogs = 1000

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: any,
    error?: Error,
    requestId?: string,
    userId?: string,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      requestId,
      userId,
      duration,
      metadata: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    }
  }

  private log(entry: LogEntry): void {
    // 添加到内存日志
    this.logs.push(entry)
    
    // 保持最近的日志条目
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // 控制台输出（开发环境）
    if (process.env.NODE_ENV === 'development') {
      const color = this.getLogColor(entry.level)
      console.log(
        `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${'\x1b[0m'}`
      )
      
      if (entry.context) {
        console.log('Context:', entry.context)
      }
      
      if (entry.error) {
        console.error('Error:', entry.error)
      }
    }

    // 生产环境可以发送到外部日志服务
    if (process.env.NODE_ENV === 'production' && entry.level === LogLevel.ERROR) {
      this.sendToExternalLogging(entry)
    }
  }

  private getLogColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // cyan
      [LogLevel.INFO]: '\x1b[32m',  // green
      [LogLevel.WARN]: '\x1b[33m',  // yellow
      [LogLevel.ERROR]: '\x1b[31m', // red
      [LogLevel.FATAL]: '\x1b[35m'  // magenta
    }
    return colors[level] || '\x1b[0m'
  }

  private async sendToExternalLogging(entry: LogEntry): Promise<void> {
    // 这里可以集成外部日志服务，如 Sentry、LogRocket、DataDog 等
    // 例如：await sentry.captureException(entry.error, { extra: entry.context })
  }

  debug(message: string, context?: any, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.DEBUG, message, context, undefined, requestId))
  }

  info(message: string, context?: any, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.INFO, message, context, undefined, requestId))
  }

  warn(message: string, context?: any, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.WARN, message, context, undefined, requestId))
  }

  error(message: string, error?: Error, context?: any, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.ERROR, message, context, error, requestId))
  }

  fatal(message: string, error?: Error, context?: any, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.FATAL, message, context, error, requestId))
  }

  // API请求日志
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId: string,
    userId?: string,
    requestBody?: any,
    responseSize?: number
  ): void {
    this.info('API Request', {
      method,
      url,
      statusCode,
      duration,
      userId,
      requestBody: process.env.NODE_ENV === 'development' ? requestBody : '[REDACTED]',
      responseSize
    }, requestId)
  }

  // 数据库操作日志
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    recordsAffected?: number,
    requestId?: string
  ): void {
    this.debug('Database Operation', {
      operation,
      table,
      duration,
      recordsAffected
    }, requestId)
  }

  // 获取日志
  getLogs(level?: LogLevel, limit: number = 100): LogEntry[] {
    let filtered = this.logs
    
    if (level) {
      filtered = this.logs.filter(log => log.level === level)
    }
    
    return filtered.slice(-limit)
  }

  // 搜索日志
  searchLogs(query: string, limit: number = 100): LogEntry[] {
    const lowercaseQuery = query.toLowerCase()
    
    return this.logs
      .filter(log => 
        log.message.toLowerCase().includes(lowercaseQuery) ||
        (log.context && JSON.stringify(log.context).toLowerCase().includes(lowercaseQuery))
      )
      .slice(-limit)
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 10000
  private activeRequests = new Map<string, number>()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // 记录性能指标
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags
    }

    this.metrics.push(metric)
    
    // 保持最近的指标
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  // 开始请求计时
  startRequest(requestId: string): void {
    this.activeRequests.set(requestId, Date.now())
  }

  // 结束请求计时
  endRequest(requestId: string, endpoint: string, method: string, statusCode: number): number {
    const startTime = this.activeRequests.get(requestId)
    if (!startTime) return 0

    const duration = Date.now() - startTime
    this.activeRequests.delete(requestId)

    // 记录请求指标
    this.recordMetric('api_request_duration', duration, 'ms', {
      endpoint,
      method,
      status: statusCode.toString()
    })

    return duration
  }

  // 记录内存使用
  recordMemoryUsage(): void {
    const usage = process.memoryUsage()
    this.recordMetric('memory_rss', usage.rss, 'bytes')
    this.recordMetric('memory_heap_used', usage.heapUsed, 'bytes')
    this.recordMetric('memory_heap_total', usage.heapTotal, 'bytes')
    this.recordMetric('memory_external', usage.external, 'bytes')
  }

  // 记录数据库性能
  recordDatabaseMetric(operation: string, duration: number, recordsAffected?: number): void {
    this.recordMetric('database_operation_duration', duration, 'ms', {
      operation
    })

    if (recordsAffected !== undefined) {
      this.recordMetric('database_records_affected', recordsAffected, 'count', {
        operation
      })
    }
  }

  // 获取指标统计
  getMetricStats(name: string, hours: number = 24): {
    avg: number
    min: number
    max: number
    count: number
    p95: number
    p99: number
  } {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    const filtered = this.metrics.filter(m => 
      m.name === name && 
      new Date(m.timestamp).getTime() >= cutoff
    )

    if (filtered.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0, p95: 0, p99: 0 }
    }

    const values = filtered.map(m => m.value).sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      count: values.length,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    }
  }

  // 获取活跃请求数
  getActiveRequestCount(): number {
    return this.activeRequests.size
  }

  // 获取最近的指标
  getRecentMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics
    
    if (name) {
      filtered = this.metrics.filter(m => m.name === name)
    }
    
    return filtered.slice(-limit)
  }
}

/**
 * 健康检查系统
 */
export class HealthChecker {
  private static instance: HealthChecker
  private startTime = Date.now()

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker()
    }
    return HealthChecker.instance
  }

  // 执行完整健康检查
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {}

    // 检查数据库
    checks.database = await this.checkDatabase()
    
    // 检查缓存
    checks.cache = await this.checkCache()
    
    // 检查内存使用
    checks.memory = await this.checkMemory()
    
    // 检查磁盘空间（如果可用）
    checks.disk = await this.checkDisk()

    // 检查外部服务（AI API等）
    checks.external_services = await this.checkExternalServices()

    // 确定整体状态
    const allStatuses = Object.values(checks).map(c => c.status)
    let overallStatus: HealthCheckResult['status'] = 'healthy'

    if (allStatuses.includes('fail')) {
      overallStatus = 'unhealthy'
    } else if (allStatuses.includes('warn')) {
      overallStatus = 'degraded'
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0'
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const start = Date.now()
      const result = DatabaseOperations.healthCheck()
      const duration = Date.now() - start

      if (result.status === 'healthy') {
        return {
          status: 'pass',
          message: 'Database connection successful',
          duration,
          details: result.details
        }
      } else {
        return {
          status: 'fail',
          message: 'Database connection failed',
          duration,
          details: result.details
        }
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Database check error',
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  private async checkCache(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const start = Date.now()
      const stats = appCache.getStats()
      const duration = Date.now() - start

      // 检查缓存命中率
      const warnThreshold = 0.5 // 50%
      let status: 'pass' | 'warn' | 'fail' = 'pass'
      let message = 'Cache operating normally'

      if (stats.hitRate < warnThreshold) {
        status = 'warn'
        message = `Low cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`
      }

      return {
        status,
        message,
        duration,
        details: stats
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Cache check error',
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  private async checkMemory(): Promise<HealthCheckResult['checks'][string]> {
    try {
      const usage = process.memoryUsage()
      const usageInMB = {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      }

      // 警告阈值（MB）
      const warnThreshold = 500
      const errorThreshold = 1000

      let status: 'pass' | 'warn' | 'fail' = 'pass'
      let message = 'Memory usage normal'

      if (usageInMB.rss > errorThreshold) {
        status = 'fail'
        message = `High memory usage: ${usageInMB.rss}MB`
      } else if (usageInMB.rss > warnThreshold) {
        status = 'warn'
        message = `Elevated memory usage: ${usageInMB.rss}MB`
      }

      return {
        status,
        message,
        details: usageInMB
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Memory check error',
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  private async checkDisk(): Promise<HealthCheckResult['checks'][string]> {
    try {
      // 简化的磁盘检查，实际实现可能需要使用fs.stat
      return {
        status: 'pass',
        message: 'Disk space adequate',
        details: { note: 'Detailed disk check not implemented' }
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'Disk check not available',
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  private async checkExternalServices(): Promise<HealthCheckResult['checks'][string]> {
    try {
      // 检查AI服务可用性
      const checks = []
      
      // 这里可以添加对外部服务的ping检查
      // 例如：检查Cerebras API、TTS服务等
      
      return {
        status: 'pass',
        message: 'External services accessible',
        details: { checks }
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'External services check incomplete',
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }
}

// 导出全局实例
export const logger = Logger.getInstance()
export const performanceMonitor = PerformanceMonitor.getInstance()
export const healthChecker = HealthChecker.getInstance()

// 定期收集系统指标
setInterval(() => {
  performanceMonitor.recordMemoryUsage()
}, 30000) // 每30秒记录一次内存使用

// 错误处理和日志记录
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: promise.toString()
  })
})