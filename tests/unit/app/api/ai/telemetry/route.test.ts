import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { GET } from '@/app/api/ai/telemetry/route'
import { getTelemetrySummary } from '@/lib/ai/model-telemetry'
import { NextResponse } from 'next/server'

// Mock the dependency
vi.mock('@/lib/ai/model-telemetry', () => ({
  getTelemetrySummary: vi.fn(),
}))

// Mock NextResponse.json to capture arguments
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({ data, options })),
  },
}))

// Type assertions for the mocked functions
const mockGetTelemetrySummary = getTelemetrySummary as Mock
const mockNextResponseJson = NextResponse.json as Mock

describe('AI Telemetry API Route', () => {
  const mockSummary = {
    latest: { observedAt: '2025-11-01T09:00:00.000Z', latencyMs: 1500, successRate: 0.98 },
    averageLatencyMs: 1564.3,
    averageSuccessRate: 0.96,
  }

  let consoleErrorSpy: vi.SpyInstance

  beforeEach(() => {
    vi.clearAllMocks()
    // Spy on console.error for error testing
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // Test case a: happy path
  it('should return telemetry summary with status 200 and correct data shape', async () => {
    mockGetTelemetrySummary.mockReturnValue(mockSummary)

    await GET()

    expect(mockGetTelemetrySummary).toHaveBeenCalledOnce()
    expect(mockNextResponseJson).toHaveBeenCalledOnce()

    // Assert data shape using type assertion on the call arguments
    const [data, options] = mockNextResponseJson.mock.calls[0] as [{ data: any, meta: any }, any]

    expect(data.data).toEqual(mockSummary)
    expect(data.meta).toBeDefined()
    expect(data.meta.generatedAt).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/ // Check if it's an ISO string format
    )
    expect(options).toBeUndefined() // Default status 200
  })

  // Test case b: thrown error
  it('should handle errors, log the error, and return status 500', async () => {
    const mockError = new Error('Database connection failed')
    mockGetTelemetrySummary.mockImplementation(() => {
      throw mockError
    })

    await GET()

    expect(mockGetTelemetrySummary).toHaveBeenCalledOnce()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch telemetry summary:',
      mockError
    )
    expect(mockNextResponseJson).toHaveBeenCalledOnce()

    // Assert error payload and status 500
    const [data, options] = mockNextResponseJson.mock.calls[0] as [{ error: string }, { status: number }]

    expect(data).toEqual({ error: 'INTERNAL_ERROR' })
    expect(options).toEqual({ status: 500 })
  })
})
