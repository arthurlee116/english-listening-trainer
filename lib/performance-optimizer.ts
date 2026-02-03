/**
 * 性能优化工具库
 * 实现各种性能优化策略和监控
 */

import { LRUCache } from 'lru-cache'

// 内存缓存管理
export class MemoryCache<V extends Record<string, unknown>> {  // changed {} to Record<string, unknown>
  private cache: LRUCache<string, V>
  
  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) { // 5分钟TTL
    this.cache = new LRUCache({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    })
  }
  
  get(key: string): V | undefined {
    return this.cache.get(key)
  }
  
  set(key: string, value: V, ttl?: number): void {
    this.cache.set(key, value, { ttl })
  }
  
  has(key: string): boolean {
    return this.cache.has(key)
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key)
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      calculatedSize: this.cache.calculatedSize,
    }
  }
}

// API响应缓存
export const apiCache = new MemoryCache<Record<string, unknown>>(50, 10 * 60 * 1000) // 10分钟TTL

// 音频文件缓存
export const audioCache = new MemoryCache<Record<string, unknown>>(20, 30 * 60 * 1000) // 30分钟TTL

// AI生成内容缓存
export const aiCache = new MemoryCache<Record<string, unknown>>(30, 20 * 60 * 1000) // 20分钟TTL

// 请求防抖器
export class RequestDebouncer {
  private pending: Map<string, Promise<unknown>> = new Map()
  
  async debounce<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>
    }
    
    const promise = fn().finally(() => {
      this.pending.delete(key)
    })
    
    this.pending.set(key, promise)
    return promise
  }
}

export const requestDebouncer = new RequestDebouncer()

// 性能监控
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  startTimer(label: string): () => number {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.recordMetric(label, duration)
      return duration
    }
  }
  
  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, [])
    }
    
    const values = this.metrics.get(label)!
    values.push(value)
    
    // 保持最近100个记录
    if (values.length > 100) {
      values.shift()
    }
  }
  
  getStats(label: string) {
    const values = this.metrics.get(label) || []
    if (values.length === 0) return null
    
    const sorted = [...values].sort((a, b) => a - b)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p90 = sorted[Math.floor(sorted.length * 0.9)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    
    return {
      count: values.length,
      average: avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50,
      p90,
      p99,
    }
  }
  
  getAllStats() {
    const stats: Record<string, unknown> = {}
    for (const [label] of this.metrics) {
      stats[label] = this.getStats(label)
    }
    return stats
  }
}

export const performanceMonitor = new PerformanceMonitor()

// 资源清理器
export class ResourceCleaner {
  private timers: Set<NodeJS.Timeout> = new Set()
  private intervals: Set<NodeJS.Timeout> = new Set()
  
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      callback()
    }, delay)
    this.timers.add(timer)
    return timer
  }
  
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay)
    this.intervals.add(interval)
    return interval
  }
  
  clearTimeout(timer: NodeJS.Timeout): void {
    clearTimeout(timer)
    this.timers.delete(timer)
  }
  
  clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval)
    this.intervals.delete(interval)
  }
  
  cleanup(): void {
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    for (const interval of this.intervals) {
      clearInterval(interval)
    }
    this.timers.clear()
    this.intervals.clear()
  }
}

export const resourceCleaner = new ResourceCleaner()

// 错误重试机制
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // 指数退避
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// 并发控制
export class ConcurrencyLimiter {
  private running: number = 0
  private queue: Array<() => void> = []
  
  constructor(private maxConcurrency: number, private queueLimit: number = Number.POSITIVE_INFINITY) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.running++
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
          this.processQueue()
        }
      }
      
      if (this.running < this.maxConcurrency) {
        execute()
      } else if (this.queue.length < this.queueLimit) {
        this.queue.push(execute)
      } else {
        reject(new Error('Request queue is full. Please try again later.'))
      }
    })
  }
  
  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const next = this.queue.shift()!
      next()
    }
  }
}

// 创建限制器实例
export const aiRequestLimiter = new ConcurrencyLimiter(3) // AI请求限制为3并发

const ttsMaxConcurrent = Math.max(1, Number.parseInt(process.env.TTS_MAX_CONCURRENT || '', 10) || 1)
const ttsQueueLimit = Math.max(1, Number.parseInt(process.env.TTS_QUEUE_LIMIT || '', 10) || 8)
export const ttsRequestLimiter = new ConcurrencyLimiter(ttsMaxConcurrent, ttsQueueLimit)

export const dbRequestLimiter = new ConcurrencyLimiter(10) // 数据库请求限制为10并发

// 内存使用监控
export function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage()
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    }
  }
  return null
}

// 垃圾收集触发器
export function triggerGC() {
  if (typeof global !== 'undefined' && global.gc) {
    global.gc()
  }
}

// 清理过期音频文件
export async function cleanupOldAudioFiles(maxAge: number = 24 * 60 * 60 * 1000) {
  try {
    const fs = await import('fs')
    const path = await import('path')
    
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    const files = await fs.promises.readdir(audioDir)
    
    const audioFiles = files.filter(
      file =>
        file.startsWith('tts_audio_') &&
        (file.endsWith('.wav') || file.endsWith('.mp3'))
    )
    const now = Date.now()
    
    let deletedCount = 0
    let deletedSize = 0
    
    for (const file of audioFiles) {
      const filePath = path.join(audioDir, file)
      const stats = await fs.promises.stat(filePath)
      
      if (now - stats.mtime.getTime() > maxAge) {
        deletedSize += stats.size
        await fs.promises.unlink(filePath)
        deletedCount++
      }
    }
    
    return {
      deletedCount,
      deletedSize: Math.round(deletedSize / 1024 / 1024), // MB
      message: `Cleaned up ${deletedCount} audio files (${Math.round(deletedSize / 1024 / 1024)}MB)`
    }
  } catch (error) {
    console.error('Failed to cleanup audio files:', error)
    return { deletedCount: 0, deletedSize: 0, error: String(error) }
  }
}
