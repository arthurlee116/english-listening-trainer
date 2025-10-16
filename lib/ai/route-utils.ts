import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createAIApiHandler } from '../performance-middleware'
import { aiRequestLimiter } from '../performance-optimizer'
import {
  type RateLimitConfig,
  type RateLimitResult,
  checkRateLimit,
  recordFailedRequest,
  recordSuccessfulRequest,
  aiServiceCircuitBreaker
} from '../rate-limiter'

export interface AiRouteOptions {
  label: string
  rateLimitConfig?: RateLimitConfig
  useCircuitBreaker?: boolean
}

type RouteExecutor = (request: NextRequest) => Promise<NextResponse>

function applyRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())

  // Subtract the current request that already consumed the quota
  const remaining = Math.max(0, result.remaining - 1)
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString())
  return response
}

function createRateLimitedResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000))
  const response = NextResponse.json(
    {
      error: result.error ?? '请求过于频繁，请稍后再试',
      rateLimitInfo: {
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.resetTime
      }
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString()
      }
    }
  )
  return response
}

function handleCircuitBreakerOpen(): NextResponse {
  return NextResponse.json(
    {
      error: 'AI服务暂时不可用，请稍后重试',
      circuitBreakerState: aiServiceCircuitBreaker.getState(),
      retryAfter: 60
    },
    {
      status: 503,
      headers: {
        'Retry-After': '60'
      }
    }
  )
}

export function createAiRoute(handler: RouteExecutor, options: AiRouteOptions) {
  return createAIApiHandler(async (request: NextRequest) => {
    const { rateLimitConfig, useCircuitBreaker } = options

    let rateLimitResult: RateLimitResult | undefined

    if (rateLimitConfig) {
      rateLimitResult = checkRateLimit(request, rateLimitConfig)
      if (!rateLimitResult.success) {
        return createRateLimitedResponse(rateLimitResult)
      }
    }

    const runHandler = async () => handler(request)

    const executeWithCircuitBreaker = async () => {
      if (!useCircuitBreaker) {
        return runHandler()
      }
      return aiServiceCircuitBreaker.execute(runHandler)
    }

    try {
      const response = await aiRequestLimiter.execute(() => executeWithCircuitBreaker())

      if (rateLimitConfig && rateLimitResult) {
        recordSuccessfulRequest(request, rateLimitConfig)
        return applyRateLimitHeaders(response, rateLimitResult)
      }

      return response
    } catch (error) {
      if (rateLimitConfig) {
        recordFailedRequest(request, rateLimitConfig)
      }

      if (
        useCircuitBreaker &&
        error instanceof Error &&
        error.message.includes('Circuit breaker is OPEN')
      ) {
        return handleCircuitBreakerOpen()
      }

      throw error
    }
  }, options.label)
}
