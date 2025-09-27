import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MigrationNotification } from '@/components/migration-notification'
import { MigrationErrorType } from '@/lib/legacy-migration-service'

// Mock the hook
vi.mock('@/hooks/use-legacy-migration', () => ({
  useLegacyMigration: vi.fn()
}))

import { useLegacyMigration } from '@/hooks/use-legacy-migration'

const mockUseLegacyMigration = vi.mocked(useLegacyMigration)

describe('MigrationNotification', () => {
  const mockRetryMigration = vi.fn()
  const mockGetErrorMessage = vi.fn()
  const mockShouldShowNotification = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: false,
        hasError: false,
        message: '',
        canRetry: false,
        retryCount: 0
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: false
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should not render when shouldShowNotification returns false', () => {
    mockShouldShowNotification.mockReturnValue(false)

    const { container } = render(<MigrationNotification />)
    expect(container.firstChild).toBeNull()
  })

  it('should render loading notification during migration', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: true,
        isComplete: false,
        hasError: false,
        message: 'Checking for legacy data...',
        canRetry: false,
        retryCount: 0
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    expect(screen.getByText('Migrating Legacy Data')).toBeInTheDocument()
    expect(screen.getByText('Checking for legacy data...')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('border-blue-200')
  })

  it('should render success notification with import details', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: false,
        message: 'Migration successful',
        imported: { sessions: 3, questions: 15, answers: 15 },
        canRetry: false,
        retryCount: 0
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: false
    })

    render(<MigrationNotification onDismiss={mockOnDismiss} />)

    expect(screen.getByText('Migration Successful')).toBeInTheDocument()
    expect(screen.getByText(/Successfully migrated 3 practice sessions/)).toBeInTheDocument()
    expect(screen.getByText(/with 15 questions and 15 answers/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('border-green-200')
  })

  it('should auto-dismiss success notification after 5 seconds', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: false,
        message: 'Migration successful',
        imported: { sessions: 1, questions: 5, answers: 5 },
        canRetry: false,
        retryCount: 0
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: false
    })

    render(<MigrationNotification onDismiss={mockOnDismiss} />)

    expect(screen.getByText('Migration Successful')).toBeInTheDocument()

    // Fast-forward 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // The component should be dismissed (onDismiss called)
    expect(mockOnDismiss).toHaveBeenCalled()
  })

  it('should render error notification with retry button for retryable errors', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Network connection failed. Please check your internet connection and try again.')
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Network error occurred',
        canRetry: true,
        retryable: true,
        retryCount: 1,
        errorType: MigrationErrorType.NETWORK_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    expect(screen.getByText('Migration Failed')).toBeInTheDocument()
    expect(screen.getByText('Attempt 2')).toBeInTheDocument() // retryCount + 1
    expect(screen.getByText('Network connection failed. Please check your internet connection and try again.')).toBeInTheDocument()
    expect(screen.getByText('Retry Migration')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('border-red-200')
  })

  it('should not show retry button for non-retryable errors', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Authentication failed. Please log in again to continue.')
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Authentication failed',
        canRetry: false,
        retryable: false,
        retryCount: 0,
        errorType: MigrationErrorType.AUTHENTICATION_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    expect(screen.getByText('Migration Failed')).toBeInTheDocument()
    expect(screen.getByText('Authentication failed. Please log in again to continue.')).toBeInTheDocument()
    expect(screen.queryByText('Retry Migration')).not.toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })

  it('should show additional help text for authentication errors', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Authentication failed')
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Authentication failed',
        canRetry: false,
        retryable: false,
        retryCount: 0,
        errorType: MigrationErrorType.AUTHENTICATION_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    expect(screen.getByText('Please refresh the page and log in again to retry the migration.')).toBeInTheDocument()
  })

  it('should show additional help text for validation errors', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Data validation failed')
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Data validation failed',
        canRetry: false,
        retryable: false,
        retryCount: 0,
        errorType: MigrationErrorType.VALIDATION_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    expect(screen.getByText('Your legacy data may be corrupted. Please contact support if this persists.')).toBeInTheDocument()
  })

  it('should handle retry button click', async () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Server error occurred')
    mockRetryMigration.mockResolvedValue({})
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Server error',
        canRetry: true,
        retryable: true,
        retryCount: 0,
        errorType: MigrationErrorType.SERVER_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    const retryButton = screen.getByText('Retry Migration')
    fireEvent.click(retryButton)

    expect(mockRetryMigration).toHaveBeenCalled()
  })

  it('should handle dismiss button click', () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Server error occurred')
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Server error',
        canRetry: true,
        retryable: true,
        retryCount: 0,
        errorType: MigrationErrorType.SERVER_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification onDismiss={mockOnDismiss} />)

    const dismissButton = screen.getByText('Dismiss')
    fireEvent.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalled()
  })

  it('should show loading state during retry', async () => {
    mockShouldShowNotification.mockReturnValue(true)
    mockGetErrorMessage.mockReturnValue('Server error occurred')
    
    // Mock a slow retry
    mockRetryMigration.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
    
    mockUseLegacyMigration.mockReturnValue({
      migrationStatus: {
        isChecking: false,
        isComplete: true,
        hasError: true,
        message: 'Server error',
        canRetry: true,
        retryable: true,
        retryCount: 0,
        errorType: MigrationErrorType.SERVER_ERROR
      },
      retryMigration: mockRetryMigration,
      getErrorMessage: mockGetErrorMessage,
      shouldShowNotification: mockShouldShowNotification,
      performMigration: vi.fn(),
      hasLegacyData: true
    })

    render(<MigrationNotification />)

    const retryButton = screen.getByText('Retry Migration')
    fireEvent.click(retryButton)

    // Should show loading state
    expect(retryButton).toBeDisabled()
    expect(screen.getByRole('button', { name: /retry migration/i })).toHaveTextContent('Retry Migration')
  })
})