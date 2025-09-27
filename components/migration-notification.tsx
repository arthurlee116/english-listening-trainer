"use client"

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Database,
  Loader2 
} from 'lucide-react'
import { useLegacyMigration } from '@/hooks/use-legacy-migration'
import { MigrationErrorType } from '@/lib/legacy-migration-service'

interface MigrationNotificationProps {
  onDismiss?: () => void
}

export function MigrationNotification({ onDismiss }: MigrationNotificationProps) {
  const { 
    migrationStatus, 
    retryMigration, 
    getErrorMessage, 
    shouldShowNotification 
  } = useLegacyMigration()
  
  const [isDismissed, setIsDismissed] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // Auto-dismiss success notifications after 5 seconds
  useEffect(() => {
    if (migrationStatus.isComplete && !migrationStatus.hasError && migrationStatus.imported) {
      const timer = setTimeout(() => {
        setIsDismissed(true)
        onDismiss?.()
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [migrationStatus.isComplete, migrationStatus.hasError, migrationStatus.imported, onDismiss])

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await retryMigration()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  // Don't show if dismissed or if there's nothing to show
  if (isDismissed || !shouldShowNotification()) {
    return null
  }

  // Success notification
  if (migrationStatus.isComplete && !migrationStatus.hasError && migrationStatus.imported) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <div className="flex-1">
          <AlertTitle className="text-green-800 dark:text-green-200">
            Migration Successful
          </AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Successfully migrated {migrationStatus.imported.sessions} practice sessions 
            with {migrationStatus.imported.questions} questions and {migrationStatus.imported.answers} answers.
            Your data is now safely stored in the database.
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    )
  }

  // Error notification
  if (migrationStatus.isComplete && migrationStatus.hasError) {
    const errorMessage = getErrorMessage()
    const isRetryable = migrationStatus.canRetry && migrationStatus.retryable
    
    return (
      <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <AlertTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
            Migration Failed
            {migrationStatus.retryCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                Attempt {migrationStatus.retryCount + 1}
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300 mb-3">
            {errorMessage}
            {migrationStatus.errorType === MigrationErrorType.AUTHENTICATION_ERROR && (
              <div className="mt-2 text-sm">
                Please refresh the page and log in again to retry the migration.
              </div>
            )}
            {migrationStatus.errorType === MigrationErrorType.VALIDATION_ERROR && (
              <div className="mt-2 text-sm">
                Your legacy data may be corrupted. Please contact support if this persists.
              </div>
            )}
          </AlertDescription>
          <div className="flex items-center gap-2">
            {isRetryable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
                className="text-red-600 border-red-300 hover:bg-red-100 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/30"
              >
                {isRetrying ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Retry Migration
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </Alert>
    )
  }

  // Loading notification
  if (migrationStatus.isChecking) {
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <div className="flex-1">
          <AlertTitle className="text-blue-800 dark:text-blue-200">
            Migrating Legacy Data
          </AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {migrationStatus.message}
          </AlertDescription>
        </div>
      </Alert>
    )
  }

  return null
}