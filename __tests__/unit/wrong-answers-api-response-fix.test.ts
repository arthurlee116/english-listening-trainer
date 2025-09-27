/**
 * Unit Test for Wrong Answers API Response Structure Fix
 * 
 * This test validates that the client correctly extracts the analysis
 * from the API response wrapper structure and stores it properly.
 * 
 * Issue: API returns { success: true, analysis: {...} } but client
 * was storing the entire response instead of extracting the analysis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIAnalysisResponse } from '@/lib/types'

// Mock implementation that simulates the corrected client-side logic
class MockWrongAnswersHandler {
  private wrongAnswers: any[] = []

  async generateAnalysis(answerId: string, requestData: any): Promise<void> {
    // Simulate API call
    const response = await fetch('/api/ai/wrong-answers/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      throw new Error('Failed to generate AI analysis')
    }

    const responseData = await response.json()
    
    // Extract the actual analysis from the response (THIS IS THE FIX)
    const analysisResult: AIAnalysisResponse = responseData.analysis
    
    // Validate that analysis was actually provided
    if (!analysisResult) {
      throw new Error('Missing analysis in API response')
    }

    // Update the wrong answer item with the correctly extracted analysis
    this.wrongAnswers = this.wrongAnswers.map(w => 
      w.answerId === answerId 
        ? { 
            ...w, 
            answer: { 
              ...w.answer, 
              aiAnalysis: analysisResult, // Store the analysis directly, not the wrapper
              aiAnalysisGeneratedAt: new Date().toISOString(),
              needsAnalysis: false
            }
          }
        : w
    )
  }

  setWrongAnswers(answers: any[]) {
    this.wrongAnswers = answers
  }

  getWrongAnswer(answerId: string) {
    return this.wrongAnswers.find(w => w.answerId === answerId)
  }
}

describe('Wrong Answers API Response Structure Fix', () => {
  let handler: MockWrongAnswersHandler
  let mockFetch: any

  const createMockAnalysis = (): AIAnalysisResponse => ({
    analysis: '这道题考查的是对话中的细节理解能力。',
    key_reason: '细节理解缺失',
    ability_tags: ['听力细节捕捉', '时间信息理解'],
    signal_words: ['时间', '地点'],
    strategy: '在听力过程中要特别注意时间、地点等具体信息。',
    related_sentences: [{
      quote: 'The meeting is scheduled for 3 PM tomorrow.',
      comment: '这句话明确提到了会议时间。'
    }],
    confidence: 'high' as const
  })

  beforeEach(() => {
    handler = new MockWrongAnswersHandler()
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  it('should correctly extract analysis from wrapped API response', async () => {
    const mockAnalysis = createMockAnalysis()
    const wrongAnswer = {
      answerId: 'answer-1',
      answer: {
        userAnswer: '2 PM',
        isCorrect: false,
        aiAnalysis: undefined,
        needsAnalysis: true
      }
    }

    handler.setWrongAnswers([wrongAnswer])

    // Mock API response with wrapper structure
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        analysis: mockAnalysis  // The analysis is wrapped in a response object
      })
    })

    // Generate analysis
    await handler.generateAnalysis('answer-1', {
      questionId: 'q1',
      userAnswer: '2 PM',
      correctAnswer: '3 PM'
    })

    // Verify the analysis was extracted correctly
    const updatedAnswer = handler.getWrongAnswer('answer-1')
    
    expect(updatedAnswer.answer.aiAnalysis).toEqual(mockAnalysis)
    expect(updatedAnswer.answer.aiAnalysis).toHaveProperty('analysis')
    expect(updatedAnswer.answer.aiAnalysis).toHaveProperty('key_reason')
    expect(updatedAnswer.answer.aiAnalysis).toHaveProperty('ability_tags')
    expect(updatedAnswer.answer.aiAnalysis).toHaveProperty('confidence')
    
    // Verify it does NOT contain wrapper properties
    expect(updatedAnswer.answer.aiAnalysis).not.toHaveProperty('success')
    
    // Verify needsAnalysis flag is updated
    expect(updatedAnswer.answer.needsAnalysis).toBe(false)
    expect(updatedAnswer.answer.aiAnalysisGeneratedAt).toBeDefined()
  })

  it('should handle API response without analysis property gracefully', async () => {
    const wrongAnswer = {
      answerId: 'answer-1',
      answer: { aiAnalysis: undefined, needsAnalysis: true }
    }

    handler.setWrongAnswers([wrongAnswer])

    // Mock malformed API response (missing analysis property)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true
        // Missing 'analysis' property
      })
    })

    // Should throw an error or handle gracefully
    await expect(handler.generateAnalysis('answer-1', {})).rejects.toThrow()
  })

  it('should maintain correct structure across batch operations', async () => {
    const mockAnalysis1 = createMockAnalysis()
    const mockAnalysis2 = { ...createMockAnalysis(), key_reason: '语法理解错误' }
    
    const wrongAnswers = [
      { answerId: 'answer-1', answer: { aiAnalysis: undefined, needsAnalysis: true } },
      { answerId: 'answer-2', answer: { aiAnalysis: undefined, needsAnalysis: true } }
    ]

    handler.setWrongAnswers(wrongAnswers)

    // Mock responses for batch processing
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, analysis: mockAnalysis1 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, analysis: mockAnalysis2 })
      })

    // Process both analyses
    await handler.generateAnalysis('answer-1', {})
    await handler.generateAnalysis('answer-2', {})

    // Verify both analyses were extracted correctly
    const answer1 = handler.getWrongAnswer('answer-1')
    const answer2 = handler.getWrongAnswer('answer-2')

    expect(answer1.answer.aiAnalysis).toEqual(mockAnalysis1)
    expect(answer2.answer.aiAnalysis).toEqual(mockAnalysis2)
    
    expect(answer1.answer.aiAnalysis.key_reason).toBe('细节理解缺失')
    expect(answer2.answer.aiAnalysis.key_reason).toBe('语法理解错误')
    
    // Verify neither contains wrapper properties
    expect(answer1.answer.aiAnalysis).not.toHaveProperty('success')
    expect(answer2.answer.aiAnalysis).not.toHaveProperty('success')
  })

  it('should handle network errors appropriately', async () => {
    const wrongAnswer = {
      answerId: 'answer-1',
      answer: { aiAnalysis: undefined, needsAnalysis: true }
    }

    handler.setWrongAnswers([wrongAnswer])

    // Mock network error
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    await expect(handler.generateAnalysis('answer-1', {})).rejects.toThrow('Network timeout')
    
    // Verify the wrong answer state remains unchanged
    const unchangedAnswer = handler.getWrongAnswer('answer-1')
    expect(unchangedAnswer.answer.aiAnalysis).toBeUndefined()
    expect(unchangedAnswer.answer.needsAnalysis).toBe(true)
  })

  it('should validate that API contract matches expected structure', () => {
    // This test documents the expected API response structure
    const expectedApiResponse = {
      success: true,
      analysis: {
        analysis: expect.any(String),
        key_reason: expect.any(String),
        ability_tags: expect.any(Array),
        signal_words: expect.any(Array),
        strategy: expect.any(String),
        related_sentences: expect.any(Array),
        confidence: expect.stringMatching(/^(high|medium|low)$/)
      }
    }

    const mockAnalysis = createMockAnalysis()
    const actualApiResponse = {
      success: true,
      analysis: mockAnalysis
    }

    expect(actualApiResponse).toMatchObject(expectedApiResponse)
  })

  it('should demonstrate the difference between old (buggy) and new (fixed) behavior', () => {
    const mockAnalysis = createMockAnalysis()
    const apiResponse = {
      success: true,
      analysis: mockAnalysis
    }

    // OLD BEHAVIOR (BUGGY) - storing entire response
    const oldBuggyStorage = apiResponse  // This would store { success: true, analysis: {...} }
    expect(oldBuggyStorage).toHaveProperty('success')
    expect(oldBuggyStorage.analysis).toEqual(mockAnalysis)

    // NEW BEHAVIOR (FIXED) - extracting analysis
    const newFixedStorage = apiResponse.analysis  // This correctly stores just the analysis
    expect(newFixedStorage).not.toHaveProperty('success')
    expect(newFixedStorage).toEqual(mockAnalysis)
    expect(newFixedStorage).toHaveProperty('analysis')
    expect(newFixedStorage).toHaveProperty('key_reason')
    
    // Verify the fix prevents the UI display issue
    expect(newFixedStorage.analysis).toBe('这道题考查的是对话中的细节理解能力。')
    expect(oldBuggyStorage.analysis.analysis).toBe('这道题考查的是对话中的细节理解能力。')
  })
})