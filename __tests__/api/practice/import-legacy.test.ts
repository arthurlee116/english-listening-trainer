import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn()
}))

// Mock Prisma with hoisted functions
const prismaMocks = vi.hoisted(() => {
  const mockTransaction = vi.fn()
  const mockCreate = vi.fn()
  
  return {
    mockTransaction,
    mockCreate,
    PrismaClient: vi.fn().mockImplementation(() => ({
      $transaction: mockTransaction,
      practiceSession: { create: mockCreate },
      practiceQuestion: { create: mockCreate },
      practiceAnswer: { create: mockCreate }
    }))
  }
})

vi.mock('@prisma/client', () => ({
  PrismaClient: prismaMocks.PrismaClient
}))

// Import after mocking
import { POST } from '@/app/api/practice/import-legacy/route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)

describe('/api/practice/import-legacy', () => {
  const mockUser = { userId: 'test-user-id', email: 'test@example.com', isAdmin: false }
  
  const validSession = {
    sessionId: 'session-123',
    topic: 'Travel',
    difficulty: 'B1',
    language: 'en-US',
    transcript: 'We are planning a trip to Paris next week.',
    score: 85,
    createdAt: '2024-01-15T10:30:00Z',
    questions: [
      {
        index: 1,
        type: 'multiple_choice',
        question: 'What is the main topic?',
        options: ['Travel', 'Weather', 'Food', 'Sports'],
        correctAnswer: 'Travel',
        explanation: 'The conversation is about planning a trip.',
        answers: [
          {
            userAnswer: 'Weather',
            isCorrect: false,
            attemptedAt: '2024-01-15T10:35:00Z'
          }
        ]
      }
    ]
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ user: null, error: 'Unauthorized' })

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
      expect(data.code).toBe('UNAUTHORIZED')
    })

    it('should return 401 when auth result has error', async () => {
      mockRequireAuth.mockResolvedValue({ user: null, error: 'Token expired' })

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Token expired')
      expect(data.code).toBe('UNAUTHORIZED')
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 400 when sessions array is missing', async () => {
      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid request: sessions array is required')
      expect(data.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 when sessions is not an array', async () => {
      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: 'not-an-array' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid request: sessions array is required')
      expect(data.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 when sessions array is empty', async () => {
      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('No sessions provided for import')
      expect(data.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 when JSON is invalid', async () => {
      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid JSON in request body')
      expect(data.code).toBe('INVALID_REQUEST')
    })
  })

  describe('Data Validation', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 400 when session data is missing required fields', async () => {
      const invalidSession = {
        sessionId: 'test-session',
        topic: 'test-topic'
        // Missing difficulty, language, transcript, createdAt, questions
      }

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [invalidSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation failed for provided data')
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.details).toBeInstanceOf(Array)
      expect(data.details.length).toBeGreaterThan(0)
    })

    it('should return 400 when question data is invalid', async () => {
      const sessionWithInvalidQuestion = {
        ...validSession,
        questions: [
          {
            // Missing required fields
            index: 1,
            type: 'multiple_choice'
            // Missing question, correctAnswer, answers
          }
        ]
      }

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [sessionWithInvalidQuestion] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.details).toContain('Session 0, Question 0: question is required and must be a string')
    })

    it('should return 400 when answer data is invalid', async () => {
      const sessionWithInvalidAnswer = {
        ...validSession,
        questions: [
          {
            ...validSession.questions[0],
            answers: [
              {
                // Missing required fields
                userAnswer: 'test'
                // Missing isCorrect, attemptedAt
              }
            ]
          }
        ]
      }

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [sessionWithInvalidAnswer] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.details.some((error: string) => 
        error.includes('isCorrect is required and must be a boolean')
      )).toBe(true)
    })

    it('should return 400 when date format is invalid', async () => {
      const sessionWithInvalidDate = {
        ...validSession,
        createdAt: 'invalid-date'
      }

      // Mock transaction to succeed but the date validation should fail
      prismaMocks.mockTransaction.mockRejectedValue(new Error('Invalid date'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [sessionWithInvalidDate] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DATABASE_ERROR')
    })
  })

  describe('Database Operations', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should successfully import valid session data', async () => {
      prismaMocks.mockTransaction.mockImplementation(async (callback: any) => {
        return await callback({
          practiceSession: {
            create: vi.fn().mockResolvedValue({ id: 'session-id' })
          },
          practiceQuestion: {
            create: vi.fn().mockResolvedValue({ id: 'question-id' })
          },
          practiceAnswer: {
            create: vi.fn().mockResolvedValue({ id: 'answer-id' })
          }
        })
      })

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Legacy data imported successfully')
      expect(data.imported).toEqual({
        sessions: 1,
        questions: 1,
        answers: 1
      })
    })

    it('should handle database transaction timeout', async () => {
      prismaMocks.mockTransaction.mockRejectedValue(new Error('Transaction timeout'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(408)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DATABASE_ERROR')
    })

    it('should handle unique constraint violations', async () => {
      prismaMocks.mockTransaction.mockRejectedValue(new Error('Unique constraint failed'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DUPLICATE_DATA')
    })

    it('should handle database timeout errors', async () => {
      prismaMocks.mockTransaction.mockRejectedValue(new Error('Operation timeout'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(408)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DATABASE_ERROR')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should handle syntax errors', async () => {
      // Mock a syntax error during processing
      prismaMocks.mockTransaction.mockRejectedValue(new SyntaxError('Invalid syntax'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DATABASE_ERROR')
    })

    it('should handle type errors', async () => {
      prismaMocks.mockTransaction.mockRejectedValue(new TypeError('Type error'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DATABASE_ERROR')
    })

    it('should handle unexpected errors', async () => {
      prismaMocks.mockTransaction.mockRejectedValue(new Error('Unexpected error'))

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [validSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.code).toBe('DATABASE_ERROR')
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should handle sessions with multiple questions and answers', async () => {
      const multiQuestionSession = {
        ...validSession,
        questions: [
          {
            ...validSession.questions[0],
            index: 1
          },
          {
            ...validSession.questions[0],
            index: 2,
            question: 'Second question?',
            answers: [
              {
                userAnswer: 'Answer 1',
                isCorrect: true,
                attemptedAt: '2024-01-15T10:36:00Z'
              },
              {
                userAnswer: 'Answer 2',
                isCorrect: false,
                attemptedAt: '2024-01-15T10:37:00Z'
              }
            ]
          }
        ]
      }

      prismaMocks.mockTransaction.mockImplementation(async (callback: any) => {
        return await callback({
          practiceSession: {
            create: vi.fn().mockResolvedValue({ id: 'session-id' })
          },
          practiceQuestion: {
            create: vi.fn()
              .mockResolvedValueOnce({ id: 'question-1' })
              .mockResolvedValueOnce({ id: 'question-2' })
          },
          practiceAnswer: {
            create: vi.fn()
              .mockResolvedValueOnce({ id: 'answer-1' })
              .mockResolvedValueOnce({ id: 'answer-2' })
              .mockResolvedValueOnce({ id: 'answer-3' })
          }
        })
      })

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [multiQuestionSession] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.imported).toEqual({
        sessions: 1,
        questions: 2,
        answers: 3
      })
    })

    it('should handle optional fields correctly', async () => {
      const sessionWithOptionalFields = {
        ...validSession,
        score: undefined, // Optional field
        questions: [
          {
            ...validSession.questions[0],
            options: undefined, // Optional field
            explanation: undefined // Optional field
          }
        ]
      }

      prismaMocks.mockTransaction.mockImplementation(async (callback: any) => {
        return await callback({
          practiceSession: {
            create: vi.fn().mockResolvedValue({ id: 'session-id' })
          },
          practiceQuestion: {
            create: vi.fn().mockResolvedValue({ id: 'question-id' })
          },
          practiceAnswer: {
            create: vi.fn().mockResolvedValue({ id: 'answer-id' })
          }
        })
      })

      const request = new NextRequest('http://localhost/api/practice/import-legacy', {
        method: 'POST',
        body: JSON.stringify({ sessions: [sessionWithOptionalFields] })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})