import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock all dependencies with proper structure
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/database', () => ({
  withDatabase: vi.fn(),
}))

vi.mock('@/lib/ai-analysis-service', () => ({
  analyzeWrongAnswer: vi.fn(),
}))

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  recordFailedRequest: vi.fn(),
  recordSuccessfulRequest: vi.fn(),
  RateLimitConfigs: {
    AI_ANALYSIS: { limit: 100, window: 60 },
  },
  aiServiceCircuitBreaker: {
    execute: vi.fn(),
    getState: vi.fn(() => 'CLOSED'),
  },
  createUserBasedKeyGenerator: vi.fn(() => () => 'user-key')
}))

// Import mocked functions
import { requireAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/database'
import { analyzeWrongAnswer } from '@/lib/ai-analysis-service'
import { checkRateLimit, recordFailedRequest, recordSuccessfulRequest, aiServiceCircuitBreaker } from '@/lib/rate-limiter'
import { POST as analyzeHandler } from '@/app/api/ai/wrong-answers/analyze/route'
import { GET as listHandler } from '@/app/api/wrong-answers/list/route'

const mockRequireAuth = vi.mocked(requireAuth)
const mockWithDatabase = vi.mocked(withDatabase)
const mockAnalyzeWrongAnswer = vi.mocked(analyzeWrongAnswer)
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockRecordFailedRequest = vi.mocked(recordFailedRequest)
const mockRecordSuccessfulRequest = vi.mocked(recordSuccessfulRequest)
const mockCircuitBreaker = vi.mocked(aiServiceCircuitBreaker)

describe('Wrong Answers AI Analysis - API Integration Tests', () => {
  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    isAdmin: false
  }

  const mockPrisma = {
    practiceAnswer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  } as any

  const mockAIAnalysis = {
    analysis: "这是一个详细的中文分析，解释了学生在听力理解方面的错误。学生没有正确理解对话中的关键信息，特别是关于时间和地点的细节。建议加强对话细节的捕捉能力。",
    key_reason: "细节理解缺失",
    ability_tags: ["听力细节捕捉", "时间信息理解", "地点信息理解"],
    signal_words: ["明天", "图书馆", "下午三点"],
    strategy: "在听对话时，要特别注意时间、地点等关键信息词，可以在听的过程中做简单记录。",
    related_sentences: [
      {
        quote: "我们明天下午三点在图书馆见面吧",
        comment: "这句话包含了正确答案所需的时间和地点信息"
      }
    ],
    confidence: "high" as const
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: mockUser })
    mockWithDatabase.mockImplementation((callback) => callback(mockPrisma))
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 100,
      remaining: 99,
      resetTime: Date.now() + 60000
    })
    mockAnalyzeWrongAnswer.mockResolvedValue(mockAIAnalysis)
    mockCircuitBreaker.execute.mockImplementation(async (fn) => await fn())
  })

  describe('Single Analysis API', () => {
    it('should successfully analyze a wrong answer', async () => {
      const analysisRequest = {
        questionId: 'question-1',
        answerId: 'answer-1',
        questionType: 'multiple-choice',
        question: '他们打算去哪里？',
        userAnswer: '商店',
        correctAnswer: '公园',
        transcript: '今天天气很好，我们去公园散步吧。',
        exerciseTopic: 'Daily Conversation',
        exerciseDifficulty: 'Beginner',
        language: 'Chinese',
        attemptedAt: '2024-01-15T10:00:00Z'
      }

      // Mock answer verification
      mockPrisma.practiceAnswer.findFirst.mockResolvedValue({
        id: 'answer-1',
        questionId: 'question-1',
        isCorrect: false,
        question: {
          session: {
            userId: mockUser.userId
          }
        }
      })

      // Mock database update
      mockPrisma.practiceAnswer.update.mockResolvedValue({
        id: 'answer-1',
        aiAnalysis: JSON.stringify(mockAIAnalysis),
        aiAnalysisGeneratedAt: new Date(),
        needsAnalysis: false,
      })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(analysisRequest),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await analyzeHandler(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.analysis).toEqual(mockAIAnalysis)
      expect(mockAnalyzeWrongAnswer).toHaveBeenCalledWith(expect.objectContaining({
        questionType: 'multiple-choice',
        question: '他们打算去哪里？',
        userAnswer: '商店',
        correctAnswer: '公园'
      }))
    })

    it('should return 401 when user is not authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ user: null, error: '未登录' })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await analyzeHandler(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('未登录')
    })

    it('should return 404 when answer does not exist', async () => {
      mockPrisma.practiceAnswer.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify({
          questionId: 'question-1',
          answerId: 'non-existent',
          questionType: 'multiple-choice',
          question: 'test',
          userAnswer: 'test',
          correctAnswer: 'test',
          transcript: 'test',
          exerciseTopic: 'test',
          exerciseDifficulty: 'test',
          language: 'test',
          attemptedAt: '2024-01-15T10:00:00Z'
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await analyzeHandler(request)
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.error).toBe('答案不存在或无权限访问')
    })
  })

  describe('Wrong Answers List Integration', () => {
    it('should retrieve wrong answers with proper filtering and pagination', async () => {
      const mockWrongAnswers = [
        {
          id: 'answer-1',
          questionId: 'question-1',
          userAnswer: '商店',
          isCorrect: false,
          attemptedAt: new Date('2024-01-15T10:00:00Z'),
          aiAnalysis: JSON.stringify(mockAIAnalysis),
          aiAnalysisGeneratedAt: new Date('2024-01-15T11:00:00Z'),
          tags: [],
          needsAnalysis: false,
          question: {
            id: 'question-1',
            sessionId: 'session-1',
            index: 0,
            type: 'multiple-choice',
            question: '他们打算去哪里？',
            options: JSON.stringify(['商店', '公园', '学校', '医院']),
            correctAnswer: '公园',
            explanation: '对话中明确提到"去公园散步"',
            transcriptSnapshot: '今天天气很好，我们去公园散步吧。',
            createdAt: new Date(),
            session: {
              id: 'session-1',
              userId: mockUser.userId,
              topic: 'Daily Conversation',
              difficulty: 'Beginner',
              language: 'Chinese',
              transcript: '今天天气很好，我们去公园散步吧。',
              score: 0,
              createdAt: new Date('2024-01-15T10:00:00Z'),
              updatedAt: new Date(),
            }
          }
        }
      ]

      mockPrisma.practiceAnswer.findMany.mockResolvedValue(mockWrongAnswers)
      mockPrisma.practiceAnswer.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/wrong-answers/list?difficulty=Beginner&language=Chinese')

      const response = await listHandler(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.wrongAnswers).toHaveLength(1)
      expect(result.wrongAnswers[0].answer.aiAnalysis).toEqual(mockAIAnalysis)
      
      // Verify filtering was applied
      expect(mockPrisma.practiceAnswer.findMany).toHaveBeenCalledWith({
        where: {
          question: {
            session: {
              userId: mockUser.userId,
              difficulty: 'Beginner',
              language: 'Chinese'
            }
          },
          isCorrect: false
        },
        orderBy: { attemptedAt: 'desc' },
        skip: 0,
        take: 50,
        include: expect.any(Object)
      })
    })

    it('should handle search functionality correctly', async () => {
      const request = new NextRequest('http://localhost/api/wrong-answers/list?search=图书馆')

      const response = await listHandler(request)

      expect(mockPrisma.practiceAnswer.findMany).toHaveBeenCalledWith({
        where: {
          question: {
            session: {
              userId: mockUser.userId
            }
          },
          isCorrect: false,
          OR: [
            {
              question: {
                question: {
                  contains: '图书馆',
                  mode: 'insensitive'
                }
              }
            },
            {
              question: {
                session: {
                  topic: {
                    contains: '图书馆',
                    mode: 'insensitive'
                  }
                }
              }
            }
          ]
        },
        orderBy: { attemptedAt: 'desc' },
        skip: 0,
        take: 50,
        include: expect.any(Object)
      })
    })
  })
})