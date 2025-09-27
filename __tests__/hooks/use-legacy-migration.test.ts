import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLegacyMigration } from '@/hooks/use-legacy-migration'
import * as migrationService from '@/lib/legacy-migration-service'

// Mock the migration service
vi.mock('@/lib/legacy-migration-service', () => ({
  hasLegacyData: vi.fn(),
  migrateLegacyData: vi.fn()
}))

const mockHasLegacyData = vi.mocked(migrationService.hasLegacyData)
const mockMigrateLegacyData = vi.mocked(migrationService.migrateLegacyData)

describe('useLegacyMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default state', async () => {
    mockHasLegacyData.mockReturnValue(false)
    
    const { result } = renderHook(() => useLegacyMigration())
    
    // The hook automatically checks for legacy data on mount
    await waitFor(() => {
      expect(result.current.migrationStatus).toEqual({
        isChecking: false,
        isComplete: true,
        hasError: false,
        message: 'No legacy data found'
      })
    })
    expect(result.current.hasLegacyData).toBe(false)
  })

  it('should automatically migrate when legacy data exists', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyData.mockResolvedValue({
      success: true,
      message: 'Successfully migrated 2 exercises',
      imported: { sessions: 2, questions: 4, answers: 8 }
    })

    const { result } = renderHook(() => useLegacyMigration())

    // Should start checking
    await waitFor(() => {
      expect(result.current.migrationStatus.isChecking).toBe(true)
    })

    // Should complete successfully
    await waitFor(() => {
      expect(result.current.migrationStatus).toEqual({
        isChecking: false,
        isComplete: true,
        hasError: false,
        message: 'Successfully migrated 2 exercises',
        imported: { sessions: 2, questions: 4, answers: 8 }
      })
    })

    expect(mockMigrateLegacyData).toHaveBeenCalledOnce()
  })

  it('should handle migration errors', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyData.mockResolvedValue({
      success: false,
      message: 'Migration failed',
      error: 'Network error'
    })

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus).toEqual({
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Migration failed'
      })
    })
  })

  it('should handle migration service exceptions', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyData.mockRejectedValue(new Error('Service error'))

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus).toEqual({
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Service error'
      })
    })
  })

  it('should complete immediately when no legacy data exists', async () => {
    mockHasLegacyData.mockReturnValue(false)

    const { result } = renderHook(() => useLegacyMigration())

    await waitFor(() => {
      expect(result.current.migrationStatus).toEqual({
        isChecking: false,
        isComplete: true,
        hasError: false,
        message: 'No legacy data found'
      })
    })

    expect(mockMigrateLegacyData).not.toHaveBeenCalled()
  })

  it('should allow manual migration retry', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyData
      .mockResolvedValueOnce({
        success: false,
        message: 'First attempt failed',
        error: 'Network error'
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Retry successful',
        imported: { sessions: 1, questions: 2, answers: 2 }
      })

    const { result } = renderHook(() => useLegacyMigration())

    // Wait for initial failed attempt
    await waitFor(() => {
      expect(result.current.migrationStatus.hasError).toBe(true)
    })

    // Manually retry
    await result.current.performMigration()

    await waitFor(() => {
      expect(result.current.migrationStatus).toEqual({
        isChecking: false,
        isComplete: true,
        hasError: false,
        message: 'Retry successful',
        imported: { sessions: 1, questions: 2, answers: 2 }
      })
    })

    expect(mockMigrateLegacyData).toHaveBeenCalledTimes(2)
  })

  it('should not run migration multiple times if already complete', async () => {
    mockHasLegacyData.mockReturnValue(true)
    mockMigrateLegacyData.mockResolvedValue({
      success: true,
      message: 'Migration successful',
      imported: { sessions: 1, questions: 1, answers: 1 }
    })

    const { result, rerender } = renderHook(() => useLegacyMigration())

    // Wait for migration to complete
    await waitFor(() => {
      expect(result.current.migrationStatus.isComplete).toBe(true)
    })

    const callCount = mockMigrateLegacyData.mock.calls.length

    // Rerender the hook
    rerender()

    // Should not call migration again
    expect(mockMigrateLegacyData).toHaveBeenCalledTimes(callCount)
  })
})