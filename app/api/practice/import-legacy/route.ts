import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Error codes for structured error responses
enum ImportErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_DATA = 'DUPLICATE_DATA',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// Structured API response interfaces
interface ImportSuccessResponse {
  success: true
  message: string
  imported: {
    sessions: number
    questions: number
    answers: number
  }
}

interface ImportErrorResponse {
  success: false
  error: string
  code: ImportErrorCode
  details?: unknown
}

// Legacy data interfaces based on the design document
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

// Validation helper functions
function validateSessionData(session: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!session || typeof session !== 'object') {
    errors.push('session must be an object')
    return { isValid: false, errors }
  }
  
  const sessionObj = session as Record<string, unknown>
  
  if (!sessionObj.sessionId || typeof sessionObj.sessionId !== 'string') {
    errors.push('sessionId is required and must be a string')
  }
  if (!sessionObj.topic || typeof sessionObj.topic !== 'string') {
    errors.push('topic is required and must be a string')
  }
  if (!sessionObj.difficulty || typeof sessionObj.difficulty !== 'string') {
    errors.push('difficulty is required and must be a string')
  }
  if (!sessionObj.language || typeof sessionObj.language !== 'string') {
    errors.push('language is required and must be a string')
  }
  if (!sessionObj.transcript || typeof sessionObj.transcript !== 'string') {
    errors.push('transcript is required and must be a string')
  }
  if (!sessionObj.createdAt || typeof sessionObj.createdAt !== 'string') {
    errors.push('createdAt is required and must be a string')
  }
  if (sessionObj.score !== undefined && typeof sessionObj.score !== 'number') {
    errors.push('score must be a number if provided')
  }
  if (!sessionObj.questions || !Array.isArray(sessionObj.questions)) {
    errors.push('questions is required and must be an array')
  }

  return { isValid: errors.length === 0, errors }
}

function validateQuestionData(question: unknown, sessionIndex: number, questionIndex: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const prefix = `Session ${sessionIndex}, Question ${questionIndex}:`
  
  if (!question || typeof question !== 'object') {
    errors.push(`${prefix} question must be an object`)
    return { isValid: false, errors }
  }
  
  const questionObj = question as Record<string, unknown>
  
  if (typeof questionObj.index !== 'number') {
    errors.push(`${prefix} index is required and must be a number`)
  }
  if (!questionObj.type || typeof questionObj.type !== 'string') {
    errors.push(`${prefix} type is required and must be a string`)
  }
  if (!questionObj.question || typeof questionObj.question !== 'string') {
    errors.push(`${prefix} question is required and must be a string`)
  }
  if (!questionObj.correctAnswer || typeof questionObj.correctAnswer !== 'string') {
    errors.push(`${prefix} correctAnswer is required and must be a string`)
  }
  if (questionObj.options !== undefined && questionObj.options !== null && !Array.isArray(questionObj.options)) {
    errors.push(`${prefix} options must be an array if provided`)
  }
  if (questionObj.explanation !== undefined && questionObj.explanation !== null && typeof questionObj.explanation !== 'string') {
    errors.push(`${prefix} explanation must be a string if provided`)
  }
  if (!questionObj.answers || !Array.isArray(questionObj.answers)) {
    errors.push(`${prefix} answers is required and must be an array`)
  }

  return { isValid: errors.length === 0, errors }
}

function validateAnswerData(answer: unknown, sessionIndex: number, questionIndex: number, answerIndex: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const prefix = `Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}:`
  
  if (!answer || typeof answer !== 'object') {
    errors.push(`${prefix} answer must be an object`)
    return { isValid: false, errors }
  }
  
  const answerObj = answer as Record<string, unknown>
  
  if (!answerObj.userAnswer || typeof answerObj.userAnswer !== 'string') {
    errors.push(`${prefix} userAnswer is required and must be a string`)
  }
  if (typeof answerObj.isCorrect !== 'boolean') {
    errors.push(`${prefix} isCorrect is required and must be a boolean`)
  }
  if (!answerObj.attemptedAt || typeof answerObj.attemptedAt !== 'string') {
    errors.push(`${prefix} attemptedAt is required and must be a string`)
  }

  return { isValid: errors.length === 0, errors }
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportSuccessResponse | ImportErrorResponse>> {
  const startTime = Date.now()
  let userId: string | undefined

  try {
    // Verify user authentication
    const authResult = await requireAuth(request)
    
    if (authResult.error || !authResult.user) {
      console.warn('Import legacy data: Authentication failed', { error: authResult.error })
      return NextResponse.json(
        { 
          success: false,
          error: authResult.error || 'Authentication required',
          code: ImportErrorCode.UNAUTHORIZED
        },
        { status: 401 }
      )
    }

    userId = authResult.user.userId
    console.log(`Import legacy data: Starting import for user ${userId}`)

    // Parse and validate request body
    let requestBody: unknown
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.error('Import legacy data: Failed to parse request body', { error: parseError, userId })
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: ImportErrorCode.INVALID_REQUEST,
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 400 }
      )
    }

    const { sessions }: ImportLegacyRequest = requestBody as ImportLegacyRequest

    // Validate request structure
    if (!sessions || !Array.isArray(sessions)) {
      console.warn('Import legacy data: Invalid request structure', { userId, hasSessions: !!sessions, isArray: Array.isArray(sessions) })
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: sessions array is required',
          code: ImportErrorCode.INVALID_REQUEST
        },
        { status: 400 }
      )
    }

    if (sessions.length === 0) {
      console.warn('Import legacy data: Empty sessions array', { userId })
      return NextResponse.json(
        {
          success: false,
          error: 'No sessions provided for import',
          code: ImportErrorCode.INVALID_REQUEST
        },
        { status: 400 }
      )
    }

    // Comprehensive validation of all session data
    const allValidationErrors: string[] = []
    
    for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
      const session = sessions[sessionIndex]
      
      // Validate session data
      const sessionValidation = validateSessionData(session)
      if (!sessionValidation.isValid) {
        allValidationErrors.push(...sessionValidation.errors.map(error => `Session ${sessionIndex}: ${error}`))
        continue // Skip further validation for this session if basic structure is invalid
      }

      // Validate date format
      try {
        new Date(session.createdAt)
      } catch {
        allValidationErrors.push(`Session ${sessionIndex}: createdAt must be a valid date string`)
      }

      // Validate each question
      for (let questionIndex = 0; questionIndex < session.questions.length; questionIndex++) {
        const question = session.questions[questionIndex]
        
        const questionValidation = validateQuestionData(question, sessionIndex, questionIndex)
        if (!questionValidation.isValid) {
          allValidationErrors.push(...questionValidation.errors)
          continue
        }

        // Validate each answer
        for (let answerIndex = 0; answerIndex < question.answers.length; answerIndex++) {
          const answer = question.answers[answerIndex]
          
          const answerValidation = validateAnswerData(answer, sessionIndex, questionIndex, answerIndex)
          if (!answerValidation.isValid) {
            allValidationErrors.push(...answerValidation.errors)
          }

          // Validate date format for attemptedAt
          try {
            new Date(answer.attemptedAt)
          } catch {
            allValidationErrors.push(`Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}: attemptedAt must be a valid date string`)
          }
        }
      }
    }

    // Return validation errors if any found
    if (allValidationErrors.length > 0) {
      console.warn('Import legacy data: Validation errors', { userId, errors: allValidationErrors })
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed for provided data',
          code: ImportErrorCode.VALIDATION_ERROR,
          details: allValidationErrors
        },
        { status: 400 }
      )
    }

    let importedSessions = 0
    let importedQuestions = 0
    let importedAnswers = 0

    console.log(`Import legacy data: Starting database transaction for ${sessions.length} sessions`, { userId })

    // Use database transaction to ensure data consistency
    try {
      await prisma.$transaction(async (tx) => {
        for (const legacySession of sessions) {
          try {
            // Create practice session
            const practiceSession = await tx.practiceSession.create({
              data: {
                userId: userId!,
                topic: legacySession.topic,
                difficulty: legacySession.difficulty,
                language: legacySession.language,
                transcript: legacySession.transcript,
                score: legacySession.score || null,
                createdAt: new Date(legacySession.createdAt),
                updatedAt: new Date(legacySession.createdAt)
              }
            })

            importedSessions++

            // Create questions and answers for this session
            for (const legacyQuestion of legacySession.questions) {
              const practiceQuestion = await tx.practiceQuestion.create({
                data: {
                  sessionId: practiceSession.id,
                  index: legacyQuestion.index,
                  type: legacyQuestion.type,
                  question: legacyQuestion.question,
                  options: legacyQuestion.options ? JSON.stringify(legacyQuestion.options) : null,
                  correctAnswer: legacyQuestion.correctAnswer,
                  explanation: legacyQuestion.explanation || null,
                  transcriptSnapshot: null, // Legacy data doesn't have this field
                  focusAreas: null, // Legacy data doesn't have focus areas
                  createdAt: new Date(legacySession.createdAt)
                }
              })

              importedQuestions++

              // Create answers for this question
              for (const legacyAnswer of legacyQuestion.answers) {
                await tx.practiceAnswer.create({
                  data: {
                    questionId: practiceQuestion.id,
                    userAnswer: legacyAnswer.userAnswer,
                    isCorrect: legacyAnswer.isCorrect,
                    attemptedAt: new Date(legacyAnswer.attemptedAt),
                    aiAnalysis: null,
                    aiAnalysisGeneratedAt: null,
                    tags: '[]', // Empty array as JSON string
                    needsAnalysis: !legacyAnswer.isCorrect // Set needsAnalysis to true for wrong answers
                  }
                })

                importedAnswers++
              }
            }
          } catch (sessionError) {
            console.error(`Import legacy data: Error processing session ${legacySession.sessionId}`, { 
              error: sessionError, 
              userId, 
              sessionId: legacySession.sessionId 
            })
            throw sessionError // Re-throw to trigger transaction rollback
          }
        }
      }, {
        timeout: 30000, // 30 second timeout for large imports
      })
    } catch (transactionError) {
      console.error('Import legacy data: Database transaction failed', { 
        error: transactionError, 
        userId,
        sessionsCount: sessions.length
      })
      
      // Handle specific database errors
      if (transactionError instanceof Error) {
        if (transactionError.message.includes('Unique constraint') || 
            transactionError.message.includes('UNIQUE constraint')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Some data already exists in the database. Please check for duplicate sessions.',
              code: ImportErrorCode.DUPLICATE_DATA,
              details: transactionError.message
            },
            { status: 409 }
          )
        }
        
        if (transactionError.message.includes('timeout') || 
            transactionError.message.includes('TIMEOUT')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Import operation timed out. Please try importing smaller batches.',
              code: ImportErrorCode.DATABASE_ERROR,
              details: 'Transaction timeout'
            },
            { status: 408 }
          )
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Database operation failed during import',
          code: ImportErrorCode.DATABASE_ERROR,
          details: transactionError instanceof Error ? transactionError.message : 'Unknown database error'
        },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`Import legacy data: Successfully completed for user ${userId}`, {
      duration: `${duration}ms`,
      imported: { sessions: importedSessions, questions: importedQuestions, answers: importedAnswers }
    })

    return NextResponse.json({
      success: true,
      message: 'Legacy data imported successfully',
      imported: {
        sessions: importedSessions,
        questions: importedQuestions,
        answers: importedAnswers
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('Import legacy data: Unexpected error occurred', { 
      error, 
      userId, 
      duration: `${duration}ms`,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    })
    
    // Handle different types of unexpected errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid data format in request',
          code: ImportErrorCode.INVALID_REQUEST,
          details: error.message
        },
        { status: 400 }
      )
    }

    if (error instanceof TypeError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data type validation failed',
          code: ImportErrorCode.VALIDATION_ERROR,
          details: error.message
        },
        { status: 400 }
      )
    }

    // Generic error response for any other unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during import. Please try again.',
        code: ImportErrorCode.INTERNAL_ERROR,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Provide named export for tests
export { POST as importLegacyHandler }

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  ;(globalThis as Record<string, unknown>).importLegacyHandler = POST
}
