import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/ai/wrong-answers/analyze-batch/route'

// Mock dependencies
vi.mock('@/lib/auth')
vi.mock('@/lib/database')
vi.mock('@/lib/ai-analysis-service')
vi.mock('@/lib/rate-limiter')

import { requireAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/database'
import { analyzeWrongAnswer } from '@/lib/ai-analysis-service'
import { checkRateLimit, recordFailedRequest, recordSuccessfulRequest, aiServiceCircuitBreaker } from '@/lib/rate-limiter'

const mockRequireAuth = vi.mocked(requireAuth)
const mockWithDatabase = vi.mocked(withDatabase)
const mockAnalyzeWrongAnswer = vi.mocked(analyzeWrongAnswer)
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockRecordFailedRequest = vi.mocked(recordFailedRequest)
const mockRecordSuccessfulRequest = vi.mocked(recordSuccessfulRequest)
const mockCircuitBreaker = vi.mocked(aiServiceCircuitBreaker)

describe('/api/ai/wrong-answers/analyze-batch', () => {
  const mockUser = {
    userId: 'user123',
    email: 'test@example.com',
    isAdmin: false
  }

  const mockRateLimitSuccess = {
    success: true,
    limit: 3,
    remaining: 2,
    resetTime: Date.now() + 300000
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default rate limit success
    mockCheckRateLimit.mockReturnValue(mockRateLimitSuccess)
    // Default circuit breaker success
    mockCircuitBreaker.execute = vi.fn().mockImplementation(async (fn) => await fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockAnswers = [
    {
      id: 'answer1',
      userAnswer: 'wrong answer 1',
      isCorrect: false,
      attemptedAt: new Date('2024-01-01T10:00:00Z'),
      needsAnalysis: true,
      question: {
        id: 'question1',
        type: 'multiple_choice',
        question: 'What is the capital of France?',
        options: '["Paris", "London", "Berlin", "Madrid"]',
        correctAnswer: 'Paris',
        transcriptSnapshot: 'The capital of France is Paris.',
        session: {
          userId: 'user123',
          topic: 'Geography',
          difficulty: 'B1',
          language: 'en-US',
          transcript: 'Full transcript here...'
        }
      }
    },
    {
      id: 'answer2',
      userAnswer: 'wrong answer 2',
      isCorrect: false,
      attemptedAt: new Date('2024-01-01T10:05:00Z'),
      needsAnalysis: true,
      question: {
        id: 'question2',
        type: 'multiple_choice',
        question: 'What is 2+2?',
        options: '["3", "4", "5", "6"]',
        correctAnswer: '4',
        transcriptSnapshot: 'Two plus two equals four.',
        session: {
          userId: 'user123',
          topic: 'Math',
          difficulty: 'A1',
          language: 'en-US',
          transcript: 'Math transcript here...'
        }
      }
    }
  ]

  const mockAnalysisResponse = {
    analysis: '这是一个详细的中文分析，解释了学生为什么会选择错误答案。分析包含了错误原因、知识点解释和改进建议，字数超过150字以满足要求。',
    key_reason: '细节理解缺失',
    ability_tags: ['听力细节捕捉', '词汇理解'],
    signal_words: ['capital', 'France'],
    strategy: '注意听关键词，特别是地名和国家名称',
    related_sentences: [
      {
        quote: 'The capital of France is Paris.',
        comment: '这句话直接给出了正确答案'
      }
    ],
    confidence: 'high' as const
  }

  describe('Successful Batch Processing', () => {
    it('should successfully process batch analysis for multiple wrong answers', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({
        user: mockUser,
        error: undefined
      })

      // Mock database operations
      mockWithDatabase
        .mockResolvedValueOnce(mockAnswers) // First call: fetch answers
        .mockResolvedValueOnce(undefined) // Second call: update answer1
        .mockResolvedValueOnce(undefined) // Third call: update answer2

      // Mock AI analysis
      mockAnalyzeWrongAnswer.mockResolvedValue(mockAnalysisResponse)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1', 'answer2']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toHaveLength(2)
      expect(data.failed).toHaveLength(0)
      expect(data.summary).toEqual({
        total: 2,
        successful: 2,
        failed: 0
      })

      // Verify AI analysis was called for each answer
      expect(mockAnalyzeWrongAnswer).toHaveBeenCalledTimes(2)
      
      // Verify database updates were called for each answer
      expect(mockWithDatabase).toHaveBeenCalledTimes(3) // 1 fetch + 2 updates
      expect(mockRecordSuccessfulRequest).toHaveBeenCalled()
    })

    it('should handle empty batch gracefully', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
      mockWithDatabase.mockResolvedValueOnce([])

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['nonexistent1', 'nonexistent2']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('以下答案不存在或无权限访问')
    })
  })

  it('should handle mixed success and failure scenarios', async () => {
    // Mock authentication
    mockRequireAuth.mockResolvedValue({
      user: mockUser,
      error: undefined
    })

    // Mock database operations
    mockWithDatabase.mockResolvedValueOnce(mockAnswers)

    // Mock AI analysis - first succeeds, second fails
    mockAnalyzeWrongAnswer
      .mockResolvedValueOnce(mockAnalysisResponse)
      .mockRejectedValueOnce(new Error('AI service temporarily unavailable'))

    // Mock successful database update for first answer only
    mockWithDatabase.mockResolvedValueOnce(undefined)

    const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
      method: 'POST',
      body: JSON.stringify({
        answerIds: ['answer1', 'answer2']
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toHaveLength(1)
    expect(data.failed).toHaveLength(1)
    expect(data.summary).toEqual({
      total: 2,
      successful: 1,
      failed: 1
    })

    expect(data.success[0].answerId).toBe('answer1')
    expect(data.failed[0].answerId).toBe('answer2')
    expect(data.failed[0].error).toContain('AI service temporarily unavailable')
  })

  it('should reject correct answers and only process wrong answers', async () => {
    const mixedAnswers = [
      { ...mockAnswers[0], isCorrect: false }, // Wrong answer
      { ...mockAnswers[1], isCorrect: true }   // Correct answer
    ]

    // Mock authentication
    mockRequireAuth.mockResolvedValue({
      user: mockUser,
      error: undefined
    })

    // Mock database operations
    mockWithDatabase.mockResolvedValueOnce(mixedAnswers)

    // Mock AI analysis for the wrong answer only
    mockAnalyzeWrongAnswer.mockResolvedValueOnce(mockAnalysisResponse)

    // Mock database update for the wrong answer
    mockWithDatabase.mockResolvedValueOnce(undefined)

    const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
      method: 'POST',
      body: JSON.stringify({
        answerIds: ['answer1', 'answer2']
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toHaveLength(1)
    expect(data.failed).toHaveLength(1)
    expect(data.summary).toEqual({
      total: 2,
      successful: 1,
      failed: 1
    })

    expect(data.success[0].answerId).toBe('answer1')
    expect(data.failed[0].answerId).toBe('answer2')
    expect(data.failed[0].error).toBe('只能分析错误答案')

    // Verify AI analysis was only called once (for the wrong answer)
    expect(mockAnalyzeWrongAnswer).toHaveBeenCalledTimes(1)
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockRequireAuth.mockResolvedValue({
        user: null,
        error: '未登录'
      })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('未登录')
      expect(mockRecordFailedRequest).toHaveBeenCalled()
    })

    it('should return 401 when auth result has no user', async () => {
      mockRequireAuth.mockResolvedValue({ user: null })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('未登录')
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 400 for invalid request body', async () => {
      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: 'not-an-array'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('请提供有效的答案ID数组')
    })

    it('should return 400 for missing answerIds', async () => {
      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('请提供有效的答案ID数组')
    })

    it('should return 400 for empty answer IDs array', async () => {
      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: []
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('答案ID数组不能为空')
    })

    it('should return 400 for too many answer IDs', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => `answer${i}`)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: tooManyIds
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('批量处理最多支持 100 个答案')
    })

    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('批量分析失败，请稍后重试')
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockReturnValue({
        success: false,
        limit: 3,
        remaining: 0,
        resetTime: Date.now() + 300000,
        error: 'Rate limit exceeded'
      })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
      expect(response.headers.get('X-RateLimit-Limit')).toBe('3')
    })

    it('should include rate limit headers in successful response', async () => {
      mockWithDatabase.mockResolvedValueOnce(mockAnswers.slice(0, 1))
      mockAnalyzeWrongAnswer.mockResolvedValue(mockAnalysisResponse)
      mockWithDatabase.mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        })
      })

      const response = await POST(request)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('3')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('1')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })
  })

  describe('Answer Validation', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 404 for non-existent or unauthorized answer IDs', async () => {
      // Mock database returning only one answer when two were requested
      mockWithDatabase.mockResolvedValueOnce([mockAnswers[0]])

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1', 'nonexistent']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('以下答案不存在或无权限访问: nonexistent')
    })

    it('should validate user ownership of all answers', async () => {
      const answersFromDifferentUser = mockAnswers.map(answer => ({
        ...answer,
        question: {
          ...answer.question,
          session: {
            ...answer.question.session,
            userId: 'different-user'
          }
        }
      }))

      // Mock database returning no answers (filtered by user)
      mockWithDatabase.mockResolvedValueOnce([])

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1', 'answer2']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('以下答案不存在或无权限访问')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should handle database errors gracefully', async () => {
      mockWithDatabase.mockRejectedValue(new Error('数据库连接失败'))

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('数据库操作失败，请稍后重试')
    })

    it('should handle circuit breaker open state', async () => {
      mockWithDatabase.mockResolvedValueOnce(mockAnswers.slice(0, 1))
      mockCircuitBreaker.execute = vi.fn().mockRejectedValue(new Error('Circuit breaker is OPEN'))
      mockCircuitBreaker.getState = vi.fn().mockReturnValue('OPEN')

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toHaveLength(0)
      expect(data.failed).toHaveLength(1)
      expect(data.failed[0].error).toContain('Circuit breaker is OPEN')
    })

    it('should handle unexpected errors', async () => {
      mockWithDatabase.mockResolvedValueOnce(mockAnswers.slice(0, 1))
      mockCircuitBreaker.execute = vi.fn().mockRejectedValue(new Error('Unexpected error'))

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        body: JSON.stringify({
          answerIds: ['answer1']
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toHaveLength(0)
      expect(data.failed).toHaveLength(1)
      expect(data.failed[0].error).toContain('Unexpected error')
    })
  })
})