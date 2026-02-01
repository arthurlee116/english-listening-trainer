import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireAuth, mockPrisma } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/database', () => ({
  getPrismaClient: () => mockPrisma,
}))

import { GET as summaryHandler } from '@/app/api/visitors/summary/route'

beforeEach(() => {
  mockRequireAuth.mockReset()
  mockPrisma.user.findUnique.mockReset()
  mockPrisma.user.count.mockReset()
})

describe('visitor summary api', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue({ user: null, error: '未登录' })

    const response = await summaryHandler(new Request('http://localhost') as NextRequest)

    expect(response.status).toBe(401)
  })

  it('returns rank and total for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ user: { userId: 'user-1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', createdAt: new Date('2024-01-01') })
    mockPrisma.user.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(7)

    const response = await summaryHandler(new Request('http://localhost') as NextRequest)
    const data = await response.json()

    expect(data).toEqual({ totalUsers: 42, userRank: 7 })
  })
})
