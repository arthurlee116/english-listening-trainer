/**
 * 性能优化中间件
 * 提供API路由级别的性能优化
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { performanceMonitor, apiCache, requestDebouncer } from './performance-optimizer'

// 响应时间监控中间件
export function withPerformanceMonitoring(
  handler: (req: NextRequest) => Promise<NextResponse>,
  label: string
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const endTimer = performanceMonitor.startTimer(label)
    
    try {
      const response = await handler(req)
      const duration = endTimer()
      
      // 在响应头中添加性能信息
      response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`)
      response.headers.set('X-Performance-Label', label)
      
      return response
    } catch (error) {
      endTimer()
      throw error
    }
  }
}

// API缓存中间件
export function withApiCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    ttl?: number
    keyGenerator?: (req: NextRequest) => string
    shouldCache?: (req: NextRequest, res: NextResponse) => boolean
  } = {}
) {
  const {
    ttl = 5 * 60 * 1000, // 5分钟默认TTL
    keyGenerator = (req) => `${req.method}:${req.url}`,
    shouldCache = (req, res) => req.method === 'GET' && res.status === 200
  } = options
  
  return async (req: NextRequest): Promise<NextResponse> => {
    const cacheKey = keyGenerator(req)
    
    // 尝试从缓存获取
    if (req.method === 'GET') {
      const cached = apiCache.get(cacheKey)
      if (cached) {
        return new NextResponse(cached.body as BodyInit | null | undefined, {
          status: cached.status as number | undefined,
          headers: {
            ...(cached.headers as Record<string, string>),
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey
          }
        })
      }
    }
    
    // 执行原始处理器
    const response = await handler(req)
    
    // 缓存响应
    if (shouldCache(req, response)) {
      const body = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      
      apiCache.set(cacheKey, {
        body,
        status: response.status,
        headers
      }, ttl)
      
      // 重新创建响应（因为body已被读取）
      return new NextResponse(body, {
        status: response.status,
        headers: {
          ...headers,
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey
        }
      })
    }
    
    return response
  }
}

// 请求防抖中间件
export function withRequestDebouncing(
  handler: (req: NextRequest) => Promise<NextResponse>,
  keyGenerator: (req: NextRequest) => string | Promise<string> = (req) => `${req.method}:${req.url}`
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const key = await keyGenerator(req)
    
    return requestDebouncer.debounce(key, () => handler(req))
  }
}

// 错误处理中间件
export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req)
    } catch (error) {
      console.error('API Error:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error'
      
      return NextResponse.json(
        { 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.url
        },
        { status: 500 }
      )
    }
  }
}

// 组合多个中间件
export function createApiHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    label: string
    enableCache?: boolean
    enableDebouncing?: boolean
    cacheOptions?: Parameters<typeof withApiCache>[1]
    debouncingKeyGenerator?: (req: NextRequest) => string | Promise<string>
  }
) {
  const { 
    label, 
    enableCache = false, 
    enableDebouncing = false,
    cacheOptions,
    debouncingKeyGenerator
  } = options
  
  let wrappedHandler = handler
  
  // 应用错误处理
  wrappedHandler = withErrorHandling(wrappedHandler)
  
  // 应用性能监控
  wrappedHandler = withPerformanceMonitoring(wrappedHandler, label)
  
  // 应用缓存（如果启用）
  if (enableCache) {
    wrappedHandler = withApiCache(wrappedHandler, cacheOptions)
  }
  
  // 应用防抖（如果启用）
  if (enableDebouncing) {
    wrappedHandler = withRequestDebouncing(wrappedHandler, debouncingKeyGenerator)
  }
  
  return wrappedHandler
}

// 预定义的API处理器
export const createAIApiHandler = (handler: (req: NextRequest) => Promise<NextResponse>, label: string) =>
  createApiHandler(handler, {
    label: `ai.${label}`,
    enableCache: false, // AI请求通常不应该缓存
    enableDebouncing: true, // 防止重复AI请求
    debouncingKeyGenerator: async (req) => {
      const body = await req.clone().text()
      const bodyHash = createHash('sha256').update(body).digest('hex')
      return `${req.method}:${req.url}:${bodyHash}`
    }
  })

export const createTTSApiHandler = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  createApiHandler(handler, {
    label: 'tts.generate',
    enableCache: true, // TTS可以缓存
    enableDebouncing: true, // 防止重复TTS请求
    cacheOptions: {
      ttl: 30 * 60 * 1000, // 30分钟缓存
      keyGenerator: (req) => {
        // 基于请求体内容生成缓存键
        return req.url // 简化版本，实际应该基于文本内容
      }
    }
  })

export const createDatabaseApiHandler = (handler: (req: NextRequest) => Promise<NextResponse>, label: string) =>
  createApiHandler(handler, {
    label: `db.${label}`,
    enableCache: true, // 数据库读取可以缓存
    cacheOptions: {
      ttl: 60 * 1000, // 1分钟缓存
      shouldCache: (req, res) => req.method === 'GET' && res.status === 200
    }
  })
