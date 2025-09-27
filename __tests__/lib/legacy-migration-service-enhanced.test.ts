import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  migrateLegacyDataWithRetry,
  uploadLegacyData,
  MigrationErrorType,
  type MigrationError
} from '@/lib/legacy-migration-service'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

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

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}
vi.stubGlobal('console', mockConsole)

describe('Enhanced Legacy Migration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('uploadLegacyData error handling', () => {
    const mockImportData = {
      sessions: [{
        sessionId: 'test-session',
        topic: 'Test Topic',
        difficulty: 'A1',
        language: 'en',
        transcript: 'Test transcript',
        score: 80,
        createdAt: '2024-01-01T00:00:00.000Z',
        questions: []
      }]
    }

    it('should handle network errors correctly', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      try {
        await uploadLegacyData(mockImportData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        const migrationError = error as MigrationError
        expect(migrationError.type).toBe(MigrationErrorType.NETWORK_ERROR)
        expect(migrationError.retryable).toBe(true)
        expect(migrationError.message).toContain('Network connection failed')
      }
    })

    it('should handle authentication errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED'
        })
      })

      try {
        await uploadLegacyData(mockImportData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        const migrationError = error as MigrationError
        expect(migrationError.type).toBe(MigrationErrorType.AUTHENTICATION_ERROR)
        expect(migrationError.retryable).toBe(false)
        expect(migrationError.message).toContain('Authentication failed')
      }
    })

    it('should handle validation errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: 'Invalid data format',
          code: 'VALIDATION_ERROR'
        })
      })

      try {
        await uploadLegacyData(mockImportData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        const migrationError = error as MigrationError
        expect(migrationError.type).toBe(MigrationErrorType.VALIDATION_ERROR)
        expect(migrationError.retryable).toBe(false)
        expect(migrationError.message).toContain('Invalid data format')
      }
    })

    it('should handle server errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Internal server error',
          code: 'SERVER_ERROR'
        })
      })

      try {
        await uploadLegacyData(mockImportData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        const migrationError = error as MigrationError
        expect(migrationError.type).toBe(MigrationErrorType.SERVER_ERROR)
        expect(migrationError.retryable).toBe(true)
        expect(migrationError.message).toContain('Internal server error')
      }
    })

    it('should handle rate limiting correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT'
        })
      })

      try {
        await uploadLegacyData(mockImportData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        const migrationError = error as MigrationError
        expect(migrationError.type).toBe(MigrationErrorType.SERVER_ERROR)
        expect(migrationError.retryable).toBe(true)
        expect(migrationError.message).toContain('Too many requests')
      }
    })

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      try {
        await uploadLegacyData(mockImportData)
        expect.fail('Should have thrown an error')
      } catch (error) {
        const migrationError = error as MigrationError
        expect(migrationError.type).toBe(MigrationErrorType.SERVER_ERROR)
        expect(migrationError.retryable).toBe(true)
        expect(migrationError.message).toContain('Invalid server response format')
      }
    })

    it('should handle successful responses correctly', async () => {
      const mockResponse = {
        success: true,
        message: 'Import successful',
        imported: {
          sessions: 1,
          questions: 5,
          answers: 5
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await uploadLegacyData(mockImportData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('migrateLegacyDataWithRetry', () => {
    beforeEach(() => {
      // Mock localStorage to have legacy data
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([{
        id: 'test-exercise',
        difficulty: 'A1',
        language: 'en',
        topic: 'Test Topic',
        transcript: 'Test transcript',
        questions: [{
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C', 'D'],
          answer: 'A',
          explanation: 'Test explanation'
        }],
        answers: ['B'],
        results: [{
          is_correct: false,
          correct_answer: 'A',
          user_answer: 'B',
          explanation: 'Test explanation'
        }],
        createdAt: '2024-01-01T00:00:00.000Z'
      }]))
    })

    it('should succeed on first attempt when API works', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Import successful',
          imported: { sessions: 1, questions: 1, answers: 1 }
        })
      })

      const result = await migrateLegacyDataWithRetry(3, 100)

      expect(result.success).toBe(true)
      expect(result.imported).toEqual({ sessions: 1, questions: 1, answers: 1 })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('english-listening-history')
    })

    it('should retry on retryable errors', async () => {
      // First two calls fail with server error, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            success: false,
            error: 'Server error',
            code: 'SERVER_ERROR'
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({
            success: false,
            error: 'Service unavailable',
            code: 'SERVICE_UNAVAILABLE'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Import successful',
            imported: { sessions: 1, questions: 1, answers: 1 }
          })
        })

      const result = await migrateLegacyDataWithRetry(3, 10) // Short delay for testing

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('english-listening-history')
    })

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED'
        })
      })

      const result = await migrateLegacyDataWithRetry(3, 10)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe(MigrationErrorType.AUTHENTICATION_ERROR)
      expect(result.retryable).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Should not retry
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled() // Should preserve data
    })

    it('should fail after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Server error',
          code: 'SERVER_ERROR'
        })
      })

      const result = await migrateLegacyDataWithRetry(2, 10) // Max 2 retries

      expect(result.success).toBe(false)
      expect(result.errorType).toBe(MigrationErrorType.SERVER_ERROR)
      expect(result.retryable).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled() // Should preserve data on failure
    })

    it('should handle no legacy data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const result = await migrateLegacyDataWithRetry()

      expect(result.success).toBe(true)
      expect(result.message).toContain('No legacy data found')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle empty legacy data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('[]')

      const result = await migrateLegacyDataWithRetry()

      expect(result.success).toBe(true)
      expect(result.message).toContain('No legacy data found')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should preserve localStorage data on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Server error'
        })
      })

      const result = await migrateLegacyDataWithRetry(1, 10) // Only 1 attempt

      expect(result.success).toBe(false)
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled()
      // Verify data is still there
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('english-listening-history')
    })
  })
})