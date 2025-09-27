import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { checkRateLimit, RateLimitConfigs, CircuitBreaker, clearRateLimitStore } from '@/lib/rate-limiter'

// Mock NextRequest
function createMockRequest(ip: string = '127.0.0.1'): NextRequest {
  const headers = new Headers()
  headers.set('x-forwarded-for', ip)
  headers.set('authorization', 'Bearer test-token')
  
  const request = {
    ip,
    headers,
    url: 'http://localhost:3000/api/test',
    method: 'POST'
  } as any
  
  return request as NextRequest
}

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear rate limit store between tests
    clearRateLimitStore()
    vi.clearAllMocks()
  })

  it('should allow requests within rate limit', () => {
    const request = createMockRequest()
    const config = {
      ...RateLimitConfigs.AI_ANALYSIS,
      maxRequests: 5,
      windowMs: 60000
    }

    // First request should succeed
    const result1 = checkRateLimit(request, config)
    expect(result1.success).toBe(true)
    expect(result1.remaining).toBe(4)

    // Second request should succeed
    const result2 = checkRateLimit(request, config)
    expect(result2.success).toBe(true)
    expect(result2.remaining).toBe(3)
  })

  it('should block requests exceeding rate limit', () => {
    const request = createMockRequest()
    const config = {
      ...RateLimitConfigs.AI_ANALYSIS,
      maxRequests: 2,
      windowMs: 60000
    }

    // First two requests should succeed
    const result1 = checkRateLimit(request, config)
    expect(result1.success).toBe(true)

    const result2 = checkRateLimit(request, config)
    expect(result2.success).toBe(true)

    // Third request should be blocked
    const result3 = checkRateLimit(request, config)
    expect(result3.success).toBe(false)
    expect(result3.error).toContain('Rate limit exceeded')
  })

  it('should differentiate between different IPs', () => {
    const request1 = createMockRequest('192.168.1.1')
    const request2 = createMockRequest('192.168.1.2')
    const config = {
      ...RateLimitConfigs.AI_ANALYSIS,
      maxRequests: 1,
      windowMs: 60000,
      keyGenerator: (request) => {
        const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
        return `ip:${ip}`
      }
    }

    // Both requests should succeed as they're from different IPs
    const result1 = checkRateLimit(request1, config)
    expect(result1.success).toBe(true)

    const result2 = checkRateLimit(request2, config)
    expect(result2.success).toBe(true)

    // Second request from first IP should be blocked
    const result3 = checkRateLimit(request1, config)
    expect(result3.success).toBe(false)
  })
})

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(2, 1000, 1) // 2 failures, 1s recovery, 1 success to close
  })

  it('should allow operations when closed', async () => {
    const operation = vi.fn().mockResolvedValue('success')
    
    const result = await circuitBreaker.execute(operation)
    
    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(circuitBreaker.getState()).toBe('CLOSED')
  })

  it('should open after failure threshold', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('failure'))
    
    // First failure
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure')
    expect(circuitBreaker.getState()).toBe('CLOSED')
    
    // Second failure - should open circuit
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure')
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Third attempt should be blocked
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN')
    expect(operation).toHaveBeenCalledTimes(2) // Should not call operation when open
  })

  it('should transition to half-open after recovery timeout', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('failure'))
      .mockRejectedValueOnce(new Error('failure'))
      .mockResolvedValueOnce('success')
    
    // Trigger failures to open circuit
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure')
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure')
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    // Next request should succeed and close circuit
    const result = await circuitBreaker.execute(operation)
    expect(result).toBe('success')
    expect(circuitBreaker.getState()).toBe('CLOSED')
  })
})