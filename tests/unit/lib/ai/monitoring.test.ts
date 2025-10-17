import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/database', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue({ healthy: true })
}))

vi.mock('@/lib/ai/cerebras-service', () => ({
  invokeStructured: vi.fn().mockResolvedValue({ status: 'ok' })
}))

import { healthChecker } from '@/lib/monitoring'
import { emitAiTelemetry } from '@/lib/ai/telemetry'

describe('monitoring telemetry integration', () => {
  it('exposes last AI call details in health check output', async () => {
    emitAiTelemetry({
      label: 'test_route',
      success: true,
      attempts: [
        { attempt: 1, variant: 'proxy', durationMs: 120, success: false, error: 'fail' },
        { attempt: 2, variant: 'direct', durationMs: 80, success: true }
      ],
      totalBackoffMs: 250,
      fallbackPath: 'proxy->direct',
      proxyEnabled: true,
      timestamp: Date.now(),
      finalError: undefined,
      usage: {
        totalTokens: 200
      }
    })

    const health = await healthChecker.performHealthCheck()
    const external = health.checks.external_services
    expect(external.details).toBeDefined()

    const details = external.details as Record<string, unknown>
    expect(details.lastCall).toMatchObject({
      label: 'test_route',
      attempts: 2,
      fallbackPath: 'proxy->direct',
      totalBackoffMs: 250,
      usage: { totalTokens: 200 }
    })
  })
})
