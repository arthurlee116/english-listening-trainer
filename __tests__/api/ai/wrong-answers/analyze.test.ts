import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/ai/wrong-answers/analyze/route'

// Mock dependencies
vi.mock('@/lib/auth')
vi.mock('@/lib/database')
vi.mock('@/lib/ai-analysis-service')
vi.mock('@/lib/rate-limiter')

// Import mocked functions
const { requireAuth } = await import('@/lib/auth')
const { withDatabase } = await import('@/lib/database')
const { analyzeWrongAnswer } = await import('@/lib/ai-analysis-service')
const { checkRateLimit, recordFailedRequest, recordSuccessfulRequest, aiServiceCircuitBreaker } = await import('@/lib/rate-limiter')

const mockRequireAuth = vi.mocked(requireAuth)
const mockWithDatabase = vi.mocked(withDatabase)
const mockAnalyzeWrongAnswer = vi.mocked(analyzeWrongAnswer)
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockRecordFailedRequest = vi.mocked(recordFailedRequest)
const mockRecordSuccessfulRequest = vi.mocked(recordSuccessfulRequest)
const mockCircuitBreaker = vi.mocked(aiServiceCircuitBreaker)

describe('/api/ai/wrong-answers/analyze', () => {
  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    isAdmin: false
  }

  const mockAnalysisRequest = {
    questionId: 'question-123',
    answerId: 'answer-123',
    questionType: 'single',
    question: 'What is the main topic?',
    options: ['Travel', 'Weather', 'Food', 'Sports'],
    userAnswer: 'Weather',
    correctAnswer: 'Travel',
    transcript: 'We are planning a trip to Paris next week.',
    exerciseTopic: 'Travel',
    exerciseDifficulty: 'B1',
    language: 'en-US',
    attemptedAt: '2024-01-15T10:30:00Z'
  }

  const mockAnalysisResponse = {
    analysis: '学生选择了"天气"作为答案，但正确答案应该是"旅行"。从听力材料中可以清楚地听到在讨论去巴黎的旅行计划。这是一个详细的中文分析，解释了学生为什么会选择错误答案，包含了错误原因、知识点解释和改进建议，字数超过150字以满足要求。',
    key_reason: '被细节词汇误导，未能把握对话主旨',
    ability_tags: ['听力主旨理解', '对话分析'],
    signal_words: ['trip', 'Paris', 'planning'],
    strategy: '在听主旨理解题时，要重点关注对话开头的关键信息',
    related_sentences: [
      {
        quote: 'We are planning a trip to Paris next week.',
        comment: '这句话直接点明了主题是旅行计划'
      }
    ],
    confidence: 'high' as const
  }

  const mockAnswer = {
    id: 'answer-123',
    questionId: 'question-123',
    userAnswer: 'Weather',
    isCorrect: false,
    question: {
      session: {
        userId: 'user-123'
      }
    }
  }

  const mockRateLimitSuccess = {
    success: true,
    limit: 10,
    remaining: 9,
    resetTime: Date.now() + 60000
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default rate limit success
    mockCheckRateLimit.mockReturnValue(mockRateLimitSuccess)
    // Default circuit breaker success
    mockCircuitBreaker.execute = vi.fn().mockImplementation(async (fn) => await fn())
  })

  describe('Successful Analysis', () => {
    it('should successfully analyze wrong answer', async () => {
      // Setup mocks
      mockRequireAuth.mockResolvedValue({ user: mockUser })
      mockWithDatabase
        .mockResolvedValueOnce(mockAnswer) // First call: verify answer ownership
        .mockResolvedValueOnce(undefined) // Second call: store analysis result
      mockAnalyzeWrongAnswer.mockResolvedValue(mockAnalysisResponse)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.analysis).toEqual(mockAnalysisResponse)
      expect(mockAnalyzeWrongAnswer).toHaveBeenCalledWith({
        questionType: mockAnalysisRequest.questionType,
        question: mockAnalysisRequest.question,
        options: mockAnalysisRequest.options,
        userAnswer: mockAnalysisRequest.userAnswer,
        correctAnswer: mockAnalysisRequest.correctAnswer,
        transcript: mockAnalysisRequest.transcript,
        exerciseTopic: mockAnalysisRequest.exerciseTopic,
        exerciseDifficulty: mockAnalysisRequest.exerciseDifficulty,
        language: mockAnalysisRequest.language,
        attemptedAt: mockAnalysisRequest.attemptedAt
      })
      expect(mockRecordSuccessfulRequest).toHaveBeenCalled()
    })

    it('should handle analysis without options', async () => {
      const requestWithoutOptions = { ...mockAnalysisRequest }
      delete (requestWithoutOptions as any).options

      mockRequireAuth.mockResolvedValue({ user: mockUser })
      mockWithDatabase
        .mockResolvedValueOnce(mockAnswer)
        .mockResolvedValueOnce(undefined)
      mockAnalyzeWrongAnswer.mockResolvedValue(mockAnalysisResponse)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(requestWithoutOptions)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockAnalyzeWrongAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          options: undefined
        })
      )
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated user', async () => {
      mockRequireAuth.mockResolvedValue({ user: null, error: '未登录' })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('未登录')
      expect(mockRecordFailedRequest).toHaveBeenCalled()
    })

    it('should return 401 when auth result has no user', async () => {
      mockRequireAuth.mockResolvedValue({ user: null })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
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

    it('should return 400 for missing required fields', async () => {
      const incompleteRequest = { ...mockAnalysisRequest }
      delete (incompleteRequest as any).questionId

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(incompleteRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('缺少必填字段')
    })

    it('should validate all required fields', async () => {
      const requiredFields = [
        'questionId', 'answerId', 'questionType', 'question', 
        'userAnswer', 'correctAnswer', 'transcript', 'exerciseTopic', 
        'exerciseDifficulty', 'language', 'attemptedAt'
      ]

      for (const field of requiredFields) {
        const incompleteRequest = { ...mockAnalysisRequest }
        delete (incompleteRequest as any)[field]

        const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
          method: 'POST',
          body: JSON.stringify(incompleteRequest)
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toContain(`缺少必填字段: ${field}`)
      }
    })
  })

  describe('Answer Validation', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 404 for non-existent answer', async () => {
      mockWithDatabase.mockResolvedValueOnce(null) // Answer not found

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('答案不存在或无权限访问')
    })

    it('should return 400 for correct answer', async () => {
      mockWithDatabase.mockResolvedValueOnce({
        ...mockAnswer,
        isCorrect: true
      })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('只能分析错误答案')
    })

    it('should validate user ownership of answer', async () => {
      const answerFromDifferentUser = {
        ...mockAnswer,
        question: {
          session: {
            userId: 'different-user'
          }
        }
      }
      mockWithDatabase.mockResolvedValueOnce(null) // Simulates no answer found for this user

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('答案不存在或无权限访问')
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockReturnValue({
        success: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 60000,
        error: 'Rate limit exceeded'
      })

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded')
      expect(data.rateLimitInfo).toBeDefined()
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    })

    it('should include rate limit headers in successful response', async () => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
      mockWithDatabase
        .mockResolvedValueOnce(mockAnswer)
        .mockResolvedValueOnce(undefined)
      mockAnalyzeWrongAnswer.mockResolvedValue(mockAnalysisResponse)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('8')
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })
  })

  describe('AI Service Integration', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
      mockWithDatabase.mockResolvedValueOnce(mockAnswer)
    })

    it('should handle AI service failures', async () => {
      mockCircuitBreaker.execute = vi.fn().mockRejectedValue(new Error('AI service temporarily unavailable'))

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('AI分析失败')
      expect(mockRecordFailedRequest).toHaveBeenCalled()
    })

    it('should handle circuit breaker open state', async () => {
      mockCircuitBreaker.execute = vi.fn().mockRejectedValue(new Error('Circuit breaker is OPEN'))
      mockCircuitBreaker.getState = vi.fn().mockReturnValue('OPEN')

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.error).toBe('AI服务暂时不可用，请稍后重试')
      expect(data.circuitBreakerState).toBe('OPEN')
      expect(response.headers.get('Retry-After')).toBe('60')
    })

    it('should store analysis result in database', async () => {
      mockWithDatabase
        .mockResolvedValueOnce(mockAnswer)
        .mockResolvedValueOnce(undefined)
      mockAnalyzeWrongAnswer.mockResolvedValue(mockAnalysisResponse)

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      await POST(request)

      // Verify database update was called
      expect(mockWithDatabase).toHaveBeenCalledTimes(2)
      
      // Check the second call (store analysis result)
      const secondCall = mockWithDatabase.mock.calls[1]
      expect(secondCall[1]).toBe('store AI analysis result')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ user: mockUser })
    })

    it('should handle database errors gracefully', async () => {
      mockWithDatabase.mockRejectedValue(new Error('数据库操作失败'))

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('答案不存在或无权限访问')
    })

    it('should handle generic errors', async () => {
      mockWithDatabase.mockResolvedValueOnce(mockAnswer)
      mockCircuitBreaker.execute = vi.fn().mockRejectedValue(new Error('Unknown error'))

      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify(mockAnalysisRequest)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('AI分析失败: Unknown error')
    })

    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('分析失败，请稍后重试')
    })
  })
})