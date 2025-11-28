import { NextRequest } from 'next/server'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  error?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
  firstRequest: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Clear the rate limit store (for testing purposes)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear()
}

// Cleanup old entries every 5 minutes (guarded to avoid multiple timers in serverless/HMR)
const globalRateLimitTimers = globalThis as typeof globalThis & { __rateLimitCleanupStarted?: boolean }
if (!globalRateLimitTimers.__rateLimitCleanupStarted && process.env.NEXT_RUNTIME !== 'edge') {
  globalRateLimitTimers.__rateLimitCleanupStarted = true
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Default key generator using IP address and user ID
 */
function defaultKeyGenerator(request: NextRequest): string {
  const ip = (request as { ip?: string }).ip || 
    request.headers.get('x-forwarded-for')?.split(',')[0] || 
    request.headers.get('x-real-ip') || 
    'unknown'
  
  // Try to get user ID from auth header or other sources
  const authHeader = request.headers.get('authorization')
  const userId = authHeader ? `user:${authHeader.slice(0, 10)}` : `ip:${ip}`
  
  return userId
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const keyGenerator = config.keyGenerator || defaultKeyGenerator
  const key = keyGenerator(request)
  const now = Date.now()
  const _windowStart = now - config.windowMs
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      firstRequest: now
    }
    rateLimitStore.set(key, entry)
  }
  
  // Check if we're within the rate limit
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
      error: `Rate limit exceeded. Try again after ${new Date(entry.resetTime).toISOString()}`
    }
  }
  
  // Increment counter
  entry.count++
  
  return {
    success: true,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime
  }
}

/**
 * Record a failed request (if configured to skip failed requests)
 */
export function recordFailedRequest(
  request: NextRequest,
  config: RateLimitConfig
): void {
  if (!config.skipFailedRequests) return
  
  const keyGenerator = config.keyGenerator || defaultKeyGenerator
  const key = keyGenerator(request)
  const entry = rateLimitStore.get(key)
  
  if (entry && entry.count > 0) {
    entry.count--
  }
}

/**
 * Record a successful request (if configured to skip successful requests)
 */
export function recordSuccessfulRequest(
  request: NextRequest,
  config: RateLimitConfig
): void {
  if (!config.skipSuccessfulRequests) return
  
  const keyGenerator = config.keyGenerator || defaultKeyGenerator
  const key = keyGenerator(request)
  const entry = rateLimitStore.get(key)
  
  if (entry && entry.count > 0) {
    entry.count--
  }
}

/**
 * Create a rate limit middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (request: NextRequest) => {
    return checkRateLimit(request, config)
  }
}

// Predefined rate limit configurations
export const RateLimitConfigs = {
  // For AI analysis endpoints - conservative limits
  AI_ANALYSIS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute per user
    skipFailedRequests: true // Don't count failed requests against limit
  } as RateLimitConfig,
  
  // For batch processing - more restrictive
  BATCH_PROCESSING: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 batch requests per 5 minutes per user
    skipFailedRequests: true
  } as RateLimitConfig,
  
  // For general API endpoints
  GENERAL_API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute per user
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  } as RateLimitConfig
}

/**
 * Enhanced key generator that includes user ID from auth
 */
export function createUserBasedKeyGenerator(prefix: string = '') {
  return (request: NextRequest): string => {
    const ip = (request as { ip?: string }).ip || 
      request.headers.get('x-forwarded-for')?.split(',')[0] || 
      request.headers.get('x-real-ip') || 
      'unknown'
    
    // Try to extract user ID from various sources
    const authHeader = request.headers.get('authorization')
    const userIdFromAuth = authHeader ? extractUserIdFromAuth(authHeader) : null
    
    const key = userIdFromAuth ? `${prefix}user:${userIdFromAuth}` : `${prefix}ip:${ip}`
    return key
  }
}

/**
 * Extract user ID from authorization header
 */
function extractUserIdFromAuth(authHeader: string): string | null {
  try {
    // Handle Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // In a real implementation, you'd decode the JWT token
      // For now, just use a hash of the token
      return token.slice(0, 16)
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Circuit breaker pattern for AI service failures
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private successThreshold: number = 2
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable')
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }
  
  getState(): string {
    return this.state
  }
  
  getFailures(): number {
    return this.failures
  }
}

// Global circuit breaker for AI service
export const aiServiceCircuitBreaker = new CircuitBreaker(
  5, // 5 failures
  60000, // 1 minute recovery
  2 // 2 successes to close
)
