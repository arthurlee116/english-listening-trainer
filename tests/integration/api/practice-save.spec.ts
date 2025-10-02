import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../../../app/api/practice/save/route'
import { createMockExercise } from '../../helpers/mock-utils'
import type { Exercise } from '../../../lib/types'

// Mock Prisma Client
const mockPrismaTransaction = vi.fn()
const mockPracticeSessionCreate = vi.fn()
const mockPracticeQuestionCreate = vi.fn()
const mockPracticeAnswerCreate = vi.fn()

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $transaction: mockPrismaTransaction,
    practiceSession: {
      create: mockPracticeSessionCreate,
    },
    practiceQuestion: {
      create: mockPracticeQuestionCreate,
    },
    practiceAnswer: {
      create: mockPracticeAnswerCreate,
    },
  })),
}))

// Mock auth
vi.mock('../../../lib/auth', () => ({
  requireAuth: vi.fn(),
}))

describe('Practice Save API Integration Tests', () => {
  const mockUser = {
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
  }

  const mockExercise = createMockExercise({
    id: 'test-exercise-1',
    specializedMode: true,
    focusAreas: ['main-idea', 'detail-comprehension'],
    perFocusAccuracy: {
      'main-idea': 85,
      'detail-comprehension': 70,
    },
    focusCoverage: {
      requested: ['main-idea', 'detail-comprehension'],
      provided: ['main-idea', 'detail-comprehension'],
      coverage: 1.0,
      unmatchedTags: [],
      partialMatches: [],
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful auth
    const { requireAuth } = require('../../../lib/auth')
    requireAuth.mockResolvedValue({
      user: mockUser,
      error: null,
    })

    // Mock successful database operations
    mockPrismaTransaction.mockImplementation(async (callback) => {
      const mockTx = {
        practiceSession: { create: mockPracticeSessionCreate },
        practiceQuestion: { create: mockPracticeQuestionCreate },
        practiceAnswer: { create: mockPracticeAnswerCreate },
      }
      return callback(mockTx)
    })

    mockPracticeSessionCreate.mockResolvedValue({
      id: 'session-123',
      createdAt: new Date('2024-01-15T10:00:00Z'),
    })

    mockPracticeQuestionCreate.mockResolvedValue({
      id: 'question-123',
    })

    mockPracticeAnswerCreate.mockResolvedValue({
      id: 'answer-123',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Mocked Prisma Operations', () => {
    it('should save practice session with specialized field handling', async () => {
      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        language: 'en-US',
        topic: 'Technology Innovation',
        accuracy: 85,
        score: 85,
        duration: 180,
        focusAreas: ['main-idea', 'detail-comprehension'],
        focusCoverage: mockExercise.focusCoverage,
        specializedMode: true,
        achievementMetadata: { streak: 3, newAchievements: [] },
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.message).toBe('练习记录保存成功')
      expect(responseData.session.id).toBe('session-123')

      // Verify practice session was created with correct data
      expect(mockPracticeSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-123',
          difficulty: 'B1',
          language: 'en-US',
          topic: 'Technology Innovation',
          accuracy: 85,
          score: 85,
          duration: 180,
          exerciseData: expect.stringContaining('specializedMode'),
        }),
      })

      // Verify specialized fields are included in exerciseData
      const exerciseDataArg = mockPracticeSessionCreate.mock.calls[0][0].data.exerciseData
      const parsedExerciseData = JSON.parse(exerciseDataArg)
      expect(parsedExerciseData.specializedMode).toBe(true)
      expect(parsedExerciseData.focusAreas).toEqual(['main-idea', 'detail-comprehension'])
      expect(parsedExerciseData.perFocusAccuracy).toEqual({
        'main-idea': 85,
        'detail-comprehension': 70,
      })
    })

    it('should handle payload processing with focus area calculations', async () => {
      const exerciseWithQuestions = createMockExercise({
        questions: [
          {
            type: 'single',
            question: 'What is the main topic?',
            options: ['A', 'B', 'C', 'D'],
            answer: 'A',
            focus_areas: ['main-idea'],
            explanation: 'Test explanation',
          },
          {
            type: 'single',
            question: 'What detail was mentioned?',
            options: ['X', 'Y', 'Z', 'W'],
            answer: 'Y',
            focus_areas: ['detail-comprehension'],
            explanation: 'Test explanation 2',
          },
        ],
        results: [
          {
            type: 'single',
            user_answer: 'A',
            correct_answer: 'A',
            is_correct: true,
            question_id: 0,
            error_tags: [],
          },
          {
            type: 'single',
            user_answer: 'X',
            correct_answer: 'Y',
            is_correct: false,
            question_id: 1,
            error_tags: [],
          },
        ],
      })

      const requestBody = {
        exerciseData: exerciseWithQuestions,
        difficulty: 'B1',
        language: 'en-US',
        topic: 'Test Topic',
        accuracy: 50,
        specializedMode: true,
        focusAreas: ['main-idea', 'detail-comprehension'],
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Verify questions were created with focus areas
      expect(mockPracticeQuestionCreate).toHaveBeenCalledTimes(2)
      
      const firstQuestionCall = mockPracticeQuestionCreate.mock.calls[0][0]
      expect(firstQuestionCall.data.focusAreas).toBe('["main-idea"]')
      expect(firstQuestionCall.data.question).toBe('What is the main topic?')

      const secondQuestionCall = mockPracticeQuestionCreate.mock.calls[1][0]
      expect(secondQuestionCall.data.focusAreas).toBe('["detail-comprehension"]')
      expect(secondQuestionCall.data.question).toBe('What detail was mentioned?')

      // Verify answers were created
      expect(mockPracticeAnswerCreate).toHaveBeenCalledTimes(2)
      
      const firstAnswerCall = mockPracticeAnswerCreate.mock.calls[0][0]
      expect(firstAnswerCall.data.isCorrect).toBe(true)
      expect(firstAnswerCall.data.needsAnalysis).toBe(false)

      const secondAnswerCall = mockPracticeAnswerCreate.mock.calls[1][0]
      expect(secondAnswerCall.data.isCorrect).toBe(false)
      expect(secondAnswerCall.data.needsAnalysis).toBe(true)
    })

    it('should handle string exerciseData parsing', async () => {
      const requestBody = {
        exerciseData: JSON.stringify(mockExercise), // String instead of object
        difficulty: 'B1',
        language: 'en-US',
        topic: 'Test Topic',
        specializedMode: true,
        focusAreas: ['main-idea'],
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Should successfully parse string exerciseData
      expect(mockPracticeSessionCreate).toHaveBeenCalled()
    })
  })

  describe('Error Handling and Validation', () => {
    it('should handle authentication failures', async () => {
      const { requireAuth } = require('../../../lib/auth')
      requireAuth.mockResolvedValue({
        user: null,
        error: 'Unauthorized',
      })

      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Unauthorized')
      expect(mockPracticeSessionCreate).not.toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      const requestBody = {
        // Missing exerciseData, difficulty, and topic
        language: 'en-US',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.error).toBe('练习数据不完整')
      expect(mockPracticeSessionCreate).not.toHaveBeenCalled()
    })

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(500)
    })

    it('should handle database transaction failures', async () => {
      mockPrismaTransaction.mockRejectedValue(new Error('Database connection failed'))

      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.error).toBe('保存失败，请稍后重试')
    })

    it('should handle corrupted exerciseData gracefully', async () => {
      const requestBody = {
        exerciseData: 'invalid-json-string',
        difficulty: 'B1',
        topic: 'Test Topic',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200) // Should still succeed with fallback

      // Should use empty object as fallback
      const exerciseDataArg = mockPracticeSessionCreate.mock.calls[0][0].data.exerciseData
      const parsedExerciseData = JSON.parse(exerciseDataArg)
      expect(typeof parsedExerciseData).toBe('object')
    })

    it('should handle missing focus areas in questions', async () => {
      const exerciseWithoutFocusAreas = createMockExercise({
        questions: [
          {
            type: 'single',
            question: 'Test question',
            options: ['A', 'B'],
            answer: 'A',
            focus_areas: undefined, // Missing focus areas
            explanation: 'Test',
          },
        ],
        results: [
          {
            type: 'single',
            user_answer: 'A',
            correct_answer: 'A',
            is_correct: true,
            question_id: 0,
            error_tags: [],
          },
        ],
      })

      const requestBody = {
        exerciseData: exerciseWithoutFocusAreas,
        difficulty: 'B1',
        topic: 'Test Topic',
        specializedMode: true,
        focusAreas: ['main-idea'],
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Should handle missing focus areas gracefully
      expect(mockPracticeQuestionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          focusAreas: null, // Should be null when focus_areas is missing
        }),
      })
    })
  })

  describe('Authentication and Authorization', () => {
    it('should handle missing authentication token', async () => {
      const { requireAuth } = require('../../../lib/auth')
      requireAuth.mockResolvedValue({
        user: null,
        error: '未登录',
      })

      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toBe('未登录')
    })

    it('should handle expired authentication token', async () => {
      const { requireAuth } = require('../../../lib/auth')
      requireAuth.mockResolvedValue({
        user: null,
        error: 'Token expired',
      })

      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Token expired')
    })

    it('should pass correct user ID to database operations', async () => {
      const customUser = {
        userId: 'custom-user-456',
        email: 'custom@example.com',
        name: 'Custom User',
      }

      const { requireAuth } = require('../../../lib/auth')
      requireAuth.mockResolvedValue({
        user: customUser,
        error: null,
      })

      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      expect(mockPracticeSessionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'custom-user-456',
        }),
      })
    })
  })

  describe('Specialized Field Processing', () => {
    it('should calculate per-focus accuracy correctly', async () => {
      const exerciseWithMixedResults = createMockExercise({
        questions: [
          {
            type: 'single',
            question: 'Main idea question 1',
            options: ['A', 'B'],
            answer: 'A',
            focus_areas: ['main-idea'],
            explanation: 'Test',
          },
          {
            type: 'single',
            question: 'Main idea question 2',
            options: ['C', 'D'],
            answer: 'C',
            focus_areas: ['main-idea'],
            explanation: 'Test',
          },
          {
            type: 'single',
            question: 'Detail question',
            options: ['E', 'F'],
            answer: 'E',
            focus_areas: ['detail-comprehension'],
            explanation: 'Test',
          },
        ],
        results: [
          { type: 'single', user_answer: 'A', correct_answer: 'A', is_correct: true, question_id: 0, error_tags: [] },
          { type: 'single', user_answer: 'D', correct_answer: 'C', is_correct: false, question_id: 1, error_tags: [] },
          { type: 'single', user_answer: 'E', correct_answer: 'E', is_correct: true, question_id: 2, error_tags: [] },
        ],
      })

      const requestBody = {
        exerciseData: exerciseWithMixedResults,
        difficulty: 'B1',
        topic: 'Test Topic',
        specializedMode: true,
        focusAreas: ['main-idea', 'detail-comprehension'],
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const exerciseDataArg = mockPracticeSessionCreate.mock.calls[0][0].data.exerciseData
      const parsedExerciseData = JSON.parse(exerciseDataArg)
      
      // main-idea: 1 correct out of 2 = 50%
      // detail-comprehension: 1 correct out of 1 = 100%
      expect(parsedExerciseData.perFocusAccuracy).toEqual({
        'main-idea': 50,
        'detail-comprehension': 100,
      })
    })

    it('should handle focus coverage data correctly', async () => {
      const focusCoverage = {
        requested: ['main-idea', 'detail-comprehension', 'inference'],
        provided: ['main-idea', 'detail-comprehension'],
        coverage: 0.67,
        unmatchedTags: ['inference'],
        partialMatches: [],
      }

      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
        specializedMode: true,
        focusAreas: ['main-idea', 'detail-comprehension', 'inference'],
        focusCoverage,
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const exerciseDataArg = mockPracticeSessionCreate.mock.calls[0][0].data.exerciseData
      const parsedExerciseData = JSON.parse(exerciseDataArg)
      
      expect(parsedExerciseData.focusCoverage).toEqual(focusCoverage)
      expect(parsedExerciseData.specializedMode).toBe(true)
    })

    it('should handle non-specialized mode correctly', async () => {
      const requestBody = {
        exerciseData: mockExercise,
        difficulty: 'B1',
        topic: 'Test Topic',
        specializedMode: false, // Non-specialized
      }

      const request = new NextRequest('http://localhost:3000/api/practice/save', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const exerciseDataArg = mockPracticeSessionCreate.mock.calls[0][0].data.exerciseData
      const parsedExerciseData = JSON.parse(exerciseDataArg)
      
      // Should not include specialized fields
      expect(parsedExerciseData.specializedMode).toBeUndefined()
      expect(parsedExerciseData.focusAreas).toBeUndefined()
      expect(parsedExerciseData.perFocusAccuracy).toBeUndefined()
    })
  })
})