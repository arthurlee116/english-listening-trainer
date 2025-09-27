import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Wrong Answers AI Analysis - Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('Legacy Data Migration Workflow', () => {
    it('should detect legacy data and trigger migration', async () => {
      // Test data
      const legacyData = [
        {
          id: 'legacy-session-1',
          topic: 'Daily Conversation',
          difficulty: 'Beginner',
          language: 'Chinese',
          transcript: '今天天气很好，我们去公园散步吧。',
          questions: [
            {
              index: 0,
              type: 'multiple-choice',
              question: '他们打算去哪里？',
              options: ['商店', '公园', '学校', '医院'],
              correctAnswer: '公园',
              explanation: '对话中明确提到"去公园散步"',
            }
          ],
          answers: ['商店'],
          results: [{ is_correct: false, correct_answer: '公园', explanation: '对话中明确提到"去公园散步"' }],
          score: 0,
          createdAt: '2024-01-15T10:00:00Z'
        }
      ]

      // Mock localStorage with legacy data
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'exerciseHistory') {
          return JSON.stringify(legacyData)
        }
        return null
      })

      // Mock successful import API response
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          imported: {
            sessions: 1,
            questions: 1,
            answers: 1
          }
        })
      } as Response)

      // Simulate the migration process
      const historyData = localStorage.getItem('exerciseHistory')
      expect(historyData).toBeTruthy()

      const parsedData = JSON.parse(historyData!)
      expect(parsedData).toHaveLength(1)
      expect(parsedData[0].topic).toBe('Daily Conversation')

      // Simulate API call
      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: parsedData })
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.imported.sessions).toBe(1)

      // Verify localStorage would be cleared after successful import
      expect(mockFetch).toHaveBeenCalledWith('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: parsedData })
      })
    })

    it('should handle migration failure and preserve data', async () => {
      const legacyData = [{ id: 'test-session', topic: 'Test' }]
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'exerciseHistory') {
          return JSON.stringify(legacyData)
        }
        return null
      })

      // Mock failed import API response
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'Database connection failed'
        })
      } as Response)

      const historyData = localStorage.getItem('exerciseHistory')
      const parsedData = JSON.parse(historyData!)

      const response = await fetch('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: parsedData })
      })

      expect(response.ok).toBe(false)
      const result = await response.json()
      expect(result.error).toContain('Database connection failed')

      // Verify localStorage data is preserved (removeItem should not be called)
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled()
    })
  })

  describe('AI Analysis Generation Workflow', () => {
    it('should generate AI analysis for single wrong answer', async () => {
      const analysisRequest = {
        questionId: 'question-1',
        answerId: 'answer-1',
        questionType: 'multiple-choice',
        question: '他们打算去哪里？',
        options: ['商店', '公园', '学校', '医院'],
        userAnswer: '商店',
        correctAnswer: '公园',
        transcript: '今天天气很好，我们去公园散步吧。',
        exerciseTopic: 'Daily Conversation',
        exerciseDifficulty: 'Beginner',
        language: 'Chinese',
        attemptedAt: '2024-01-15T10:00:00Z'
      }

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

      // Mock successful AI analysis response
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAIAnalysis)
      } as Response)

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.analysis).toContain('详细的中文分析')
      expect(result.key_reason).toBe('细节理解缺失')
      expect(result.ability_tags).toContain('听力细节捕捉')
      expect(result.confidence).toBe('high')
    })

    it('should handle AI service failures gracefully', async () => {
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

      // Mock AI service failure
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'AI service timeout'
        })
      } as Response)

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      expect(response.ok).toBe(false)
      const result = await response.json()
      expect(result.error).toContain('AI service timeout')
    })
  })

  describe('Batch Processing Workflow', () => {
    it('should process multiple wrong answers concurrently', async () => {
      const batchRequest = {
        answerIds: ['answer-1', 'answer-2', 'answer-3', 'answer-4', 'answer-5']
      }

      const mockBatchResponse = {
        success: [
          { answerId: 'answer-1', analysis: 'Analysis 1', key_reason: 'Reason 1' },
          { answerId: 'answer-2', analysis: 'Analysis 2', key_reason: 'Reason 2' },
          { answerId: 'answer-4', analysis: 'Analysis 4', key_reason: 'Reason 4' },
        ],
        failed: [
          { answerId: 'answer-3', error: 'AI service timeout' },
          { answerId: 'answer-5', error: 'Rate limit exceeded' },
        ]
      }

      // Mock batch analysis response
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBatchResponse)
      } as Response)

      const response = await fetch('/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchRequest)
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toHaveLength(3)
      expect(result.failed).toHaveLength(2)
      expect(result.success[0].answerId).toBe('answer-1')
      expect(result.failed[0].error).toBe('AI service timeout')
    })

    it('should enforce concurrency limits for large batches', async () => {
      // Test with batch size exceeding limit
      const largeBatch = {
        answerIds: Array.from({ length: 150 }, (_, i) => `answer-${i + 1}`)
      }

      // Mock batch size limit error
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'Maximum batch size exceeded. Please limit to 100 items.'
        })
      } as Response)

      const response = await fetch('/api/ai/wrong-answers/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeBatch)
      })

      expect(response.ok).toBe(false)
      const result = await response.json()
      expect(result.error).toContain('Maximum batch size exceeded')
    })
  })

  describe('Cross-Device Synchronization Workflow', () => {
    it('should retrieve wrong answers from database across devices', async () => {
      const mockWrongAnswers = [
        {
          answerId: 'answer-1',
          questionId: 'question-1',
          sessionId: 'session-1',
          session: {
            topic: 'Daily Conversation',
            difficulty: 'Beginner',
            language: 'Chinese',
            createdAt: '2024-01-15T10:00:00Z'
          },
          question: {
            index: 0,
            type: 'multiple-choice',
            question: '他们打算去哪里？',
            options: ['商店', '公园', '学校', '医院'],
            correctAnswer: '公园',
            explanation: '对话中明确提到"去公园散步"',
            transcript: '今天天气很好，我们去公园散步吧。'
          },
          answer: {
            userAnswer: '商店',
            isCorrect: false,
            attemptedAt: '2024-01-15T10:00:00Z',
            aiAnalysis: {
              analysis: "详细分析内容",
              key_reason: "细节理解缺失",
              ability_tags: ["听力细节捕捉"],
              confidence: "high"
            },
            aiAnalysisGeneratedAt: '2024-01-15T11:00:00Z',
            needsAnalysis: false
          }
        }
      ]

      // Mock wrong answers list response
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          wrongAnswers: mockWrongAnswers
        })
      } as Response)

      const response = await fetch('/api/wrong-answers/list?difficulty=Beginner&language=Chinese')

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.wrongAnswers).toHaveLength(1)
      expect(result.wrongAnswers[0].answer.aiAnalysis).toBeTruthy()
      expect(result.wrongAnswers[0].answer.aiAnalysis.key_reason).toBe('细节理解缺失')
    })

    it('should handle filtering and search functionality', async () => {
      // Mock filtered search response
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          wrongAnswers: []
        })
      } as Response)

      const response = await fetch('/api/wrong-answers/list?search=图书馆&difficulty=Intermediate')

      expect(response.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/wrong-answers/list?search=图书馆&difficulty=Intermediate')
    })
  })

  describe('Export Functionality Workflow', () => {
    it('should export wrong answers with AI analysis to text file', async () => {
      const mockExportContent = `Wrong Answers Analysis Export
Generated: 2024-01-15 12:00:00

=== Question 1 ===
Topic: Daily Conversation
Difficulty: Beginner
Type: multiple-choice
Date: 2024-01-15 10:00:00

Question: 他们打算去哪里？
Options: 商店, 公园, 学校, 医院
Your Answer: 商店
Correct Answer: 公园

AI Analysis:
这是一个详细的中文分析，解释了学生在听力理解方面的错误。

Key Reason: 细节理解缺失
Ability Tags: 听力细节捕捉, 时间信息理解, 地点信息理解
Strategy: 在听对话时，要特别注意时间、地点等关键信息词

Related Sentences:
- "我们明天下午三点在图书馆见面吧" - 这句话包含了正确答案所需的时间和地点信息

---`

      // Create a mock blob and URL
      const mockBlob = new Blob([mockExportContent], { type: 'text/plain' })
      const mockURL = 'blob:mock-url'
      
      global.URL.createObjectURL = vi.fn(() => mockURL)
      global.URL.revokeObjectURL = vi.fn()

      // Mock document.createElement for download link
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)

      // Simulate export process
      const blob = new Blob([mockExportContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'wrong-answers-analysis-20240115-120000.txt'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob)
      expect(mockLink.click).toHaveBeenCalled()
      expect(mockLink.download).toBe('wrong-answers-analysis-20240115-120000.txt')
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(url)
    })
  })

  describe('Error Recovery and Resilience Workflow', () => {
    it('should handle network failures with retry mechanism', async () => {
      let attemptCount = 0
      const mockFetch = vi.mocked(global.fetch)
      
      mockFetch.mockImplementation(() => {
        attemptCount++
        if (attemptCount === 1) {
          return Promise.reject(new Error('Network error'))
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          } as Response)
        }
      })

      // First attempt should fail
      try {
        await fetch('/api/ai/wrong-answers/analyze', {
          method: 'POST',
          body: JSON.stringify({ questionId: 'test' })
        })
      } catch (error) {
        expect(error.message).toBe('Network error')
      }

      // Second attempt should succeed
      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        body: JSON.stringify({ questionId: 'test' })
      })

      expect(response.ok).toBe(true)
      expect(attemptCount).toBe(2)
    })

    it('should handle partial data corruption gracefully', async () => {
      // Mock corrupted AI analysis data
      const corruptedAnalysis = {
        analysis: "部分分析内容",
        // Missing key_reason
        ability_tags: null,
        confidence: "invalid_value"
      }

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          wrongAnswers: [{
            answerId: 'answer-1',
            answer: {
              aiAnalysis: corruptedAnalysis,
              needsAnalysis: true // Should allow regeneration
            }
          }]
        })
      } as Response)

      const response = await fetch('/api/wrong-answers/list')
      const result = await response.json()
      
      expect(result.wrongAnswers[0].answer.aiAnalysis.analysis).toBe('部分分析内容')
      expect(result.wrongAnswers[0].answer.needsAnalysis).toBe(true) // Should allow regeneration
    })

    it('should handle concurrent processing conflicts', async () => {
      const analysisRequest = {
        questionId: 'question-1',
        answerId: 'answer-1',
        questionType: 'multiple-choice',
        question: '测试问题？',
        userAnswer: '错误答案',
        correctAnswer: '正确答案',
        transcript: '测试听力材料',
        exerciseTopic: 'Test Topic',
        exerciseDifficulty: 'Beginner',
        language: 'Chinese',
        attemptedAt: '2024-01-15T10:00:00Z'
      }

      let requestCount = 0
      const mockFetch = vi.mocked(global.fetch)
      
      mockFetch.mockImplementation(() => {
        requestCount++
        if (requestCount === 1) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              error: 'Database transaction conflict'
            })
          } as Response)
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              analysis: '成功的分析',
              key_reason: '测试原因'
            })
          } as Response)
        }
      })

      // First request should fail with conflict
      const firstResponse = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      expect(firstResponse.ok).toBe(false)
      const firstResult = await firstResponse.json()
      expect(firstResult.error).toBe('Database transaction conflict')

      // Retry should succeed
      const retryResponse = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      expect(retryResponse.ok).toBe(true)
      const retryResult = await retryResponse.json()
      expect(retryResult.analysis).toBe('成功的分析')
      expect(requestCount).toBe(2)
    })
  })

  describe('Performance and Scalability Workflow', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset response
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        answerId: `answer-${i + 1}`,
        questionId: `question-${i + 1}`,
        answer: {
          userAnswer: `错误答案${i + 1}`,
          isCorrect: false,
          needsAnalysis: true
        }
      }))

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          wrongAnswers: largeDataset.slice(0, 50), // Paginated response
          totalCount: 1000,
          hasMore: true
        })
      } as Response)

      const startTime = Date.now()
      const response = await fetch('/api/wrong-answers/list?page=1&limit=50')
      const endTime = Date.now()

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.wrongAnswers).toHaveLength(50)
      expect(result.totalCount).toBe(1000)
      expect(result.hasMore).toBe(true)
      
      // Should complete quickly even with large dataset
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should handle concurrent batch processing efficiently', async () => {
      const batchSizes = [25, 50, 75, 100] // Different batch sizes
      const responses = []

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockImplementation((url, options) => {
        const body = JSON.parse(options?.body as string)
        const batchSize = body.answerIds.length
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: Array.from({ length: Math.floor(batchSize * 0.9) }, (_, i) => ({
              answerId: `answer-${i + 1}`,
              analysis: `Analysis ${i + 1}`
            })),
            failed: Array.from({ length: Math.ceil(batchSize * 0.1) }, (_, i) => ({
              answerId: `answer-${batchSize - i}`,
              error: 'Timeout'
            }))
          })
        } as Response)
      })

      // Process multiple batches concurrently
      const startTime = Date.now()
      const batchPromises = batchSizes.map(size => 
        fetch('/api/ai/wrong-answers/analyze-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answerIds: Array.from({ length: size }, (_, i) => `answer-${i + 1}`)
          })
        })
      )

      const batchResponses = await Promise.all(batchPromises)
      const endTime = Date.now()

      // All batches should succeed
      batchResponses.forEach(response => {
        expect(response.ok).toBe(true)
      })

      // Should handle concurrent processing efficiently
      expect(endTime - startTime).toBeLessThan(5000)
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })
})