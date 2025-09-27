import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn()
}))

// Mock the database module
vi.mock('@/lib/database', () => ({
  withDatabase: vi.fn()
}))

// Import mocked functions
import { requireAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/database'

const mockRequireAuth = vi.mocked(requireAuth)
const mockWithDatabase = vi.mocked(withDatabase)

describe('/api/wrong-answers/list', () => {
  const mockUser = { userId: 'user123', email: 'test@example.com', isAdmin: false }
  
  const mockWrongAnswers = [
    {
      id: 'answer1',
      userAnswer: 'wrong answer',
      isCorrect: false,
      attemptedAt: new Date('2024-01-01T10:00:00Z'),
      aiAnalysis: JSON.stringify({
        analysis: '详细的中文分析内容',
        key_reason: '细节理解缺失',
        ability_tags: ['听力细节捕捉'],
        signal_words: ['capital', 'France'],
        strategy: '注意听关键词',
        related_sentences: [],
        confidence: 'high'
      }),
      aiAnalysisGeneratedAt: new Date('2024-01-01T10:05:00Z'),
      needsAnalysis: false,
      question: {
        id: 'question1',
        index: 1,
        type: 'multiple_choice',
        question: 'What is the capital of France?',
        options: '["Paris", "London", "Berlin", "Madrid"]',
        correctAnswer: 'Paris',
        explanation: 'Paris is the capital of France',
        session: {
          id: 'session1',
          topic: 'Geography',
          difficulty: 'B1',
          language: 'en-US',
          transcript: 'Test transcript',
          createdAt: new Date('2024-01-01T09:00:00Z')
        }
      }
    },
    {
      id: 'answer2',
      userAnswer: 'another wrong answer',
      isCorrect: false,
      attemptedAt: new Date('2024-01-02T10:00:00Z'),
      aiAnalysis: null,
      aiAnalysisGeneratedAt: null,
      needsAnalysis: true,
      question: {
        id: 'question2',
        index: 2,
        type: 'single_choice',
        question: 'What is 2+2?',
        options: null,
        correctAnswer: '4',
        explanation: null,
        session: {
          id: 'session2',
          topic: 'Math',
          difficulty: 'A1',
          language: 'zh-CN',
          transcript: 'Math transcript',
          createdAt: new Date('2024-01-02T09:00:00Z')
        }
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ user: null, error: 'Unauthorized' })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when auth result has error', async () => {
      mockRequireAuth.mockResolvedValue({ user: null, error: 'Token expired' })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Token expired')
    })

    it('should return 401 when user is null without error', async () => {
      mockRequireAuth.mockResolvedValue({ user: null })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Successful Responses', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return paginated wrong answers with default parameters', async () => {
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockResolvedValue([mockWrongAnswers[0]]),
            count: vi.fn().mockResolvedValue(1)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.wrongAnswers).toHaveLength(1)
      expect(data.wrongAnswers[0]).toEqual({
        answerId: 'answer1',
        questionId: 'question1',
        sessionId: 'session1',
        session: {
          topic: 'Geography',
          difficulty: 'B1',
          language: 'en-US',
          createdAt: '2024-01-01T09:00:00.000Z'
        },
        question: {
          index: 1,
          type: 'multiple_choice',
          question: 'What is the capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Madrid'],
          correctAnswer: 'Paris',
          explanation: 'Paris is the capital of France',
          transcript: 'Test transcript'
        },
        answer: {
          userAnswer: 'wrong answer',
          isCorrect: false,
          attemptedAt: '2024-01-01T10:00:00.000Z',
          aiAnalysis: {
            analysis: '详细的中文分析内容',
            key_reason: '细节理解缺失',
            ability_tags: ['听力细节捕捉'],
            signal_words: ['capital', 'France'],
            strategy: '注意听关键词',
            related_sentences: [],
            confidence: 'high'
          },
          aiAnalysisGeneratedAt: '2024-01-01T10:05:00.000Z',
          needsAnalysis: false
        }
      })
      expect(data.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 1,
        hasMore: false
      })
    })

    it('should handle answers without AI analysis', async () => {
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockResolvedValue([mockWrongAnswers[1]]),
            count: vi.fn().mockResolvedValue(1)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.wrongAnswers[0].answer.aiAnalysis).toBeUndefined()
      expect(data.wrongAnswers[0].answer.aiAnalysisGeneratedAt).toBeUndefined()
      expect(data.wrongAnswers[0].answer.needsAnalysis).toBe(true)
    })

    it('should handle questions without options', async () => {
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockResolvedValue([mockWrongAnswers[1]]),
            count: vi.fn().mockResolvedValue(1)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.wrongAnswers[0].question.options).toBeUndefined()
    })
  })

  describe('Pagination', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should handle pagination parameters correctly', async () => {
      let capturedOptions: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedOptions = options
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(150)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?page=2&limit=25')
      const response = await GET(request)
      const data = await response.json()

      expect(capturedOptions.skip).toBe(25) // (page 2 - 1) * limit 25
      expect(capturedOptions.take).toBe(25)
      expect(data.pagination.currentPage).toBe(2)
      expect(data.pagination.totalPages).toBe(6) // 150 / 25
      expect(data.pagination.hasMore).toBe(true)
    })

    it('should use default pagination when parameters are missing', async () => {
      let capturedOptions: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedOptions = options
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(10)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(capturedOptions.skip).toBe(0) // Default page 1
      expect(capturedOptions.take).toBe(50) // Default limit
      expect(data.pagination.currentPage).toBe(1)
      expect(data.pagination.totalPages).toBe(1)
      expect(data.pagination.hasMore).toBe(false)
    })

    it('should limit page size to maximum 100', async () => {
      let capturedOptions: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedOptions = options
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?limit=200')
      const response = await GET(request)

      expect(capturedOptions.take).toBe(100) // Should be capped at 100
    })


  })

  describe('Filtering', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should apply difficulty filter correctly', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?difficulty=B1')
      await GET(request)

      expect(capturedWhereClause.question.session.difficulty).toBe('B1')
      expect(capturedWhereClause.question.session.userId).toBe('user123')
      expect(capturedWhereClause.isCorrect).toBe(false)
    })

    it('should apply language filter correctly', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?language=en-US')
      await GET(request)

      expect(capturedWhereClause.question.session.language).toBe('en-US')
    })

    it('should apply question type filter correctly', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?type=multiple_choice')
      await GET(request)

      expect(capturedWhereClause.question.type).toBe('multiple_choice')
    })

    it('should apply search filter for question content and topics', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?search=geography')
      await GET(request)

      expect(capturedWhereClause.OR).toEqual([
        {
          question: {
            question: {
              contains: 'geography',
              mode: 'insensitive'
            }
          }
        },
        {
          question: {
            session: {
              topic: {
                contains: 'geography',
                mode: 'insensitive'
              }
            }
          }
        }
      ])
    })

    it('should apply multiple filters simultaneously', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list?difficulty=B1&language=en-US&type=multiple_choice&search=capital')
      await GET(request)

      expect(capturedWhereClause.question.session.difficulty).toBe('B1')
      expect(capturedWhereClause.question.session.language).toBe('en-US')
      expect(capturedWhereClause.question.type).toBe('multiple_choice')
      expect(capturedWhereClause.OR).toBeDefined()
    })

    it('should ensure only wrong answers are returned', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      await GET(request)

      expect(capturedWhereClause.isCorrect).toBe(false)
    })

    it('should ensure user isolation', async () => {
      let capturedWhereClause: any = {}
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockImplementation((options) => {
              capturedWhereClause = options.where
              return Promise.resolve([])
            }),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      await GET(request)

      expect(capturedWhereClause.question.session.userId).toBe('user123')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should handle database errors gracefully', async () => {
      mockWithDatabase.mockRejectedValue(new Error('Database connection failed'))

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to retrieve wrong answers. Please try again later.')
    })

    it('should handle JSON parsing errors in AI analysis', async () => {
      const answerWithInvalidJson = {
        ...mockWrongAnswers[0],
        aiAnalysis: 'invalid json'
      }

      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockResolvedValue([answerWithInvalidJson]),
            count: vi.fn().mockResolvedValue(1)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to retrieve wrong answers. Please try again later.')
    })

    it('should handle unexpected errors', async () => {
      mockWithDatabase.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to retrieve wrong answers. Please try again later.')
    })
  })

  describe('Data Formatting', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should properly format response structure', async () => {
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockResolvedValue(mockWrongAnswers),
            count: vi.fn().mockResolvedValue(2)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('wrongAnswers')
      expect(data).toHaveProperty('pagination')
      expect(Array.isArray(data.wrongAnswers)).toBe(true)
      expect(data.wrongAnswers).toHaveLength(2)
    })

    it('should handle empty results', async () => {
      mockWithDatabase.mockImplementation(async (callback) => {
        return callback({
          practiceAnswer: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0)
          }
        } as any)
      })

      const { GET } = await import('@/app/api/wrong-answers/list/route')
      const request = new NextRequest('http://localhost:3000/api/wrong-answers/list')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.wrongAnswers).toEqual([])
      expect(data.pagination.totalCount).toBe(0)
      expect(data.pagination.totalPages).toBe(0)
    })

    it('should validate API endpoint exists and handles basic request', async () => {
      // This test just verifies the endpoint exists and can be imported
      const { GET } = await import('@/app/api/wrong-answers/list/route')
      expect(GET).toBeDefined()
      expect(typeof GET).toBe('function')
    })
  })
})