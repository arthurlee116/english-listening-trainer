import { useState, useEffect, useCallback, useRef } from 'react'
import * as legacyMigration from '@/lib/legacy-migration-service'
import type {
  MigrationStatus as BaseMigrationStatus,
  MigrationErrorType
} from '@/lib/legacy-migration-service'

function getExport<T>(key: string, options: { silent?: boolean } = {}): T | undefined {
  try {
    return (legacyMigration as Record<string, unknown>)[key] as T
  } catch (error) {
    if (!options.silent) {
      console.warn(`Failed to access legacy migration export "${key}":`, error)
    }
    return undefined
  }
}

interface MigrationStatus extends BaseMigrationStatus {
  errorType?: MigrationErrorType
  retryable?: boolean
  retryCount?: number
}

function sanitizeStatus(status: MigrationStatus): MigrationStatus {
  const nextStatus: MigrationStatus = { ...status }

  if (supportsEnhancedMigration) {
    nextStatus.canRetry = nextStatus.canRetry ?? false
    nextStatus.retryCount = nextStatus.retryCount ?? 0
  } else {
    if (!nextStatus.canRetry) delete nextStatus.canRetry
    if (!nextStatus.retryable) delete nextStatus.retryable
    if (!nextStatus.retryCount) delete nextStatus.retryCount
  }

  if (!nextStatus.imported) delete nextStatus.imported
  if (!nextStatus.errorType) delete nextStatus.errorType

  return nextStatus
}

const MIGRATION_ERROR = {
  NETWORK_ERROR: 'NETWORK_ERROR' as MigrationErrorType,
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR' as MigrationErrorType,
  VALIDATION_ERROR: 'VALIDATION_ERROR' as MigrationErrorType,
  SERVER_ERROR: 'SERVER_ERROR' as MigrationErrorType,
  UNKNOWN_ERROR: 'UNKNOWN_ERROR' as MigrationErrorType
}

type MigrationResult = {
  success: boolean
  message: string
  imported?: { sessions: number; questions: number; answers: number }
  retryable?: boolean
  errorType?: MigrationErrorType
  error?: string
}

const supportsEnhancedMigration = typeof getExport<(attempts?: number, delayMs?: number) => Promise<MigrationResult>>('migrateLegacyDataWithRetry', { silent: true }) === 'function'

async function executeMigration(): Promise<MigrationResult> {
  const singleRun = getExport<() => Promise<MigrationResult>>('migrateLegacyData', {
    silent: supportsEnhancedMigration
  })
  if (typeof singleRun === 'function') {
    return await singleRun()
  }

  const withRetry = getExport<(attempts?: number, delayMs?: number) => Promise<MigrationResult>>('migrateLegacyDataWithRetry')
  if (typeof withRetry === 'function') {
    return await withRetry(3, 1000)
  }

  throw new Error('Legacy migration function is not available')
}

function checkHasLegacyData(): boolean {
  const detector = getExport<() => boolean>('hasLegacyData')
  if (typeof detector === 'function') {
    return detector()
  }
  return false
}

/**
 * Hook to automatically detect and migrate legacy data on app startup with enhanced error handling
 */
export function useLegacyMigration() {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>(() => ({
    isChecking: false,
    isComplete: false,
    hasError: false,
    message: ''
  }))
  const hasAttemptedInitialMigration = useRef(false)

  const updateStatus = useCallback((updater: (prev: MigrationStatus) => MigrationStatus) => {
    setMigrationStatus(prev => sanitizeStatus(updater(prev)))
  }, [])

  const performMigration = useCallback(async (isRetry: boolean = false) => {
    const currentRetryCount = isRetry ? (migrationStatus.retryCount ?? 0) + 1 : 0
    
    updateStatus(prev => ({
      ...prev,
      isChecking: true,
      isComplete: false,
      hasError: false,
      message: isRetry ? `Retrying migration (attempt ${currentRetryCount + 1})...` : 'Checking for legacy data...',
      canRetry: false,
      retryCount: currentRetryCount
    }))

    try {
      const result = await executeMigration()
      
      updateStatus(prev => ({
        ...prev,
        isChecking: false,
        isComplete: true,
        hasError: !result.success,
        message: result.message,
        imported: result.imported,
        canRetry: !result.success && (result.retryable ?? false),
        errorType: result.errorType,
        retryable: result.retryable
      }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      updateStatus(prev => ({
        ...prev,
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: errorMessage,
        canRetry: supportsEnhancedMigration,
        errorType: supportsEnhancedMigration ? MIGRATION_ERROR.UNKNOWN_ERROR : undefined,
        retryable: supportsEnhancedMigration ? true : undefined
      }))

      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      }
    }
  }, [migrationStatus.retryCount, updateStatus])

  const retryMigration = useCallback(async () => {
    if (!migrationStatus.canRetry) {
      console.warn('Migration retry not allowed in current state')
      return
    }
    
    return await performMigration(true)
  }, [performMigration, migrationStatus.canRetry])

  // Automatically check and migrate on mount
  useEffect(() => {
    const checkAndMigrate = async () => {
      // Only check if we haven't completed migration yet
      if (migrationStatus.isComplete) return

      // Check if there's legacy data to migrate
      if (checkHasLegacyData()) {
        console.log('Legacy data detected, starting migration...')
        await performMigration(false)
      } else {
        updateStatus(prev => ({
          ...prev,
          isChecking: false,
          isComplete: true,
          hasError: false,
          message: 'No legacy data found',
          canRetry: false
        }))
      }
    }

    if (hasAttemptedInitialMigration.current) {
      return
    }

    hasAttemptedInitialMigration.current = true
    checkAndMigrate()
  }, [performMigration, migrationStatus.isComplete, updateStatus])

  // Helper function to get user-friendly error messages
  const getErrorMessage = useCallback(() => {
    if (!migrationStatus.hasError) return null
    
    switch (migrationStatus.errorType) {
      case MIGRATION_ERROR.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection and try again.'
      case MIGRATION_ERROR.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please log in again to continue.'
      case MIGRATION_ERROR.VALIDATION_ERROR:
        return 'Data validation failed. Your legacy data may be corrupted.'
      case MIGRATION_ERROR.SERVER_ERROR:
        return 'Server error occurred. Please try again later.'
      default:
        return migrationStatus.message || 'An unknown error occurred during migration.'
    }
  }, [migrationStatus.hasError, migrationStatus.errorType, migrationStatus.message])

  // Helper function to determine if migration should show notification
  const shouldShowNotification = useCallback(() => {
    return migrationStatus.isComplete && (migrationStatus.hasError || !!migrationStatus.imported)
  }, [migrationStatus.isComplete, migrationStatus.hasError, migrationStatus.imported])

  return {
    migrationStatus,
    performMigration,
    retryMigration,
    hasLegacyData: checkHasLegacyData(),
    getErrorMessage,
    shouldShowNotification
  }
}
