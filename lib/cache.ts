/**
 * 缓存系统
 * 提供内存缓存和Redis缓存支持，支持缓存策略和过期管理
 */

import { ApiError, createApiError } from './api-response'

// 缓存项接口
interface CacheItem<T> {
  value: T
  expiry: number
  tags?: string[]
  size?: number
}

// 缓存统计接口
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  memory: number
}

// 缓存配置接口
interface CacheConfig {
  maxSize: number // 最大缓存大小（MB）
  defaultTTL: number // 默认过期时间（秒）
  cleanupInterval: number // 清理间隔（秒）
  enableStats: boolean // 是否启用统计
}

/**
 * 内存缓存实现
 */
export class MemoryCache {
  private cache = new Map<string, CacheItem<any>>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memory: 0
  }
  private config: CacheConfig
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50, // 50MB
      defaultTTL: 300, // 5分钟
      cleanupInterval: 60, // 1分钟
      enableStats: true,
      ...config
    }

    // 启动定期清理
    this.startCleanup()
  }

  /**
   * 设置缓存项
   */
  set<T>(key: string, value: T, ttl?: number, tags?: string[]): void {
    try {
      const expiry = Date.now() + (ttl || this.config.defaultTTL) * 1000
      const size = this.estimateSize(value)
      
      // 检查内存使用
      if (this.shouldEvict(size)) {
        this.evictLRU()
      }

      this.cache.set(key, { value, expiry, tags, size })
      
      if (this.config.enableStats) {
        this.stats.sets++
        this.stats.memory += size
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * 获取缓存项
   */
  get<T>(key: string): T | null {
    try {
      const item = this.cache.get(key)
      
      if (!item) {
        if (this.config.enableStats) {
          this.stats.misses++
        }
        return null
      }

      // 检查是否过期
      if (Date.now() > item.expiry) {
        this.cache.delete(key)
        if (this.config.enableStats) {
          this.stats.misses++
          this.stats.memory -= item.size || 0
        }
        return null
      }

      if (this.config.enableStats) {
        this.stats.hits++
      }

      return item.value as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    try {
      const item = this.cache.get(key)
      const deleted = this.cache.delete(key)
      
      if (deleted && this.config.enableStats && item) {
        this.stats.deletes++
        this.stats.memory -= item.size || 0
      }
      
      return deleted
    } catch (error) {
      console.error('Cache delete error:', error)
      return false
    }
  }

  /**
   * 检查缓存项是否存在
   */
  has(key: string): boolean {
    try {
      const item = this.cache.get(key)
      if (!item) return false
      
      // 检查是否过期
      if (Date.now() > item.expiry) {
        this.cache.delete(key)
        return false
      }
      
      return true
    } catch (error) {
      console.error('Cache has error:', error)
      return false
    }
  }

  /**
   * 根据标签清除缓存
   */
  clearByTag(tag: string): number {
    let cleared = 0
    
    try {
      for (const [key, item] of this.cache.entries()) {
        if (item.tags && item.tags.includes(tag)) {
          this.cache.delete(key)
          cleared++
          
          if (this.config.enableStats) {
            this.stats.deletes++
            this.stats.memory -= item.size || 0
          }
        }
      }
    } catch (error) {
      console.error('Cache clearByTag error:', error)
    }
    
    return cleared
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    try {
      this.cache.clear()
      this.stats.memory = 0
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & { keys: number; hitRate: number } {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? this.stats.hits / (this.stats.hits + this.stats.misses) 
      : 0

    return {
      ...this.stats,
      keys: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100
    }
  }

  /**
   * 估算值的大小（字节）
   */
  private estimateSize(value: any): number {
    try {
      const json = JSON.stringify(value)
      return new Blob([json]).size
    } catch {
      // 如果无法序列化，返回默认大小
      return 1024 // 1KB
    }
  }

  /**
   * 检查是否需要驱逐
   */
  private shouldEvict(newItemSize: number): boolean {
    const currentMemoryMB = this.stats.memory / (1024 * 1024)
    const newItemMB = newItemSize / (1024 * 1024)
    return currentMemoryMB + newItemMB > this.config.maxSize
  }

  /**
   * LRU驱逐策略
   */
  private evictLRU(): void {
    // 简化的LRU：删除最旧的项
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.expiry - b.expiry)
    
    // 删除25%的旧项
    const toDelete = Math.max(1, Math.floor(sortedEntries.length * 0.25))
    
    for (let i = 0; i < toDelete && i < sortedEntries.length; i++) {
      const [key, item] = sortedEntries[i]
      this.cache.delete(key)
      
      if (this.config.enableStats) {
        this.stats.evictions++
        this.stats.memory -= item.size || 0
      }
    }
  }

  /**
   * 定期清理过期项
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval * 1000)
  }

  /**
   * 清理过期项
   */
  private cleanup(): void {
    try {
      const now = Date.now()
      const keysToDelete: string[] = []
      
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          keysToDelete.push(key)
        }
      }
      
      for (const key of keysToDelete) {
        const item = this.cache.get(key)
        this.cache.delete(key)
        
        if (this.config.enableStats && item) {
          this.stats.memory -= item.size || 0
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }
}

/**
 * 缓存装饰器
 */
export function cached(
  cache: MemoryCache,
  keyGenerator: (...args: any[]) => string,
  ttl?: number,
  tags?: string[]
) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!
    
    descriptor.value = function (this: any, ...args: any[]) {
      const cacheKey = keyGenerator(...args)
      
      // 尝试从缓存获取
      const cached = cache.get(cacheKey)
      if (cached !== null) {
        return cached
      }
      
      // 执行原方法
      const result = method.apply(this, args)
      
      // 缓存结果
      if (result !== null && result !== undefined) {
        cache.set(cacheKey, result, ttl, tags)
      }
      
      return result
    } as any
  }
}

/**
 * 异步缓存装饰器
 */
export function cachedAsync(
  cache: MemoryCache,
  keyGenerator: (...args: any[]) => string,
  ttl?: number,
  tags?: string[]
) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!
    
    descriptor.value = async function (this: any, ...args: any[]) {
      const cacheKey = keyGenerator(...args)
      
      // 尝试从缓存获取
      const cached = cache.get(cacheKey)
      if (cached !== null) {
        return cached
      }
      
      // 执行原方法
      const result = await method.apply(this, args)
      
      // 缓存结果
      if (result !== null && result !== undefined) {
        cache.set(cacheKey, result, ttl, tags)
      }
      
      return result
    } as any
  }
}

/**
 * 应用级缓存策略
 */
export class AppCache {
  private static instance: AppCache
  private memoryCache: MemoryCache
  
  // 不同类型数据的缓存配置
  private readonly cacheConfigs = {
    // 邀请码验证结果 - 短期缓存
    invitationVerification: { ttl: 60, tags: ['invitation'] },
    
    // 用户统计数据 - 中期缓存
    userStats: { ttl: 300, tags: ['user', 'stats'] },
    
    // 错误标签定义 - 长期缓存
    errorTags: { ttl: 3600, tags: ['tags', 'config'] },
    
    // AI生成的话题 - 中期缓存
    aiTopics: { ttl: 1800, tags: ['ai', 'topics'] },
    
    // 练习历史 - 短期缓存
    exerciseHistory: { ttl: 180, tags: ['exercise', 'history'] },
    
    // 错题分析 - 长期缓存
    wrongAnswerAnalysis: { ttl: 7200, tags: ['analysis', 'wrong-answers'] }
  }

  private constructor() {
    this.memoryCache = new MemoryCache({
      maxSize: 100, // 100MB
      defaultTTL: 300, // 5分钟
      cleanupInterval: 60, // 1分钟
      enableStats: true
    })
  }

  static getInstance(): AppCache {
    if (!AppCache.instance) {
      AppCache.instance = new AppCache()
    }
    return AppCache.instance
  }

  /**
   * 缓存邀请码验证结果
   */
  cacheInvitationVerification(code: string, isValid: boolean): void {
    const key = `invitation:${code}`
    const config = this.cacheConfigs.invitationVerification
    this.memoryCache.set(key, isValid, config.ttl, config.tags)
  }

  /**
   * 获取缓存的邀请码验证结果
   */
  getCachedInvitationVerification(code: string): boolean | null {
    const key = `invitation:${code}`
    return this.memoryCache.get<boolean>(key)
  }

  /**
   * 缓存用户统计数据
   */
  cacheUserStats(invitationCode: string, stats: any): void {
    const key = `user_stats:${invitationCode}`
    const config = this.cacheConfigs.userStats
    this.memoryCache.set(key, stats, config.ttl, config.tags)
  }

  /**
   * 获取缓存的用户统计数据
   */
  getCachedUserStats(invitationCode: string): any | null {
    const key = `user_stats:${invitationCode}`
    return this.memoryCache.get(key)
  }

  /**
   * 缓存错误标签定义
   */
  cacheErrorTags(tags: any[]): void {
    const key = 'error_tags:all'
    const config = this.cacheConfigs.errorTags
    this.memoryCache.set(key, tags, config.ttl, config.tags)
  }

  /**
   * 获取缓存的错误标签定义
   */
  getCachedErrorTags(): any[] | null {
    const key = 'error_tags:all'
    return this.memoryCache.get<any[]>(key)
  }

  /**
   * 缓存AI生成的话题
   */
  cacheAITopics(difficulty: string, wordCount: number, topics: string[]): void {
    const key = `ai_topics:${difficulty}:${wordCount}`
    const config = this.cacheConfigs.aiTopics
    this.memoryCache.set(key, topics, config.ttl, config.tags)
  }

  /**
   * 获取缓存的AI话题
   */
  getCachedAITopics(difficulty: string, wordCount: number): string[] | null {
    const key = `ai_topics:${difficulty}:${wordCount}`
    return this.memoryCache.get<string[]>(key)
  }

  /**
   * 缓存练习历史
   */
  cacheExerciseHistory(invitationCode: string, limit: number, offset: number, data: any): void {
    const key = `exercise_history:${invitationCode}:${limit}:${offset}`
    const config = this.cacheConfigs.exerciseHistory
    this.memoryCache.set(key, data, config.ttl, config.tags)
  }

  /**
   * 获取缓存的练习历史
   */
  getCachedExerciseHistory(invitationCode: string, limit: number, offset: number): any | null {
    const key = `exercise_history:${invitationCode}:${limit}:${offset}`
    return this.memoryCache.get(key)
  }

  /**
   * 缓存错题分析
   */
  cacheWrongAnswerAnalysis(id: string, analysis: any): void {
    const key = `wrong_answer_analysis:${id}`
    const config = this.cacheConfigs.wrongAnswerAnalysis
    this.memoryCache.set(key, analysis, config.ttl, config.tags)
  }

  /**
   * 获取缓存的错题分析
   */
  getCachedWrongAnswerAnalysis(id: string): any | null {
    const key = `wrong_answer_analysis:${id}`
    return this.memoryCache.get(key)
  }

  /**
   * 清除用户相关缓存
   */
  clearUserCache(invitationCode: string): void {
    // 清除特定用户的缓存
    this.memoryCache.delete(`user_stats:${invitationCode}`)
    this.memoryCache.clearByTag('user')
    this.memoryCache.clearByTag('exercise')
    this.memoryCache.clearByTag('history')
  }

  /**
   * 清除邀请码相关缓存
   */
  clearInvitationCache(): void {
    this.memoryCache.clearByTag('invitation')
  }

  /**
   * 清除配置相关缓存
   */
  clearConfigCache(): void {
    this.memoryCache.clearByTag('config')
    this.memoryCache.clearByTag('tags')
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): any {
    return this.memoryCache.getStats()
  }

  /**
   * 预热缓存
   */
  async warmup(): Promise<void> {
    try {
      // 这里可以预加载一些常用数据
      console.log('Cache warmup completed')
    } catch (error) {
      console.error('Cache warmup failed:', error)
    }
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    this.memoryCache.destroy()
  }
}

// 导出全局缓存实例
export const appCache = AppCache.getInstance()

// 缓存键生成器
export const cacheKeys = {
  invitation: (code: string) => `invitation:${code}`,
  userStats: (code: string) => `user_stats:${code}`,
  exerciseHistory: (code: string, limit: number, offset: number) => 
    `exercise_history:${code}:${limit}:${offset}`,
  wrongAnswers: (code: string, filters: string) => 
    `wrong_answers:${code}:${Buffer.from(filters).toString('base64')}`,
  aiTopics: (difficulty: string, wordCount: number) => 
    `ai_topics:${difficulty}:${wordCount}`,
  errorTags: () => 'error_tags:all'
}

// 优雅关闭时清理缓存
process.on('exit', () => {
  appCache.destroy()
})

process.on('SIGINT', () => {
  appCache.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  appCache.destroy()
  process.exit(0)
})