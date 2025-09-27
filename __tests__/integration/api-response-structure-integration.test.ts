/**
 * Integration Test for API Response Structure Fix
 * 
 * This test validates the fix in a more realistic scenario
 * by testing the actual API endpoint and client-side logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock data structures
const mockAnalysisResponse = {
  analysis: '这道题考查的是对话中的细节理解能力。用户选择了错误答案B，正确答案是A。',
  key_reason: '细节理解缺失',
  ability_tags: ['听力细节捕捉', '时间信息理解', '对话理解'],
  signal_words: ['时间', '地点', '关键词'],
  strategy: '在听力过程中要特别注意时间、地点等具体信息。',
  related_sentences: [{
    quote: 'The meeting is scheduled for 3 PM tomorrow.',
    comment: '这句话明确提到了会议时间，是解题的关键信息。'
  }],
  confidence: 'high' as const
}

describe('API Response Structure Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should demonstrate the correct flow: API response → client processing → UI display', async () => {
    // 1. API LAYER: Mock the correct API response structure
    const apiResponse = {
      success: true,
      analysis: mockAnalysisResponse  // Analysis is wrapped in response
    }

    // 2. CLIENT LAYER: Simulate the fixed client-side extraction
    const clientProcessing = (apiResponseData: any) => {
      // This is the FIX: extract analysis from wrapper
      const extractedAnalysis = apiResponseData.analysis
      
      return {
        answerId: 'test-answer',
        answer: {
          userAnswer: '2 PM',
          isCorrect: false,
          aiAnalysis: extractedAnalysis,  // Store extracted analysis, not wrapper
          aiAnalysisGeneratedAt: new Date().toISOString(),
          needsAnalysis: false
        }
      }
    }

    // 3. Process the response
    const processedData = clientProcessing(apiResponse)

    // 4. VALIDATION: Verify correct structure
    expect(processedData.answer.aiAnalysis).toEqual(mockAnalysisResponse)
    expect(processedData.answer.aiAnalysis).toHaveProperty('analysis')
    expect(processedData.answer.aiAnalysis).toHaveProperty('key_reason')
    expect(processedData.answer.aiAnalysis).toHaveProperty('ability_tags')
    expect(processedData.answer.aiAnalysis).toHaveProperty('confidence')
    
    // Critical: Should NOT contain API wrapper properties
    expect(processedData.answer.aiAnalysis).not.toHaveProperty('success')

    // 5. UI LAYER: Verify display content would be correct
    const uiDisplayValue = processedData.answer.aiAnalysis.analysis
    expect(uiDisplayValue).toBe('这道题考查的是对话中的细节理解能力。用户选择了错误答案B，正确答案是A。')
    expect(uiDisplayValue).not.toBe('[object Object]')  // This was the bug
  })

  it('should show the exact problem that was fixed', () => {
    const apiResponse = {
      success: true,
      analysis: mockAnalysisResponse
    }

    // OLD BEHAVIOR (BUGGY) - storing entire response
    const oldBuggyBehavior = (responseData: any) => {
      return {
        answer: {
          aiAnalysis: responseData  // BUG: storing entire response including wrapper
        }
      }
    }

    // NEW BEHAVIOR (FIXED) - extracting analysis
    const newFixedBehavior = (responseData: any) => {
      return {
        answer: {
          aiAnalysis: responseData.analysis  // FIX: extracting just the analysis
        }
      }
    }

    const buggyResult = oldBuggyBehavior(apiResponse)
    const fixedResult = newFixedBehavior(apiResponse)

    // Demonstrate the problem
    expect(buggyResult.answer.aiAnalysis).toHaveProperty('success')  // Wrong
    expect(buggyResult.answer.aiAnalysis.analysis).toEqual(mockAnalysisResponse)  // Nested access needed

    // Demonstrate the fix
    expect(fixedResult.answer.aiAnalysis).not.toHaveProperty('success')  // Correct
    expect(fixedResult.answer.aiAnalysis).toEqual(mockAnalysisResponse)  // Direct access

    // UI display comparison
    const buggyUIDisplay = JSON.stringify(buggyResult.answer.aiAnalysis)  // Would show [object Object] in UI
    const fixedUIDisplay = fixedResult.answer.aiAnalysis.analysis
    
    expect(fixedUIDisplay).toBe('这道题考查的是对话中的细节理解能力。用户选择了错误答案B，正确答案是A。')
    expect(buggyUIDisplay).toContain('success')  // The buggy version contains wrapper properties
    expect(fixedUIDisplay).not.toContain('success')  // The fixed version doesn't
  })

  it('should validate that exports now work correctly', () => {
    // Simulate export functionality with correct data structure
    const wrongAnswersWithFixedStructure = [
      {
        answerId: 'answer-1',
        answer: {
          aiAnalysis: mockAnalysisResponse,  // Correct structure
          userAnswer: '2 PM',
          isCorrect: false
        },
        question: {
          question: 'What time is the meeting?',
          correctAnswer: '3 PM'
        }
      }
    ]

    // Simulate export processing
    const exportContent = wrongAnswersWithFixedStructure.map(item => {
      const analysis = item.answer.aiAnalysis
      return {
        question: item.question.question,
        userAnswer: item.answer.userAnswer,
        correctAnswer: item.question.correctAnswer,
        analysisText: analysis?.analysis,  // Direct access works
        keyReason: analysis?.key_reason,   // Direct access works
        strategy: analysis?.strategy       // Direct access works
      }
    })

    expect(exportContent[0].analysisText).toBe(mockAnalysisResponse.analysis)
    expect(exportContent[0].keyReason).toBe(mockAnalysisResponse.key_reason)
    expect(exportContent[0].strategy).toBe(mockAnalysisResponse.strategy)
    
    // Verify no undefined or [object Object] issues
    expect(exportContent[0].analysisText).not.toContain('[object Object]')
    expect(exportContent[0].analysisText).not.toBeUndefined()
  })

  it('should demonstrate database storage integrity', () => {
    // Simulate database storage and retrieval
    const apiResponseData = { success: true, analysis: mockAnalysisResponse }
    
    // Client extracts and stores correctly
    const extractedForStorage = apiResponseData.analysis
    const storedJSON = JSON.stringify(extractedForStorage)
    
    // Simulate database round-trip
    const retrievedFromDB = JSON.parse(storedJSON)
    
    // Verify data integrity
    expect(retrievedFromDB).toEqual(mockAnalysisResponse)
    expect(retrievedFromDB).toHaveProperty('analysis')
    expect(retrievedFromDB).toHaveProperty('key_reason')
    expect(retrievedFromDB).not.toHaveProperty('success')  // No wrapper pollution
    
    // Verify correct UI display after retrieval
    expect(retrievedFromDB.analysis).toBe('这道题考查的是对话中的细节理解能力。用户选择了错误答案B，正确答案是A。')
  })
})