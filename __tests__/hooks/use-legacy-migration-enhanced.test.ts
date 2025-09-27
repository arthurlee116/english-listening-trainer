import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLegacyMigration } from '@/hooks/use-legacy-migration'
import { MigrationErrorType } from '@/lib/legacy-migration-service'

// Mock the legacy migration service
vi.mock('@/lib/legacy-migration-service', () => ({
  migrateLegacyDataWithRetry: vi.fn(),
  hasLegacyData: vi.fn(),
  MigrationErrorType: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  }
}))

import { migrateLegacyDataWithRetry, hasLegacyData } from '@/lib/legacy-migration-service'

const mockMigrateLegacyDataWithRetry = vi.mocked(migrateLegacyDataWithRetry)
const mockHasLegacyData = vi.mocked(hasLegacyData)

describe('useLegacyMigration Enhanced Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasLegacyData.mockReturnValue(false)
    mockMigrateLegacyDataWithRetry.mockResolvedValue({
      success: true,
      message: 'No legacy data found to migrate'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with correct default state', async () => {
    const { result } = renderHook(() => useLegacyMigration())

    // Wait for the effect to complete
    await waitFor(() => {
      expect(result.current.migrationStatus.isComplete).toBe(true)
    })

    expect(result.current.migrationStatus).toEqual({
      isChecking: false,
      isComplete: true, // Complete because no legacy data
      hasError: false,
      message: 'No legacy data found',
      canRetry: false,
      retryCount: 0
    })
    expect(result.current.hasLegacyData).toBe(false)
    expect(result.current.shouldShowNotification()).toBe(false)
  })

  it('should automatically start migration when legacy data exists', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyDataWithRetry.mockResolvedValue({
      success: true,
      message: 'Migration successful',
      imported: { sessions: 2, questions: 10, answers: 10 }
    })

    const { result } = renderHook(() => useLegacyMigration())

    // Initially should be checking
    expect(result.current.migrationStatus.isChecking).toBe(true)
    expect(result.current.migrationStatus.message).toContain('Checking for legacy data')

    // Wait for migration to complete
    await waitFor(() => {
      expect(result.current.migrationStatus.isComplete).toBe(true)
    })

    expect(result.current.migrationStatus.hasError).toBe(false)
    expect(result.current.migrationStatus.imported).toEqual({
      sessions: 2,
      questions: 10,
      answers: 10
    })
    expect(result.current.shouldShowNotification()).toBe(true)
    expect(mockMigrateLegacyDataWithRetry).toHaveBeenCalledTimes(1)
  })

  it('should handle migration failure with retry capability', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyDataWithRetry.mockResolvedValue({
      success: false,
      message: 'Network error occurred',
      error: 'Network connection failed',
      errorType: MigrationErrorType.NETWORK_ERROR,
      retryable: true
    })

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus.isComplete).toBe(true)
    })

    expect(result.current.migrationStatus.hasError).toBe(true)
    expect(result.current.migrationStatus.canRetry).toBe(true)
    expect(result.current.migrationStatus.errorType).toBe(MigrationErrorType.NETWORK_ERROR)
    expect(result.current.shouldShowNotification()).toBe(true)
  })

  it('should handle non-retryable errors correctly', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyDataWithRetry.mockResolvedValue({
      success: false,
      message: 'Authentication failed',
      error: 'Unauthorized',
      errorType: MigrationErrorType.AUTHENTICATION_ERROR,
      retryable: false
    })

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus.isComplete).toBe(true)
    })

    expect(result.current.migrationStatus.hasError).toBe(true)
    expect(result.current.migrationStatus.canRetry).toBe(false)
    expect(result.current.migrationStatus.errorType).toBe(MigrationErrorType.AUTHENTICATION_ERROR)
    expect(result.current.migrationStatus.retryable).toBe(false)
  })

  it('should allow manual retry when retryable', async () => {
    mockHasLegacyData.mockReturnValue(true)
    
    // First call fails
    mockMigrateLegacyDataWithRetry.mockResolvedValueOnce({
      success: false,
      message: 'Server error',
      error: 'Internal server error',
      errorType: MigrationErrorType.SERVER_ERROR,
      retryable: true
    })

    // Second call (retry) succeeds
    mockMigrateLegacyDataWithRetry.mockResolvedValueOnce({
      success: true,
      message: 'Migration successful on retry',
      imported: { sessions: 1, questions: 5, answers: 5 }
    })

    const { result } = renderHook(() => useLegacyMigration())

    // Wait for initial failure
    await waitFor(() => {
      expect(result.current.migrationStatus.hasError).toBe(true)
    })

    expect(result.current.migrationStatus.canRetry).toBe(true)
    expect(result.current.migrationStatus.retryCount).toBe(0)

    // Perform retry
    await act(async () => {
      await result.current.retryMigration()
    })

    expect(result.current.migrationStatus.hasError).toBe(false)
    expect(result.current.migrationStatus.retryCount).toBe(1)
    expect(result.current.migrationStatus.imported).toEqual({
      sessions: 1,
      questions: 5,
      answers: 5
    })
    expect(mockMigrateLegacyDataWithRetry).toHaveBeenCalledTimes(2)
  })

  it('should not allow retry when not retryable', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyDataWithRetry.mockResolvedValue({
      success: false,
      message: 'Authentication failed',
      error: 'Unauthorized',
      errorType: MigrationErrorType.AUTHENTICATION_ERROR,
      retryable: false
    })

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus.hasError).toBe(true)
    })

    expect(result.current.migrationStatus.canRetry).toBe(false)

    // Attempt retry (should not call the service again)
    await act(async () => {
      await result.current.retryMigration()
    })

    expect(mockMigrateLegacyDataWithRetry).toHaveBeenCalledTimes(1) // Only initial call
  })

  it('should provide user-friendly error messages', async () => {
    mockHasLegacyData.mockReturnValue(true)
    
    const testCases = [
      {
        errorType: MigrationErrorType.NETWORK_ERROR,
        expectedMessage: 'Network connection failed. Please check your internet connection and try again.'
      },
      {
        errorType: MigrationErrorType.AUTHENTICATION_ERROR,
        expectedMessage: 'Authentication failed. Please log in again to continue.'
      },
      {
        errorType: MigrationErrorType.VALIDATION_ERROR,
        expectedMessage: 'Data validation failed. Your legacy data may be corrupted.'
      },
      {
        errorType: MigrationErrorType.SERVER_ERROR,
        expectedMessage: 'Server error occurred. Please try again later.'
      },
      {
        errorType: MigrationErrorType.UNKNOWN_ERROR,
        originalMessage: 'Custom error message',
        expectedMessage: 'Custom error message'
      }
    ]

    for (const testCase of testCases) {
      mockMigrateLegacyDataWithRetry.mockResolvedValueOnce({
        success: false,
        message: testCase.originalMessage || 'Error occurred',
        error: 'Error',
        errorType: testCase.errorType,
        retryable: true
      })

      const { result } = renderHook(() => useLegacyMigration())

      await waitFor(() => {
        expect(result.current.migrationStatus.hasError).toBe(true)
      })

      expect(result.current.getErrorMessage()).toBe(testCase.expectedMessage)
    }
  })

  it('should track retry count correctly', async () => {
    mockHasLegacyData.mockReturnValue(true)
    
    // All calls fail
    mockMigrateLegacyDataWithRetry.mockResolvedValue({
      success: false,
      message: 'Server error',
      error: 'Internal server error',
      errorType: MigrationErrorType.SERVER_ERROR,
      retryable: true
    })

    const { result } = renderHook(() => useLegacyMigration())

    // Wait for initial failure
    await waitFor(() => {
      expect(result.current.migrationStatus.hasError).toBe(true)
    })

    expect(result.current.migrationStatus.retryCount).toBe(0)

    // First retry
    await act(async () => {
      await result.current.retryMigration()
    })

    expect(result.current.migrationStatus.retryCount).toBe(1)

    // Second retry
    await act(async () => {
      await result.current.retryMigration()
    })

    expect(result.current.migrationStatus.retryCount).toBe(2)
  })

  it('should handle unexpected errors during migration', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyDataWithRetry.mockRejectedValue(new Error('Unexpected error'))

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus.isComplete).toBe(true)
    })

    expect(result.current.migrationStatus.hasError).toBe(true)
    expect(result.current.migrationStatus.canRetry).toBe(true)
    expect(result.current.migrationStatus.errorType).toBe(MigrationErrorType.UNKNOWN_ERROR)
    expect(result.current.migrationStatus.message).toBe('Unexpected error')
  })
})