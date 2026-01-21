import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getPrismaClient, tableHasColumn } from '@/lib/database'
import {
  importLegacySessions,
  validateLegacyPayload,
  type LegacySession,
  type ImportCounts
} from '@/lib/legacy-import'

const prisma = getPrismaClient()

enum ImportErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_DATA = 'DUPLICATE_DATA',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

interface ImportSuccessResponse {
  success: true
  message: string
  imported: ImportCounts
}

interface ImportErrorResponse {
  success: false
  error: string
  code: ImportErrorCode
  details?: unknown
}

function buildErrorResponse(
  code: ImportErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json<ImportErrorResponse>({ success: false, error: message, code, details }, { status })
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportSuccessResponse | ImportErrorResponse>> {
  const startTime = Date.now()
  let userId: string | undefined

  try {
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return buildErrorResponse(
        ImportErrorCode.UNAUTHORIZED,
        authResult.error || 'Authentication required',
        401
      )
    }

    userId = authResult.user.userId

    let sessions: LegacySession[]
    try {
      const body = await request.json()
      sessions = (body as { sessions: LegacySession[] }).sessions
    } catch (parseError) {
      return buildErrorResponse(
        ImportErrorCode.INVALID_REQUEST,
        'Invalid JSON in request body',
        400,
        parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      )
    }

    const validationErrors = validateLegacyPayload(sessions)
    if (validationErrors.length > 0) {
      return buildErrorResponse(
        ImportErrorCode.VALIDATION_ERROR,
        'Validation failed for provided data',
        400,
        validationErrors
      )
    }

    const hasFocusAreasColumn = await tableHasColumn(prisma, 'practice_questions', 'focus_areas')
    if (!hasFocusAreasColumn) {
      return buildErrorResponse(
        ImportErrorCode.DATABASE_ERROR,
        'Database schema is missing required columns',
        500,
        'practice_questions.focus_areas column is required for import'
      )
    }

    let imported: ImportCounts | null = null

    try {
      imported = await importLegacySessions(prisma, sessions, userId, hasFocusAreasColumn)
    } catch (transactionError) {
      if (transactionError instanceof Error) {
        if (transactionError.message.includes('Unique constraint') || transactionError.message.includes('UNIQUE constraint')) {
          return buildErrorResponse(
            ImportErrorCode.DUPLICATE_DATA,
            'Some data already exists in the database. Please check for duplicate sessions.',
            409,
            transactionError.message
          )
        }

        if (transactionError.message.toLowerCase().includes('timeout')) {
          return buildErrorResponse(
            ImportErrorCode.DATABASE_ERROR,
            'Import operation timed out. Please try importing smaller batches.',
            408,
            'Transaction timeout'
          )
        }
      }

      return buildErrorResponse(
        ImportErrorCode.DATABASE_ERROR,
        'Database operation failed during import',
        500,
        transactionError instanceof Error ? transactionError.message : 'Unknown database error'
      )
    }

    const duration = Date.now() - startTime
    console.log('Import legacy data: Successfully completed', {
      userId,
      duration: `${duration}ms`,
      imported
    })

    return NextResponse.json({
      success: true,
      message: 'Legacy data imported successfully',
      imported: imported ?? { sessions: 0, questions: 0, answers: 0 }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('Import legacy data: Unexpected error occurred', {
      error,
      userId,
      duration: `${duration}ms`,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    })

    if (error instanceof SyntaxError) {
      return buildErrorResponse(ImportErrorCode.INVALID_REQUEST, 'Invalid data format in request', 400, error.message)
    }

    if (error instanceof TypeError) {
      return buildErrorResponse(ImportErrorCode.VALIDATION_ERROR, 'Data type validation failed', 400, error.message)
    }

    return buildErrorResponse(
      ImportErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred during import. Please try again.',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}



if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  ; (globalThis as Record<string, unknown>).importLegacyHandler = POST
}
