import { Logger, LogLevel, type LogEntry } from '@/lib/monitoring/logger'
import { PerformanceMonitor, type PerformanceMetric } from '@/lib/monitoring/performance-monitor'
import { HealthChecker, type HealthCheckResult } from '@/lib/monitoring/health-checker'
import { addAiTelemetryListener, type ArkCallTelemetry } from '@/lib/ai/telemetry'

const logger = Logger.getInstance()
const performanceMonitor = PerformanceMonitor.getInstance()
const healthChecker = HealthChecker.getInstance()

let lastAiTelemetry: ArkCallTelemetry | null = null

addAiTelemetryListener((event) => {
  lastAiTelemetry = event
  healthChecker.updateTelemetry(event)

  const lastAttempt = event.attempts[event.attempts.length - 1]
  if (lastAttempt) {
    performanceMonitor.recordMetric('ai_request_attempt_duration', lastAttempt.durationMs, 'ms', {
      label: event.label ?? 'unknown',
      variant: lastAttempt.variant,
      success: event.success ? 'true' : 'false'
    })
  }

  performanceMonitor.recordMetric('ai_request_total_backoff', event.totalBackoffMs, 'ms', {
    label: event.label ?? 'unknown'
  })
})

setInterval(() => {
  performanceMonitor.recordMemoryUsage()
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
export type { LogEntry, PerformanceMetric, HealthCheckResult }
export function getLastAiTelemetry(): ArkCallTelemetry | null {
  return lastAiTelemetry
}
