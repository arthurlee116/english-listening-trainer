import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only module
vi.mock('server-only', () => ({}))

// Mock the ark-helper module
vi.mock('../../lib/ark-helper', () => ({
  callArkAPI: vi.fn()
}))

import { analyzeWrongAnswer, batchAnalyzeWrongAnswers } from '../../lib/ai-analysis-service'
import type { AnalysisRequest, AnalysisResponse } from '../../lib/ai-analysis-service'

const { callArkAPI } = await import('../../lib/ark-helper')
const mockCallArkAPI = vi.mocked(callArkAPI)

describe('AI Analysis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockRequest: AnalysisRequest = {
    questionType: 'single',
    question: 'What is the main topic of the conversation?',
    options: ['Travel plans', 'Work schedule', 'Weather forecast', 'Restaurant review'],
    userAnswer: 'Weather forecast',
    correctAnswer: 'Travel plans',
    transcript: 'A: Are you ready for our trip to Paris next week? B: Yes, I\'ve packed everything and booked the hotel.',
    exerciseTopic: 'Travel and Tourism',
    exerciseDifficulty: 'B1',
    language: 'en-US',
    attemptedAt: '2024-01-15T10:30:00Z'
  }

  const mockValidResponse: AnalysisResponse = {
    analysis: '学生选择了"天气预报"作为答案，但正确答案应该是"旅行计划"。从听力材料中可以清楚地听到两人在讨论下周去巴黎的旅行，包括打包行李和预订酒店等具体安排。学生可能是因为没有仔细听取对话的核心内容，或者被某些词汇误导。建议在听力过程中重点关注对话的主要话题和关键信息，而不是被细节词汇分散注意力。',
    key_reason: '主题理解偏差',
    ability_tags: ['听力主旨理解', '对话分析', '关键信息提取'],
    signal_words: ['trip', 'Paris', 'next week', 'packed', 'booked', 'hotel'],
    strategy: '在听多选题时，要先快速浏览选项，预测可能的话题方向。听音频时重点关注对话开头和结尾的关键信息，这些通常包含主要话题。避免被单个词汇误导，要从整体对话内容判断主题。',
    related_sentences: [
      {
        quote: 'Are you ready for our trip to Paris next week?',
        comment: '这句话直接点明了对话的主题是关于旅行计划，而不是天气'
      },
      {
        quote: 'I\'ve packed everything and booked the hotel',
        comment: '这句话进一步确认了他们在讨论旅行的具体准备工作'
      }
    ],
    confidence: 'high'
  }

  describe('analyzeWrongAnswer', () => {
    it('should successfully analyze a wrong answer', async () => {
      mockCallArkAPI.mockResolvedValueOnce(mockValidResponse)

      const result = await analyzeWrongAnswer(mockRequest)

      expect(result).toEqual(mockValidResponse)
      expect(mockCallArkAPI).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('专业的语言学习导师')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Travel and Tourism')
          })
        ]),
        expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            analysis: expect.any(Object),
            key_reason: expect.any(Object),
            ability_tags: expect.any(Object)
          })
        }),
        'wrong_answer_analysis',
        3
      )
    })

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API connection failed')
      mockCallArkAPI.mockRejectedValueOnce(apiError)

      await expect(analyzeWrongAnswer(mockRequest)).rejects.toThrow('AI分析失败: API connection failed')
    })

    it('should validate response structure', async () => {
      const invalidResponse = {
        analysis: 'short', // Too short
        key_reason: '',    // Empty
        ability_tags: 'not an array', // Wrong type
        confidence: 'invalid' // Invalid enum value
      }
      
      mockCallArkAPI.mockResolvedValueOnce(invalidResponse)

      await expect(analyzeWrongAnswer(mockRequest)).rejects.toThrow('AI分析失败: Invalid analysis response structure')
    })

    it('should create proper prompt with all context variables', async () => {
      mockCallArkAPI.mockResolvedValueOnce(mockValidResponse)

      await analyzeWrongAnswer(mockRequest)

      const callArgs = mockCallArkAPI.mock.calls[0]
      const userMessage = callArgs[0].find(msg => msg.role === 'user')
      
      expect(userMessage?.content).toContain('Travel and Tourism') // exerciseTopic
      expect(userMessage?.content).toContain('B1') // exerciseDifficulty
      expect(userMessage?.content).toContain('en-US') // language
      expect(userMessage?.content).toContain('What is the main topic') // question
      expect(userMessage?.content).toContain('Weather forecast') // userAnswer
      expect(userMessage?.content).toContain('Travel plans') // correctAnswer
      expect(userMessage?.content).toContain('Are you ready for our trip') // transcript
      expect(userMessage?.content).toContain('A. Travel plans') // options formatted
    })
  })

  describe('batchAnalyzeWrongAnswers', () => {
    it('should process multiple requests successfully', async () => {
      const requests = [mockRequest, { ...mockRequest, userAnswer: 'Work schedule' }]
      
      mockCallArkAPI
        .mockResolvedValueOnce(mockValidResponse)
        .mockResolvedValueOnce({ ...mockValidResponse, key_reason: '选项混淆' })

      const result = await batchAnalyzeWrongAnswers(requests)

      expect(result.success).toHaveLength(2)
      expect(result.failed).toHaveLength(0)
      expect(result.success[0]).toEqual(mockValidResponse)
      expect(result.success[1].key_reason).toBe('选项混淆')
    })

    it('should handle partial failures in batch processing', async () => {
      const requests = [mockRequest, mockRequest, mockRequest]
      
      mockCallArkAPI
        .mockResolvedValueOnce(mockValidResponse)
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockResolvedValueOnce(mockValidResponse)

      const result = await batchAnalyzeWrongAnswers(requests)

      expect(result.success).toHaveLength(2)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0]).toEqual({
        index: 1,
        error: 'AI分析失败: API timeout'
      })
    })

    it('should process requests in batches', async () => {
      // Create 12 requests to test batching (batch size is 5)
      const requests = Array(12).fill(mockRequest)
      
      mockCallArkAPI.mockResolvedValue(mockValidResponse)

      await batchAnalyzeWrongAnswers(requests)

      // Should be called 12 times (all requests processed)
      expect(mockCallArkAPI).toHaveBeenCalledTimes(12)
    })
  })

  describe('prompt template', () => {
    it('should handle questions without options (short answer)', async () => {
      const shortAnswerRequest: AnalysisRequest = {
        ...mockRequest,
        questionType: 'short',
        options: undefined,
        question: 'What city are they planning to visit?',
        userAnswer: 'London',
        correctAnswer: 'Paris'
      }

      mockCallArkAPI.mockResolvedValueOnce(mockValidResponse)

      await analyzeWrongAnswer(shortAnswerRequest)

      const callArgs = mockCallArkAPI.mock.calls[0]
      const userMessage = callArgs[0].find(msg => msg.role === 'user')
      
      expect(userMessage?.content).toContain('What city are they planning to visit?')
      expect(userMessage?.content).not.toContain('选项：') // Should not contain options section
    })

    it('should include confidence level requirements in prompt', async () => {
      mockCallArkAPI.mockResolvedValueOnce(mockValidResponse)

      await analyzeWrongAnswer(mockRequest)

      const callArgs = mockCallArkAPI.mock.calls[0]
      const userMessage = callArgs[0].find(msg => msg.role === 'user')
      
      expect(userMessage?.content).toContain('置信度 (confidence)')
      expect(userMessage?.content).toContain('high: 错误原因明确')
      expect(userMessage?.content).toContain('medium: 错误原因较清楚')
      expect(userMessage?.content).toContain('low: 错误原因不够明确')
    })
  })
})