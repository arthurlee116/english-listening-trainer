export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: string
  tags?: Record<string, string>
}

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

  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags
    }

    this.metrics.push(metric)

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  startRequest(requestId: string): void {
    this.activeRequests.set(requestId, Date.now())
  }

  endRequest(requestId: string, endpoint: string, method: string, statusCode: number): number {
    const startTime = this.activeRequests.get(requestId)
    if (!startTime) return 0

    const duration = Date.now() - startTime
    this.activeRequests.delete(requestId)

    this.recordMetric('api_request_duration', duration, 'ms', {
      endpoint,
      method,
      status: statusCode.toString()
    })

    return duration
  }

  recordMemoryUsage(): void {
    const usage = process.memoryUsage()
    this.recordMetric('memory_rss', usage.rss, 'bytes')
    this.recordMetric('memory_heap_used', usage.heapUsed, 'bytes')
    this.recordMetric('memory_heap_total', usage.heapTotal, 'bytes')
    this.recordMetric('memory_external', usage.external, 'bytes')
  }

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

  getActiveRequestCount(): number {
    return this.activeRequests.size
  }

  getRecentMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics

    if (name) {
      filtered = this.metrics.filter(m => m.name === name)
    }

    return filtered.slice(-limit)
  }
}
