import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Exercise } from '@/lib/types'
import {
  hasLegacyData,
  getLegacyData,
  formatLegacyDataForImport,
  uploadLegacyData,
  clearLegacyData,
  migrateLegacyData
} from '@/lib/legacy-migration-service'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// Mock fetch
const fetchMock = vi.fn()

// Setup mocks
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
  global.fetch = fetchMock
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Sample legacy exercise data
const sampleExercise: Exercise = {
  id: 'test-exercise-1',
  difficulty: 'B1',
  language: 'en-US',
  topic: 'Travel and Tourism',
  transcript: 'This is a sample transcript about travel.',
  questions: [
    {
      type: 'single',
      question: 'What is the main topic?',
      options: ['Travel', 'Food', 'Sports', 'Music'],
      answer: 'Travel',
      explanation: 'The transcript discusses travel topics.'
    },
    {
      type: 'short',
      question: 'What did the speaker mention about hotels?',
      answer: 'They are expensive',
      explanation: 'The speaker mentioned hotel costs.'
    }
  ],
  answers: {
    0: 'Travel',
    1: 'They are expensive'
  },
  results: [
    {
      type: 'single',
      user_answer: 'Travel',
      correct_answer: 'Travel',
      is_correct: true,
      question_id: 0
    },
    {
      type: 'short',
      user_answer: 'They are expensive',
      correct_answer: 'They are expensive',
      is_correct: true,
      question_id: 1
    }
  ],
  createdAt: '2024-01-15T10:30:00.000Z'
}

describe('Legacy Migration Service', () => {
  describe('hasLegacyData', () => {
    it('should return true when legacy data exists', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([sampleExercise]))
      
      expect(hasLegacyData()).toBe(true)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('english-listening-history')
    })

    it('should return false when no legacy data exists', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      expect(hasLegacyData()).toBe(false)
    })

    it('should return false when localStorage contains invalid data', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json')
      
      expect(hasLegacyData()).toBe(false)
    })

    it('should return false when localStorage contains empty array', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))
      
      expect(hasLegacyData()).toBe(false)
    })
  })

  describe('getLegacyData', () => {
    it('should return exercises when legacy data exists', () => {
      const exercises = [sampleExercise]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(exercises))
      
      const result = getLegacyData()
      
      expect(result).toEqual(exercises)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('english-listening-history')
    })

    it('should return empty array when no data exists', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const result = getLegacyData()
      
      expect(result).toEqual([])
    })

    it('should return empty array when localStorage contains invalid data', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json')
      
      const result = getLegacyData()
      
      expect(result).toEqual([])
    })
  })

  describe('formatLegacyDataForImport', () => {
    it('should correctly format exercise data for import API', () => {
      const exercises = [sampleExercise]
      
      const result = formatLegacyDataForImport(exercises)
      
      expect(result).toEqual({
        sessions: [
          {
            sessionId: 'test-exercise-1',
            topic: 'Travel and Tourism',
            difficulty: 'B1',
            language: 'en-US',
            transcript: 'This is a sample transcript about travel.',
            score: 100, // 2/2 correct = 100%
            createdAt: '2024-01-15T10:30:00.000Z',
            questions: [
              {
                index: 0,
                type: 'single',
                question: 'What is the main topic?',
                options: ['Travel', 'Food', 'Sports', 'Music'],
                correctAnswer: 'Travel',
                explanation: 'The transcript discusses travel topics.',
                answers: [
                  {
                    userAnswer: 'Travel',
                    isCorrect: true,
                    attemptedAt: '2024-01-15T10:30:00.000Z'
                  }
                ]
              },
              {
                index: 1,
                type: 'short',
                question: 'What did the speaker mention about hotels?',
                correctAnswer: 'They are expensive',
                explanation: 'The speaker mentioned hotel costs.',
                answers: [
                  {
                    userAnswer: 'They are expensive',
                    isCorrect: true,
                    attemptedAt: '2024-01-15T10:30:00.000Z'
                  }
                ]
              }
            ]
          }
        ]
      })
    })

    it('should handle exercises with partial correct answers', () => {
      const exerciseWithWrongAnswer: Exercise = {
        ...sampleExercise,
        results: [
          {
            type: 'single',
            user_answer: 'Food',
            correct_answer: 'Travel',
            is_correct: false,
            question_id: 0
          },
          {
            type: 'short',
            user_answer: 'They are expensive',
            correct_answer: 'They are expensive',
            is_correct: true,
            question_id: 1
          }
        ]
      }
      
      const result = formatLegacyDataForImport([exerciseWithWrongAnswer])
      
      expect(result.sessions[0].score).toBe(50) // 1/2 correct = 50%
      expect(result.sessions[0].questions[0].answers[0].isCorrect).toBe(false)
      expect(result.sessions[0].questions[1].answers[0].isCorrect).toBe(true)
    })

    it('should handle exercises with missing answers', () => {
      const exerciseWithMissingAnswer: Exercise = {
        ...sampleExercise,
        answers: { 0: 'Travel' }, // Missing answer for question 1
        results: [
          {
            type: 'single',
            user_answer: 'Travel',
            correct_answer: 'Travel',
            is_correct: true,
            question_id: 0
          },
          {
            type: 'short',
            user_answer: '',
            correct_answer: 'They are expensive',
            is_correct: false,
            question_id: 1
          }
        ]
      }
      
      const result = formatLegacyDataForImport([exerciseWithMissingAnswer])
      
      expect(result.sessions[0].questions[1].answers[0].userAnswer).toBe('')
    })
  })

  describe('uploadLegacyData', () => {
    it('should successfully upload data to import API', async () => {
      const importData = {
        sessions: [
          {
            sessionId: 'test-session',
            topic: 'Test Topic',
            difficulty: 'B1',
            language: 'en-US',
            transcript: 'Test transcript',
            score: 100,
            createdAt: '2024-01-15T10:30:00.000Z',
            questions: []
          }
        ]
      }

      const mockResponse = {
        success: true,
        message: 'Legacy data imported successfully',
        imported: { sessions: 1, questions: 0, answers: 0 }
      }

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await uploadLegacyData(importData)

      expect(fetchMock).toHaveBeenCalledWith('/api/practice/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(importData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle API errors', async () => {
      const importData = { sessions: [] }
      const errorResponse = {
        success: false,
        error: 'Invalid request',
        code: 'INVALID_REQUEST'
      }

      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve(errorResponse)
      })

      await expect(uploadLegacyData(importData)).rejects.toThrow('Invalid request')
    })

    it('should handle network errors', async () => {
      const importData = { sessions: [] }

      fetchMock.mockRejectedValue(new Error('Network error'))

      await expect(uploadLegacyData(importData)).rejects.toThrow('Network error')
    })
  })

  describe('clearLegacyData', () => {
    it('should remove legacy data from localStorage', () => {
      clearLegacyData()
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('english-listening-history')
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      expect(() => clearLegacyData()).toThrow('localStorage error')
    })
  })

  describe('migrateLegacyData', () => {
    it('should successfully migrate legacy data', async () => {
      // Setup localStorage with legacy data
      localStorageMock.getItem.mockReturnValue(JSON.stringify([sampleExercise]))

      // Mock successful API response
      const mockResponse = {
        success: true,
        message: 'Legacy data imported successfully',
        imported: { sessions: 1, questions: 2, answers: 2 }
      }

      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await migrateLegacyData()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Successfully migrated 1 exercises')
      expect(result.imported).toEqual(mockResponse.imported)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('english-listening-history')
    })

    it('should handle case when no legacy data exists', async () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = await migrateLegacyData()

      expect(result.success).toBe(true)
      expect(result.message).toBe('No legacy data found to migrate')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('should handle API errors during migration', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([sampleExercise]))

      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          success: false,
          error: 'Database error'
        })
      })

      const result = await migrateLegacyData()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Legacy data migration failed')
      expect(result.error).toBe('Database error')
      // localStorage should not be cleared on failure
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
    })

    it('should handle network errors during migration', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([sampleExercise]))

      fetchMock.mockRejectedValue(new Error('Network error'))

      const result = await migrateLegacyData()

      expect(result.success).toBe(false)
      expect(result.message).toBe('Legacy data migration failed')
      expect(result.error).toBe('Network error')
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
    })
  })
})