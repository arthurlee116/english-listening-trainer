import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const {
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockUpdateMany,
  mockCount
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCount: vi.fn()
}))

vi.mock('@/lib/database', () => ({
  getPrismaClient: () => ({
    newsRefreshState: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany
    },
    dailyTopic: {
      count: mockCount
    }
  })
}))

import { shouldRefresh } from '@/lib/news/scheduler'

beforeEach(() => {
  mockFindUnique.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockUpdateMany.mockReset()
  mockCount.mockReset()
})

describe('refresh state reads', () => {
  it('does not update refresh state when record exists and is not refreshing', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'singleton',
      isRefreshing: false,
      lastRefreshAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      updatedAt: new Date()
    })
    mockCount.mockResolvedValue(1)

    const result = await shouldRefresh()

    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })
})
