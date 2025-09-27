import { NextRequest } from 'next/server'

import {
  CircuitBreaker,
  checkRateLimit,
  clearRateLimitStore,
  createUserBasedKeyGenerator,
  recordFailedRequest
} from '@/lib/rate-limiter'

describe('rate-limiter', () => {
  beforeEach(() => {
    clearRateLimitStore()
  })

  function createRequest(headers: Record<string, string>) {
    return new NextRequest('http://localhost/api/test', { headers })
  }

  it('enforces the configured limit within a window', () => {
    const config = { windowMs: 1000, maxRequests: 2 }
    const request = createRequest({ 'x-forwarded-for': '203.0.113.10' })

    const first = checkRateLimit(request, config)
    const second = checkRateLimit(request, config)
    const third = checkRateLimit(request, config)

    expect(first.success).toBe(true)
    expect(first.remaining).toBe(1)
    expect(second.success).toBe(true)
    expect(second.remaining).toBe(0)
    expect(third.success).toBe(false)
    expect(third.remaining).toBe(0)
  })

  it('restores allowance when failed requests are skipped', () => {
    const config = { windowMs: 1000, maxRequests: 2, skipFailedRequests: true }
    const request = createRequest({ 'x-forwarded-for': '203.0.113.11' })

    const first = checkRateLimit(request, config)
    recordFailedRequest(request, config)
    const second = checkRateLimit(request, config)

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(second.remaining).toBe(1)
  })

  it('builds stable keys that prefer user identity from bearer tokens', () => {
    const keyGenerator = createUserBasedKeyGenerator('ai:')
    const request = createRequest({
      authorization: 'Bearer token-1234567890abcdef',
      'x-forwarded-for': '198.51.100.8'
    })

    const key = keyGenerator(request)

    expect(key).toBe('ai:user:token-1234567890')
  })
})

describe('CircuitBreaker', () => {
  it('opens after repeated failures and recovers after the timeout', async () => {
    const breaker = new CircuitBreaker(2, 50, 1)
    const failingOperation = () => Promise.reject(new Error('transient failure'))

    await expect(breaker.execute(failingOperation)).rejects.toThrow('transient failure')
    await expect(breaker.execute(failingOperation)).rejects.toThrow('transient failure')
    expect(breaker.getState()).toBe('OPEN')

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow('Circuit breaker is OPEN')

    await new Promise(resolve => setTimeout(resolve, 60))

    const result = await breaker.execute(() => Promise.resolve('healthy'))
    expect(result).toBe('healthy')
    expect(breaker.getState()).toBe('CLOSED')
  })
})
