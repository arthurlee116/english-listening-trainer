import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/database'
import { analyzeWrongAnswer, type AnalysisRequest } from '@/lib/ai-analysis-service'
import { 
  checkRateLimit, 
  recordFailedRequest, 
  recordSuccessfulRequest,
  RateLimitConfigs,
  aiServiceCircuitBreaker,
  createUserBasedKeyGenerator
} from '@/lib/rate-limiter'

interface AnalyzeRequestBody {
  questionId: string
  answerId: string
  questionType: string
  question: string
  options?: string[]
  userAnswer: string
  correctAnswer: string
  transcript: string
  exerciseTopic: string
  exerciseDifficulty: string
  language: string
  attemptedAt: string
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit first
    const rateLimitConfig = {
      ...RateLimitConfigs.AI_ANALYSIS,
      keyGenerator: createUserBasedKeyGenerator('ai-analysis:')
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

    const body: AnalyzeRequestBody = await request.json()

    // Validate required fields
    const requiredFields = [
      'questionId', 'answerId', 'questionType', 'question', 
      'userAnswer', 'correctAnswer', 'transcript', 'exerciseTopic', 
      'exerciseDifficulty', 'language', 'attemptedAt'
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `缺少必填字段: ${field}` },
          { status: 400 }
      )
      }
    }

    const {
      questionId,
      answerId,
      questionType,
      question,
      options,
      userAnswer,
      correctAnswer,
      transcript,
      exerciseTopic,
      exerciseDifficulty,
      language,
      attemptedAt
    } = body

    // Verify that the answer belongs to the authenticated user
    const answerExists = await withDatabase(async (prisma) => {
      const answer = await prisma.practiceAnswer.findFirst({
        where: {
          id: answerId,
          questionId: questionId,
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
      return answer
    }, 'verify answer ownership')

    if (!answerExists) {
      return NextResponse.json(
        { error: '答案不存在或无权限访问' },
        { status: 404 }
      )
    }

    // Check if answer is actually incorrect
    if (answerExists.isCorrect) {
      return NextResponse.json(
        { error: '只能分析错误答案' },
        { status: 400 }
      )
    }

    // Prepare analysis request
    const analysisRequest: AnalysisRequest = {
      questionType,
      question,
      options,
      userAnswer,
      correctAnswer,
      transcript,
      exerciseTopic,
      exerciseDifficulty,
      language,
      attemptedAt
    }

    // Call AI analysis service with circuit breaker and retry logic
    let analysisResult
    try {
      analysisResult = await aiServiceCircuitBreaker.execute(async () => {
        return await analyzeWrongAnswer(analysisRequest)
      })
    } catch (error) {
      recordFailedRequest(request, rateLimitConfig)
      
      if (error instanceof Error && error.message.includes('Circuit breaker is OPEN')) {
        return NextResponse.json(
          { 
            error: 'AI服务暂时不可用，请稍后重试',
            circuitBreakerState: aiServiceCircuitBreaker.getState(),
            retryAfter: 60 // seconds
          },
          { 
            status: 503,
            headers: {
              'Retry-After': '60'
            }
          }
        )
      }
      
      return NextResponse.json(
        { error: `AI分析失败: ${error instanceof Error ? error.message : '未知错误'}` },
        { status: 500 }
      )
    }

    // Store analysis result in database
    await withDatabase(async (prisma) => {
      await prisma.practiceAnswer.update({
        where: { id: answerId },
        data: {
          aiAnalysis: JSON.stringify(analysisResult),
          aiAnalysisGeneratedAt: new Date(),
          needsAnalysis: false
        }
      })
    }, 'store AI analysis result')

    // Record successful request
    recordSuccessfulRequest(request, rateLimitConfig)

    return NextResponse.json({
      success: true,
      analysis: analysisResult
    }, {
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, rateLimitResult.remaining - 1).toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    })

  } catch (error) {
    console.error('Wrong answer analysis error:', error)
    
    // Record failed request for rate limiting
    const rateLimitConfig = {
      ...RateLimitConfigs.AI_ANALYSIS,
      keyGenerator: createUserBasedKeyGenerator('ai-analysis:')
    }
    recordFailedRequest(request, rateLimitConfig)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('AI分析失败')) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
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
      { error: '分析失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export { POST as analyzeHandler }

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  ;(globalThis as Record<string, unknown>).analyzeHandler = POST
}
