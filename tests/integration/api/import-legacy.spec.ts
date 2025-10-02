import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockPrismaTransaction,
  mockPracticeSessionCreate,
  mockPracticeQuestionCreate,
  mockPracticeAnswerCreate,
  mockEnsureTableColumn,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockPracticeSessionCreate: vi.fn(),
  mockPracticeQuestionCreate: vi.fn(),
  mockPracticeAnswerCreate: vi.fn(),
  mockEnsureTableColumn: vi.fn(),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $transaction: mockPrismaTransaction,
    practiceSession: {
      create: mockPracticeSessionCreate,
    },
    practiceQuestion: {
      create: mockPracticeQuestionCreate,
    },
    practiceAnswer: {
      create: mockPracticeAnswerCreate,
    },
  })),
}))

vi.mock('../../../lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('../../../lib/database', () => ({
  ensureTableColumn: mockEnsureTableColumn,
}))

describe('Import Legacy API', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    mockEnsureTableColumn.mockResolvedValue(true)

    mockPrismaTransaction.mockImplementation(async (callback) => {
      const tx = {
        practiceSession: { create: mockPracticeSessionCreate },
        practiceQuestion: { create: mockPracticeQuestionCreate },
        practiceAnswer: { create: mockPracticeAnswerCreate },
      }
      return callback(tx as never)
    })

    mockPracticeSessionCreate.mockResolvedValue({
      id: 'session-1',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    })

    mockPracticeQuestionCreate.mockResolvedValue({ id: 'question-1' })
    mockPracticeAnswerCreate.mockResolvedValue({ id: 'answer-1' })

    const authModule = await import('../../../lib/auth')
    const requireAuthMock = authModule.requireAuth as unknown as ReturnType<typeof vi.fn>
    requireAuthMock.mockResolvedValue({
      user: {
        userId: 'test-user',
        email: 'test@example.com',
      },
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should import legacy data successfully when payload is valid', async () => {
    const { POST } = await import('../../../app/api/practice/import-legacy/route')

    const requestBody = {
      sessions: [
        {
          sessionId: 'legacy-1',
          topic: 'Sample Topic',
          difficulty: 'B1',
          language: 'en-US',
          transcript: 'Transcript content',
          score: 90,
          createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
          questions: [
            {
              index: 0,
              type: 'single',
              question: 'What happened?',
              correctAnswer: 'Option A',
              answers: [
                {
                  userAnswer: 'Option A',
                  isCorrect: true,
                  attemptedAt: new Date('2024-01-01T00:05:00Z').toISOString(),
                },
              ],
            },
          ],
        },
      ],
    }

    const request = new NextRequest('http://localhost/api/practice/import-legacy', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.imported).toEqual({ sessions: 1, questions: 1, answers: 1 })
    expect(mockEnsureTableColumn).toHaveBeenCalledWith(expect.anything(), 'practice_questions', 'focus_areas', 'TEXT')
    expect(mockPracticeSessionCreate).toHaveBeenCalled()
    expect(mockPracticeQuestionCreate).toHaveBeenCalled()
    expect(mockPracticeAnswerCreate).toHaveBeenCalled()
  })

  it('should reject payloads with invalid date formats', async () => {
    const { POST } = await import('../../../app/api/practice/import-legacy/route')

    const requestBody = {
      sessions: [
        {
          sessionId: 'legacy-2',
          topic: 'Invalid Date Topic',
          difficulty: 'B1',
          language: 'en-US',
          transcript: 'Transcript content',
          createdAt: 'invalid-date',
          questions: [
            {
              index: 0,
              type: 'single',
              question: 'Broken question?',
              correctAnswer: 'Option A',
              answers: [
                {
                  userAnswer: 'Option A',
                  isCorrect: true,
                  attemptedAt: 'invalid-attempt',
                },
              ],
            },
          ],
        },
      ],
    }

    const request = new NextRequest('http://localhost/api/practice/import-legacy', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(data.details)).toBe(true)
    expect(mockPracticeSessionCreate).not.toHaveBeenCalled()
  })

  it('should return database error when focus_areas column cannot be ensured', async () => {
    mockEnsureTableColumn.mockResolvedValueOnce(false)
    const { POST } = await import('../../../app/api/practice/import-legacy/route')

    const requestBody = {
      sessions: [
        {
          sessionId: 'legacy-3',
          topic: 'Topic',
          difficulty: 'B1',
          language: 'en-US',
          transcript: 'Transcript',
          createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
          questions: [
            {
              index: 0,
              type: 'single',
              question: 'Question',
              correctAnswer: 'A',
              answers: [
                {
                  userAnswer: 'A',
                  isCorrect: true,
                  attemptedAt: new Date('2024-01-01T00:05:00Z').toISOString(),
                },
              ],
            },
          ],
        },
      ],
    }

    const request = new NextRequest('http://localhost/api/practice/import-legacy', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.code).toBe('DATABASE_ERROR')
    expect(data.details).toContain('practice_questions.focus_areas')
    expect(mockPracticeSessionCreate).not.toHaveBeenCalled()
  })
})
