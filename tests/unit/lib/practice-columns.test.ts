import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockPrisma,
  mockEnsure,
  mockTableHasColumn,
  mockRequireAuth,
  mockValidateLegacyPayload,
  mockImportLegacySessions,
  mockTransaction,
  mockPracticeSessionCreate,
  mockPracticeQuestionCreate,
  mockPracticeAnswerCreate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockPracticeSessionCreate: vi.fn(),
  mockPracticeQuestionCreate: vi.fn(),
  mockPracticeAnswerCreate: vi.fn(),
  mockPrisma: {
    $transaction: vi.fn()
  },
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
  mockTransaction.mockReset()
  mockPracticeSessionCreate.mockReset()
  mockPracticeQuestionCreate.mockReset()
  mockPracticeAnswerCreate.mockReset()
  mockPrisma.$transaction = mockTransaction
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

  it('preserves zero-valued accuracy, score, and duration when saving a session', async () => {
    mockEnsure.mockResolvedValue(true)
    mockPracticeSessionCreate.mockResolvedValue({
      id: 'session-1',
      createdAt: new Date('2025-01-01T00:00:00.000Z')
    })
    mockTransaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => {
      return callback(txMock)
    })

    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseData: { transcript: 'hello', questions: [], results: [] },
        difficulty: 'B1',
        language: 'en-US',
        topic: 'Zero values',
        accuracy: 0,
        score: 0,
        duration: 0
      })
    })

    await saveHandler(request as unknown as NextRequest)

    expect(mockPracticeSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accuracy: 0,
        score: 0,
        duration: 0
      })
    })
  })
})

const txMock = {
  practiceSession: {
    create: mockPracticeSessionCreate
  },
  practiceQuestion: {
    create: mockPracticeQuestionCreate
  },
  practiceAnswer: {
    create: mockPracticeAnswerCreate
  }
}
