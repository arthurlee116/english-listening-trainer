import type { Exercise } from './types'

const STORAGE_KEY = "english-listening-history"

// Legacy data type - extends Exercise interface
type _LegacyExercise = Exercise

// Interfaces for the import API based on the design document
interface LegacyAnswer {
  userAnswer: string
  isCorrect: boolean
  attemptedAt: string
}

interface LegacyQuestion {
  index: number
  type: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation?: string
  answers: LegacyAnswer[]
}

interface LegacySession {
  sessionId: string
  topic: string
  difficulty: string
  language: string
  transcript: string
  score: number
  createdAt: string
  questions: LegacyQuestion[]
}

interface ImportLegacyRequest {
  sessions: LegacySession[]
}

interface ImportResponse {
  success: boolean
  message?: string
  imported?: {
    sessions: number
    questions: number
    answers: number
  }
  error?: string
  code?: string
  details?: unknown
}

// Enhanced migration status interface
export interface MigrationStatus {
  isChecking: boolean
  isComplete: boolean
  hasError: boolean
  message: string
  imported?: { sessions: number; questions: number; answers: number }
  canRetry: boolean
  retryCount: number
  lastAttemptAt?: string
}

// Migration error types
export enum MigrationErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface MigrationError extends Error {
  type: MigrationErrorType
  code?: string
  retryable: boolean
  details?: unknown
}

/**
 * Checks if there is legacy data in localStorage that needs to be migrated
 */
export function hasLegacyData(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false
    
    const exercises = JSON.parse(stored) as Exercise[]
    return Array.isArray(exercises) && exercises.length > 0
  } catch (error) {
    console.error('Error checking for legacy data:', error)
    return false
  }
}

/**
 * Gets legacy data from localStorage
 */
export function getLegacyData(): Exercise[] {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return []
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const exercises = JSON.parse(stored) as Exercise[]
    return Array.isArray(exercises) ? exercises : []
  } catch (error) {
    console.error('Error getting legacy data:', error)
    return []
  }
}

/**
 * Converts legacy Exercise data to the format expected by the import API
 */
export function formatLegacyDataForImport(exercises: Exercise[]): ImportLegacyRequest {
  console.log('DEBUG: Starting data formatting. Sample legacy exercise:', JSON.stringify(exercises[0], null, 2)); // Log first exercise for inspection
  
  const sessions: LegacySession[] = exercises.map(exercise => {
    // Calculate score from results
    const correctCount = exercise.results.filter(result => result.is_correct).length
    const score = Math.round((correctCount / exercise.results.length) * 100)
    
    console.log(`DEBUG: Formatting exercise ${exercise.id}: score=${score}, questions=${exercise.questions.length}, results=${exercise.results.length}`); // Log per exercise metrics

    // Convert questions and answers
    const questions: LegacyQuestion[] = exercise.questions.map((question, index) => {
      // Find the corresponding result for this question
      const result = exercise.results[index]
      const userAnswer = exercise.answers[index] || result?.user_answer || ''
      
      const answers: LegacyAnswer[] = [{
        userAnswer: userAnswer,
        isCorrect: result?.is_correct || false,
        attemptedAt: exercise.createdAt // Use exercise creation time as attempt time
      }]

      return {
        index: index,
        type: question.type,
        question: question.question,
        options: question.options || undefined,
        correctAnswer: question.answer,
        explanation: question.explanation || undefined,
        answers: answers
      }
    })

    return {
      sessionId: exercise.id,
      topic: exercise.topic,
      difficulty: exercise.difficulty,
      language: exercise.language,
      transcript: exercise.transcript,
      score: score,
      createdAt: exercise.createdAt,
      questions: questions
    }
  })

  const formattedData = { sessions }
  console.log('DEBUG: Formatted import data sample (first session):', JSON.stringify(formattedData.sessions[0], null, 2)); // Log formatted output
  return formattedData
}

/**
 * Creates a migration error with proper typing and retry information
 */
function createMigrationError(
  message: string, 
  type: MigrationErrorType, 
  retryable: boolean = true,
  code?: string,
  details?: unknown
): MigrationError {
  const error = new Error(message) as MigrationError
  error.type = type
  error.code = code
  error.retryable = retryable
  error.details = details
  return error
}

/**
 * Determines error type and retryability from HTTP response
 */
function analyzeHttpError(status: number, result: ImportResponse): MigrationError {
  switch (status) {
    case 401:
    case 403:
      return createMigrationError(
        'Authentication failed. Please log in again.',
        MigrationErrorType.AUTHENTICATION_ERROR,
        false, // Auth errors are not retryable
        result.code,
        result.details
      )
    case 400:
      return createMigrationError(
        result.error || 'Invalid data format',
        MigrationErrorType.VALIDATION_ERROR,
        false, // Validation errors are not retryable
        result.code,
        result.details
      )
    case 429:
      return createMigrationError(
        'Too many requests. Please try again later.',
        MigrationErrorType.SERVER_ERROR,
        true,
        result.code,
        result.details
      )
    case 500:
    case 502:
    case 503:
    case 504:
      return createMigrationError(
        result.error || 'Server error occurred',
        MigrationErrorType.SERVER_ERROR,
        true,
        result.code,
        result.details
      )
    default:
      return createMigrationError(
        result.error || `HTTP ${status}: Request failed`,
        MigrationErrorType.UNKNOWN_ERROR,
        true,
        result.code,
        result.details
      )
  }
}

/**
 * Uploads legacy data to the import API with enhanced error handling
 */
export async function uploadLegacyData(importData: ImportLegacyRequest): Promise<ImportResponse> {
  console.log('DEBUG: Uploading legacy data. Request body size:', JSON.stringify(importData).length, 'bytes'); // Log request size
  
  try {
    const response = await fetch('/api/practice/import-legacy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify(importData)
    })

    console.log('DEBUG: API response status:', response.status, 'ok:', response.ok); // Log HTTP status

    let result: ImportResponse
    try {
      result = await response.json() as ImportResponse
      console.log('DEBUG: Full API response:', JSON.stringify(result, null, 2)); // Log complete response
    } catch (parseError) {
      console.error('DEBUG: JSON parse error on response:', parseError);
      throw createMigrationError(
        'Invalid server response format',
        MigrationErrorType.SERVER_ERROR,
        true,
        'PARSE_ERROR',
        parseError
      )
    }

    if (!response.ok) {
      console.error('DEBUG: Non-OK response details - status:', response.status, 'result:', result); // Extra error logging
      throw analyzeHttpError(response.status, result)
    }

    return result
  } catch (error) {
    console.error('DEBUG: Upload error caught:', error);
    
    // If it's already a MigrationError, re-throw it
    if (error && typeof error === 'object' && 'type' in error) {
      throw error
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createMigrationError(
        'Network connection failed. Please check your internet connection.',
        MigrationErrorType.NETWORK_ERROR,
        true,
        'NETWORK_ERROR',
        error
      )
    }
    
    // Handle other unknown errors
    throw createMigrationError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      MigrationErrorType.UNKNOWN_ERROR,
      true,
      'UNKNOWN_ERROR',
      error
    )
  }
}

/**
 * Clears legacy data from localStorage after successful import
 */
export function clearLegacyData(): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('Legacy data cleared from localStorage')
  } catch (error) {
    console.error('Error clearing legacy data:', error)
    throw error
  }
}

/**
 * Performs migration with retry logic and enhanced error handling
 */
export async function migrateLegacyDataWithRetry(
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<{
  success: boolean
  message: string
  imported?: { sessions: number; questions: number; answers: number }
  error?: string
  errorType?: MigrationErrorType
  retryable?: boolean
}> {
  let lastError: MigrationError | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Migration attempt ${attempt}/${maxRetries}`)
      
      // Check if there's legacy data to migrate
      if (!hasLegacyData()) {
        return {
          success: true,
          message: 'No legacy data found to migrate'
        }
      }

      // Get legacy data
      const legacyExercises = getLegacyData()
      if (legacyExercises.length === 0) {
        return {
          success: true,
          message: 'No legacy exercises found to migrate'
        }
      }

      console.log(`DEBUG: Found ${legacyExercises.length} legacy exercises. Sample data keys:`, Object.keys(legacyExercises[0] || {})); // Log data structure

      // Format data for import
      const importData = formatLegacyDataForImport(legacyExercises)

      // Upload to API
      const result = await uploadLegacyData(importData)

      if (result.success) {
        // Clear localStorage on successful import
        clearLegacyData()
        
        return {
          success: true,
          message: `Successfully migrated ${legacyExercises.length} exercises`,
          imported: result.imported
        }
      } else {
        throw createMigrationError(
          result.error || 'Import failed',
          MigrationErrorType.SERVER_ERROR,
          true,
          result.code,
          result.details
        )
      }
    } catch (error) {
      console.error(`DEBUG: Migration attempt ${attempt} failed with error:`, error);
      
      // Convert to MigrationError if needed
      if (error && typeof error === 'object' && 'type' in error) {
        lastError = error as MigrationError
      } else {
        lastError = createMigrationError(
          error instanceof Error ? error.message : String(error),
          MigrationErrorType.UNKNOWN_ERROR,
          true
        )
      }
      
      // Don't retry if error is not retryable
      if (!lastError.retryable) {
        console.log('Error is not retryable, stopping attempts')
        break
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        console.log('Max retries reached')
        break
      }
      
      // Wait before retrying with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1)
      console.log(`Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // If we get here, all attempts failed
  return {
    success: false,
    message: 'Legacy data migration failed',
    error: lastError?.message,
    errorType: lastError?.type,
    retryable: lastError?.retryable
  }
}

/**
 * Main function to perform the complete legacy data migration (backward compatibility)
 */
export async function migrateLegacyData(): Promise<{
  success: boolean
  message: string
  imported?: { sessions: number; questions: number; answers: number }
  error?: string
}> {
  const result = await migrateLegacyDataWithRetry()
  return {
    success: result.success,
    message: result.message,
    imported: result.imported,
    error: result.error
  }
}
