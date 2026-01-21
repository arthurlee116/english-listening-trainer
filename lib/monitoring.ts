import { Logger, LogLevel, type LogEntry } from '@/lib/monitoring/logger'
import { HealthChecker, type HealthCheckResult } from '@/lib/monitoring/health-checker'
import { addAiTelemetryListener, type ArkCallTelemetry } from '@/lib/ai/telemetry'
import { getMemoryUsage, performanceMonitor } from '@/lib/performance-optimizer'

const logger = Logger.getInstance()
const healthChecker = HealthChecker.getInstance()

let lastAiTelemetry: ArkCallTelemetry | null = null

addAiTelemetryListener((event) => {
  lastAiTelemetry = event
  healthChecker.updateTelemetry(event)

  const lastAttempt = event.attempts[event.attempts.length - 1]
  if (lastAttempt) {
    performanceMonitor.recordMetric('ai_request_attempt_duration', lastAttempt.durationMs)
  }

  performanceMonitor.recordMetric('ai_request_total_backoff', event.totalBackoffMs)
})

setInterval(() => {
  const usage = getMemoryUsage()
  if (!usage) return
  performanceMonitor.recordMetric('memory_rss_mb', usage.rss)
  performanceMonitor.recordMetric('memory_heap_total_mb', usage.heapTotal)
  performanceMonitor.recordMetric('memory_heap_used_mb', usage.heapUsed)
  performanceMonitor.recordMetric('memory_external_mb', usage.external)
}, 30000)

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: promise.toString()
  })
})

export { logger, performanceMonitor, healthChecker, LogLevel }
export type { LogEntry, HealthCheckResult }
export function getLastAiTelemetry(): ArkCallTelemetry | null {
  return lastAiTelemetry
}
