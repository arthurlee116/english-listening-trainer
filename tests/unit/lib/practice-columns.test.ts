import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockPrisma,
  mockEnsure,
  mockTableHasColumn,
  mockRequireAuth,
  mockValidateLegacyPayload,
  mockImportLegacySessions
} = vi.hoisted(() => ({
  mockPrisma: {},
  mockEnsure: vi.fn().mockResolvedValue(false),
  mockTableHasColumn: vi.fn().mockResolvedValue(false),
  mockRequireAuth: vi.fn().mockResolvedValue({ user: { userId: 'user' } }),
  mockValidateLegacyPayload: vi.fn().mockReturnValue([]),
  mockImportLegacySessions: vi.fn()
}))

vi.mock('@/lib/database', () => ({
  getPrismaClient: () => mockPrisma,
  ensureTableColumn: mockEnsure,
  tableHasColumn: mockTableHasColumn
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: mockRequireAuth
}))

vi.mock('@/lib/legacy-import', () => ({
  importLegacySessions: mockImportLegacySessions,
  validateLegacyPayload: mockValidateLegacyPayload
}))

import { POST as saveHandler } from '@/app/api/practice/save/route'
import { POST as importLegacyHandler } from '@/app/api/practice/import-legacy/route'

beforeEach(() => {
  mockEnsure.mockClear()
  mockTableHasColumn.mockClear()
  mockRequireAuth.mockClear()
  mockValidateLegacyPayload.mockClear()
  mockImportLegacySessions.mockClear()
})

describe('practice schema checks', () => {
  it('ensures focus_areas column exists before saving practice session', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseData: { questions: [], results: [] },
        difficulty: 'easy',
        topic: 'test'
      })
    })

    await saveHandler(request as unknown as NextRequest)

    expect(mockEnsure).toHaveBeenCalledWith(mockPrisma, 'practice_questions', 'focus_areas', 'TEXT')
  })

  it('ensures focus_areas column exists before importing legacy sessions', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: [] })
    })

    await importLegacyHandler(request as unknown as NextRequest)

    expect(mockEnsure).toHaveBeenCalledWith(mockPrisma, 'practice_questions', 'focus_areas', 'TEXT')
  })
})
