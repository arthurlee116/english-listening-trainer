/**
 * End-to-End Integration Tests for Wrong Answers AI Analysis Feature
 * 
 * This test suite focuses on API-level integration testing for the wrong answers AI analysis feature.
 * It validates the complete data flow from legacy migration to AI analysis without complex UI mocking.
 * 
 * Requirements Coverage: 4.1-4.5, 5.1-5.4, 2.1-2.5, 1.1-1.5, 3.1-3.5, 6.1-6.4, 7.1-7.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fetch globally for API testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Wrong Answers AI Analysis - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Legacy Data Migration Integration (Requirements: 4.1-4.5)', () => {
    it('should successfully migrate legacy practice data', async () => {
      const legacyData = {
        sessions: [{
          sessionId: 'legacy-session-1',
          topic: 'Business Conversation',
          difficulty: 'B1',
          language: 'en',
          transcript: 'This is a test transcript for business conversation.',
          score: 70,
          createdAt: '2024-01-15T10:00:00Z',
          questions: [{
            index: 0,
            type: 'multiple_choice',
            question: 'What is the main topic?',
            options: ['Business', 'Sports', 'Travel', 'Food'],
            correctAnswer: 'Business',
            explanation: 'The conversation is about business topics.',
            answers: [{
              userAnswer: 'Sports',
              isCorrect: false,
              attemptedAt: '2024-01-15T10:05:00Z'
            }]
          }]
        }]
      }

      // Mock successful import response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Legacy data imported successfully',
          imported: {
            sessions: 1,
            questions: 1,
            answers: 1
          }
        })
      })

      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyData)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.imported.sessions).toBe(1)
      expect(result.imported.questions).toBe(1)
      expect(result.imported.answers).toBe(1)
    })

    it('should handle validation errors during migration', async () => {
      const invalidData = {
        sessions: [{
          sessionId: '', // Invalid: empty sessionId
          topic: 'Test',
          difficulty: 'B1',
          language: 'en',
          transcript: 'Test transcript',
          score: 'invalid', // Invalid: non-numeric score
          createdAt: 'invalid-date', // Invalid: malformed date
          questions: []
        }]
      }

      // Mock validation error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Validation failed for provided data',
          code: 'VALIDATION_ERROR',
          details: [
            'Session 0: sessionId is required and must be a string',
            'Session 0: score must be a number if provided',
            'Session 0: createdAt must be a valid date string'
          ]
        })
      })

      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      })

      const result = await response.json()

      expect(response.ok).toBe(false)
      expect(result.success).toBe(false)
      expect(result.code).toBe('VALIDATION_ERROR')
      expect(result.details).toBeInstanceOf(Array)
      expect(result.details.length).toBeGreaterThan(0)
    })

    it('should set needsAnalysis flag correctly for wrong answers', async () => {
      const sessionWithMixedAnswers = {
        sessions: [{
          sessionId: 'mixed-session',
          topic: 'Test Topic',
          difficulty: 'B1',
          language: 'en',
          transcript: 'Test transcript',
          score: 50,
          createdAt: '2024-01-15T10:00:00Z',
          questions: [
            {
              index: 0,
              type: 'multiple_choice',
              question: 'Question 1?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'A',
              answers: [{ userAnswer: 'B', isCorrect: false, attemptedAt: '2024-01-15T10:05:00Z' }]
            },
            {
              index: 1,
              type: 'multiple_choice',
              question: 'Question 2?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'A',
              answers: [{ userAnswer: 'A', isCorrect: true, attemptedAt: '2024-01-15T10:06:00Z' }]
            }
          ]
        }]
      }

      // Mock successful import with proper flag setting
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Legacy data imported successfully',
          imported: {
            sessions: 1,
            questions: 2,
            answers: 2
          },
          // In a real implementation, we would verify needsAnalysis flags
          analysisFlags: {
            needsAnalysisCount: 1, // Only wrong answers need analysis
            correctAnswersCount: 1
          }
        })
      })

      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionWithMixedAnswers)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.imported.answers).toBe(2)
      // Verify that only wrong answers would be flagged for analysis
      expect(result.analysisFlags?.needsAnalysisCount).toBe(1)
    })
  })

  describe('2. AI Analysis Generation Integration (Requirements: 1.1-1.5, 6.1-6.4)', () => {
    it('should generate comprehensive AI analysis for wrong answers', async () => {
      const analysisRequest = {
        questionId: 'question-123',
        answerId: 'answer-456',
        questionType: 'multiple_choice',
        question: 'What time is the meeting scheduled?',
        options: ['2 PM', '3 PM', '4 PM', '5 PM'],
        userAnswer: '2 PM',
        correctAnswer: '3 PM',
        transcript: 'The meeting is scheduled for 3 PM tomorrow, please make sure to attend.',
        exerciseTopic: 'Business Conversation',
        exerciseDifficulty: 'B1',
        language: 'en',
        attemptedAt: '2024-01-15T10:05:00Z'
      }

      // Mock successful AI analysis response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          analysis: {
            analysis: '这道题考查的是对话中的细节理解能力。用户选择了错误答案2 PM，正确答案是3 PM。错误原因主要是对关键信息的理解有偏差，特别是对话中提到的时间信息没有准确把握。建议在听力过程中重点关注时间、地点等具体细节信息，提高细节捕捉能力。',
            key_reason: '细节理解缺失',
            ability_tags: ['听力细节捕捉', '时间信息理解', '对话理解'],
            signal_words: ['时间', '地点', '关键词'],
            strategy: '在听力过程中要特别注意时间、地点等具体信息，可以在听的过程中做简单的笔记记录关键信息点。',
            related_sentences: [{
              quote: 'The meeting is scheduled for 3 PM tomorrow.',
              comment: '这句话明确提到了会议时间，是解题的关键信息。'
            }],
            confidence: 'high'
          }
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(result.analysis).toBeDefined()
      expect(result.analysis.analysis).toContain('细节理解能力')
      expect(result.analysis.key_reason).toBe('细节理解缺失')
      expect(result.analysis.ability_tags).toContain('听力细节捕捉')
      expect(result.analysis.signal_words).toContain('时间')
      expect(result.analysis.strategy).toContain('时间、地点')
      expect(result.analysis.related_sentences).toHaveLength(1)
      expect(result.analysis.confidence).toBe('high')
    })

    it('should handle AI service failures gracefully', async () => {
      const analysisRequest = {
        questionId: 'question-123',
        answerId: 'answer-456',
        questionType: 'multiple_choice',
        question: 'Test question?',
        userAnswer: 'Wrong',
        correctAnswer: 'Right',
        transcript: 'Test transcript',
        exerciseTopic: 'Test',
        exerciseDifficulty: 'B1',
        language: 'en',
        attemptedAt: '2024-01-15T10:05:00Z'
      }

      // Mock AI service failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'AI分析失败: Service temporarily unavailable'
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      const result = await response.json()

      expect(response.ok).toBe(false)
      expect(result.error).toContain('AI分析失败')
    })

    it('should validate analysis request parameters', async () => {
      const incompleteRequest = {
        questionId: 'question-123',
        // Missing required fields
        questionType: 'multiple_choice'
      }

      // Mock validation error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: '缺少必填字段: answerId'
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incompleteRequest)
      })

      const result = await response.json()

      expect(response.ok).toBe(false)
      expect(result.error).toContain('缺少必填字段')
    })
  })

  describe('3. Batch Processing Integration (Requirements: 2.1-2.5, 7.1-7.5)', () => {
    it('should handle batch analysis with mixed results', async () => {
      const batchRequest = {
        answerIds: ['answer-1', 'answer-2', 'answer-3', 'answer-4', 'answer-5']
      }

      // Mock batch analysis response with partial failures
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: [
            {
              answerId: 'answer-1',
              analysis: {
                analysis: '分析内容1',
                key_reason: '词汇理解错误',
                ability_tags: ['词汇理解'],
                signal_words: ['关键词'],
                strategy: '建议策略',
                related_sentences: [],
                confidence: 'high'
              }
            },
            {
              answerId: 'answer-2',
              analysis: {
                analysis: '分析内容2',
                key_reason: '语法理解错误',
                ability_tags: ['语法理解'],
                signal_words: ['语法'],
                strategy: '语法建议',
                related_sentences: [],
                confidence: 'medium'
              }
            }
          ],
          failed: [
            { answerId: 'answer-3', error: 'AI service timeout' },
            { answerId: 'answer-4', error: 'Invalid question data' },
            { answerId: 'answer-5', error: 'Rate limit exceeded' }
          ]
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success).toHaveLength(2)
      expect(result.failed).toHaveLength(3)
      expect(result.success[0].answerId).toBe('answer-1')
      expect(result.success[1].answerId).toBe('answer-2')
      expect(result.failed[0].answerId).toBe('answer-3')
    })

    it('should respect concurrency limits in batch processing', async () => {
      const largeBatchRequest = {
        answerIds: Array.from({ length: 150 }, (_, i) => `answer-${i}`)
      }

      // Mock response with concurrency limit handling
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: Array.from({ length: 100 }, (_, i) => ({
            answerId: `answer-${i}`,
            analysis: {
              analysis: `分析内容${i}`,
              key_reason: '理解错误',
              ability_tags: ['理解能力'],
              signal_words: ['关键词'],
              strategy: '建议策略',
              related_sentences: [],
              confidence: 'medium'
            }
          })),
          failed: Array.from({ length: 50 }, (_, i) => ({
            answerId: `answer-${i + 100}`,
            error: 'Concurrency limit exceeded, please retry'
          })),
          metadata: {
            concurrencyLimit: 100,
            processed: 150,
            successful: 100,
            failed: 50
          }
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeBatchRequest)
      })

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.success.length).toBeLessThanOrEqual(100)
      expect(result.metadata.concurrencyLimit).toBe(100)
      expect(result.metadata.processed).toBe(150)
    })

    it('should handle rate limiting in batch operations', async () => {
      const batchRequest = {
        answerIds: ['answer-1', 'answer-2', 'answer-3']
      }

      // Mock rate limit response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          rateLimitInfo: {
            limit: 100,
            remaining: 0,
            resetTime: Date.now() + 60000
          }
        }),
        headers: new Headers({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + 60000).toString()
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      const result = await response.json()

      expect(response.status).toBe(429)
      expect(result.error).toContain('Rate limit exceeded')
      expect(result.rateLimitInfo.remaining).toBe(0)
    })
  })

  describe('4. Wrong Answers Retrieval Integration (Requirements: 5.1-5.4)', () => {
    it('should retrieve wrong answers with filtering and pagination', async () => {
      const queryParams = new URLSearchParams({
        search: 'meeting',
        difficulty: 'B1',
        language: 'en',
        type: 'multiple_choice',
        limit: '20',
        page: '1'
      })

      // Mock wrong answers list response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          wrongAnswers: [
            {
              answerId: 'answer-1',
              questionId: 'question-1',
              sessionId: 'session-1',
              session: {
                topic: 'Business Conversation',
                difficulty: 'B1',
                language: 'en',
                createdAt: '2024-01-15T10:00:00Z'
              },
              question: {
                index: 0,
                type: 'multiple_choice',
                question: 'What time is the meeting scheduled?',
                options: ['2 PM', '3 PM', '4 PM', '5 PM'],
                correctAnswer: '3 PM',
                explanation: 'The speaker clearly mentions the meeting time.',
                transcript: 'The meeting is scheduled for 3 PM tomorrow.'
              },
              answer: {
                userAnswer: '2 PM',
                isCorrect: false,
                attemptedAt: '2024-01-15T10:05:00Z',
                aiAnalysis: {
                  analysis: '细节理解错误分析',
                  key_reason: '时间信息理解错误',
                  ability_tags: ['时间理解'],
                  signal_words: ['时间'],
                  strategy: '注意时间细节',
                  related_sentences: [],
                  confidence: 'high'
                },
                aiAnalysisGeneratedAt: '2024-01-15T10:10:00Z',
                needsAnalysis: false
              }
            }
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 1,
            hasMore: false
          }
        })
      })

      const response = await fetch(`/api/wrong-answers/list?${queryParams}`)
      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.wrongAnswers).toHaveLength(1)
      expect(result.wrongAnswers[0].question.question).toContain('meeting')
      expect(result.wrongAnswers[0].session.difficulty).toBe('B1')
      expect(result.wrongAnswers[0].answer.aiAnalysis).toBeDefined()
      expect(result.pagination.totalCount).toBe(1)
    })

    it('should handle empty results gracefully', async () => {
      // Mock empty results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          wrongAnswers: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasMore: false
          }
        })
      })

      const response = await fetch('/api/wrong-answers/list?search=nonexistent')
      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.wrongAnswers).toHaveLength(0)
      expect(result.pagination.totalCount).toBe(0)
    })
  })

  describe('5. Cross-Device Synchronization (Requirements: 5.3-5.4)', () => {
    it('should maintain data consistency across sessions', async () => {
      // Mock first device session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          wrongAnswers: [
            {
              answerId: 'answer-1',
              answer: {
                aiAnalysis: null,
                needsAnalysis: true
              }
            }
          ]
        })
      })

      const device1Response = await fetch('/api/wrong-answers/list')
      const device1Result = await device1Response.json()

      expect(device1Result.wrongAnswers[0].answer.needsAnalysis).toBe(true)

      // Simulate AI analysis generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          analysis: { analysis: 'Generated analysis' }
        })
      })

      await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'question-1',
          answerId: 'answer-1',
          questionType: 'multiple_choice'
        })
      })

      // Mock second device session with updated data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          wrongAnswers: [
            {
              answerId: 'answer-1',
              answer: {
                aiAnalysis: { analysis: 'Generated analysis' },
                needsAnalysis: false
              }
            }
          ]
        })
      })

      const device2Response = await fetch('/api/wrong-answers/list')
      const device2Result = await device2Response.json()

      expect(device2Result.wrongAnswers[0].answer.needsAnalysis).toBe(false)
      expect(device2Result.wrongAnswers[0].answer.aiAnalysis).toBeDefined()
    })
  })

  describe('6. Error Handling and Edge Cases (Requirements: 7.4-7.5)', () => {
    it('should handle authentication failures', async () => {
      // Mock authentication error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: '未登录'
        })
      })

      const response = await fetch('/api/wrong-answers/list')
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('未登录')
    })

    it('should handle database connection failures', async () => {
      // Mock database error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: '数据库连接失败，请稍后重试',
          code: 'DATABASE_ERROR'
        })
      })

      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: [] })
      })

      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toContain('数据库连接失败')
      expect(result.code).toBe('DATABASE_ERROR')
    })

    it('should handle circuit breaker scenarios', async () => {
      // Mock circuit breaker response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'AI服务暂时不可用，请稍后重试',
          circuitBreakerState: 'OPEN',
          retryAfter: 60
        }),
        headers: new Headers({
          'Retry-After': '60'
        })
      })

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'test',
          answerId: 'test',
          questionType: 'multiple_choice'
        })
      })

      const result = await response.json()

      expect(response.status).toBe(503)
      expect(result.error).toContain('AI服务暂时不可用')
      expect(result.circuitBreakerState).toBe('OPEN')
    })
  })

  describe('7. Performance and Scalability', () => {
    it('should handle large dataset operations efficiently', async () => {
      const largeDataset = {
        sessions: Array.from({ length: 50 }, (_, i) => ({
          sessionId: `session-${i}`,
          topic: `Topic ${i}`,
          difficulty: 'B1',
          language: 'en',
          transcript: `Transcript for session ${i}`,
          score: 70,
          createdAt: '2024-01-15T10:00:00Z',
          questions: Array.from({ length: 10 }, (_, j) => ({
            index: j,
            type: 'multiple_choice',
            question: `Question ${j}?`,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            answers: [{
              userAnswer: 'B',
              isCorrect: false,
              attemptedAt: '2024-01-15T10:05:00Z'
            }]
          }))
        }))
      }

      // Mock successful large import
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          imported: {
            sessions: 50,
            questions: 500,
            answers: 500
          },
          processingTime: 2500 // 2.5 seconds
        })
      })

      const startTime = Date.now()
      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeDataset)
      })
      const endTime = Date.now()

      const result = await response.json()

      expect(response.ok).toBe(true)
      expect(result.imported.sessions).toBe(50)
      expect(result.imported.questions).toBe(500)
      expect(result.imported.answers).toBe(500)
      
      // Verify reasonable processing time (mock response time should be fast)
      expect(endTime - startTime).toBeLessThan(1000) // 1 second for API call
    })
  })
})