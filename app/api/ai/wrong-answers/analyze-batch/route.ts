import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/database'
import { analyzeWrongAnswer, type AnalysisRequest, type AnalysisResponse } from '@/lib/ai-analysis-service'
import { 
  checkRateLimit, 
  recordFailedRequest, 
  recordSuccessfulRequest,
  RateLimitConfigs,
  aiServiceCircuitBreaker,
  createUserBasedKeyGenerator
} from '@/lib/rate-limiter'

interface BatchAnalyzeRequestBody {
  answerIds: string[]
}

interface BatchAnalyzeResponse {
  success: {
    answerId: string
    analysis: AnalysisResponse
  }[]
  failed: {
    answerId: string
    error: string
  }[]
  summary: {
    total: number
    successful: number
    failed: number
  }
}

interface AnswerData {
  id: string
  userAnswer: string
  isCorrect: boolean
  attemptedAt: Date
  needsAnalysis: boolean
  question: {
    id: string
    type: string
    question: string
    options: string | null
    correctAnswer: string
    transcriptSnapshot: string | null
    session: {
      userId: string
      topic: string
      difficulty: string
      language: string
      transcript: string
    }
  }
}

// Concurrency limit for batch processing
const MAX_CONCURRENT_REQUESTS = 100
const BATCH_SIZE = 10 // Process in smaller batches to avoid overwhelming the AI service

export async function POST(request: NextRequest) {
  try {
    // Check rate limit for batch processing
    const rateLimitConfig = {
      ...RateLimitConfigs.BATCH_PROCESSING,
      keyGenerator: createUserBasedKeyGenerator('batch-analysis:')
    }
    
    const rateLimitResult = checkRateLimit(request, rateLimitConfig)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error,
          rateLimitInfo: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime
          }
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      )
    }

    // Verify user authentication
    const authResult = await requireAuth(request)
    
    if (authResult.error || !authResult.user) {
      recordFailedRequest(request, rateLimitConfig)
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    const body: BatchAnalyzeRequestBody = await request.json()

    // Validate request body
    if (!body.answerIds || !Array.isArray(body.answerIds)) {
      return NextResponse.json(
        { error: '请提供有效的答案ID数组' },
        { status: 400 }
      )
    }

    if (body.answerIds.length === 0) {
      return NextResponse.json(
        { error: '答案ID数组不能为空' },
        { status: 400 }
      )
    }

    if (body.answerIds.length > MAX_CONCURRENT_REQUESTS) {
      return NextResponse.json(
        { error: `批量处理最多支持 ${MAX_CONCURRENT_REQUESTS} 个答案` },
        { status: 400 }
      )
    }

    // Fetch all answers with their related data
    const answers = await withDatabase(async (prisma) => {
      return await prisma.practiceAnswer.findMany({
        where: {
          id: { in: body.answerIds },
          question: {
            session: {
              userId: authResult.user!.userId
            }
          }
        },
        include: {
          question: {
            include: {
              session: true
            }
          }
        }
      })
    }, 'fetch answers for batch analysis')

    // Validate that all requested answers exist and belong to the user
    const foundAnswerIds = new Set(answers.map(a => a.id))
    const missingAnswerIds = body.answerIds.filter(id => !foundAnswerIds.has(id))
    
    if (missingAnswerIds.length > 0) {
      return NextResponse.json(
        { error: `以下答案不存在或无权限访问: ${missingAnswerIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Filter out correct answers - only analyze wrong answers
    const wrongAnswers = answers.filter(answer => !answer.isCorrect)
    const correctAnswerIds = answers.filter(answer => answer.isCorrect).map(a => a.id)

    if (wrongAnswers.length === 0) {
      return NextResponse.json({
        success: [],
        failed: correctAnswerIds.map(id => ({
          answerId: id,
          error: '只能分析错误答案'
        })),
        summary: {
          total: body.answerIds.length,
          successful: 0,
          failed: body.answerIds.length
        }
      })
    }

    // Process answers in batches with concurrency control
    const successResults: { answerId: string; analysis: AnalysisResponse }[] = []
    const failedResults: { answerId: string; error: string }[] = []

    // Add correct answers to failed results
    correctAnswerIds.forEach(id => {
      failedResults.push({
        answerId: id,
        error: '只能分析错误答案'
      })
    })

    // Process wrong answers in batches
    for (let i = 0; i < wrongAnswers.length; i += BATCH_SIZE) {
      const batch = wrongAnswers.slice(i, i + BATCH_SIZE)
      
      const batchPromises = batch.map(async (answer: AnswerData) => {
        try {
          // Parse options if they exist
          let options: string[] | undefined
          if (answer.question.options) {
            try {
              options = JSON.parse(answer.question.options)
            } catch {
              // If parsing fails, treat as undefined
              options = undefined
            }
          }

          // Prepare analysis request
          const analysisRequest: AnalysisRequest = {
            questionType: answer.question.type,
            question: answer.question.question,
            options,
            userAnswer: answer.userAnswer,
            correctAnswer: answer.question.correctAnswer,
            transcript: answer.question.transcriptSnapshot || answer.question.session.transcript,
            exerciseTopic: answer.question.session.topic,
            exerciseDifficulty: answer.question.session.difficulty,
            language: answer.question.session.language,
            attemptedAt: answer.attemptedAt.toISOString()
          }

          // Call AI analysis service with circuit breaker
          const analysisResult = await aiServiceCircuitBreaker.execute(async () => {
            return await analyzeWrongAnswer(analysisRequest)
          })

          // Store analysis result in database
          await withDatabase(async (prisma) => {
            await prisma.practiceAnswer.update({
              where: { id: answer.id },
              data: {
                aiAnalysis: JSON.stringify(analysisResult),
                aiAnalysisGeneratedAt: new Date(),
                needsAnalysis: false
              }
            })
          }, `store AI analysis result for answer ${answer.id}`)

          return {
            success: true as const,
            answerId: answer.id,
            analysis: analysisResult
          }
        } catch (error) {
          console.error(`Batch analysis failed for answer ${answer.id}:`, error)
          return {
            success: false as const,
            answerId: answer.id,
            error: error instanceof Error ? error.message : '未知错误'
          }
        }
      })

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Collect results
      for (const result of batchResults) {
        if (result.success) {
          successResults.push({
            answerId: result.answerId,
            analysis: result.analysis
          })
        } else {
          failedResults.push({
            answerId: result.answerId,
            error: result.error
          })
        }
      }
    }

    // Record successful request
    recordSuccessfulRequest(request, rateLimitConfig)

    // Prepare response
    const response: BatchAnalyzeResponse = {
      success: successResults,
      failed: failedResults,
      summary: {
        total: body.answerIds.length,
        successful: successResults.length,
        failed: failedResults.length
      }
    }

    return NextResponse.json(response, {
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, rateLimitResult.remaining - 1).toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    })

  } catch (error) {
    console.error('Batch wrong answer analysis error:', error)
    
    // Record failed request for rate limiting
    const rateLimitConfig = {
      ...RateLimitConfigs.BATCH_PROCESSING,
      keyGenerator: createUserBasedKeyGenerator('batch-analysis:')
    }
    recordFailedRequest(request, rateLimitConfig)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return NextResponse.json(
          { 
            error: 'AI服务暂时不可用，请稍后重试',
            circuitBreakerState: aiServiceCircuitBreaker.getState(),
            retryAfter: 60
          },
          { 
            status: 503,
            headers: {
              'Retry-After': '60'
            }
          }
        )
      }
      
      if (error.message.includes('数据库')) {
        return NextResponse.json(
          { error: '数据库操作失败，请稍后重试' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: '批量分析失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export { POST as analyzeBatchHandler }

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  ;(globalThis as Record<string, unknown>).analyzeBatchHandler = POST
}
