import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { withDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100 items per page
    const offset = (page - 1) * limit

    // Optional filters
    const difficulty = searchParams.get('difficulty')
    const language = searchParams.get('language')
    const questionType = searchParams.get('type')
    const search = searchParams.get('search')

    // Build where clause for filtering
    const whereClause = {
      question: {
        session: {
          userId: authResult.user.userId
        }
      },
      isCorrect: false // Only wrong answers
    }

    // Add session-level filters
    if (difficulty || language) {
      Object.assign(whereClause.question.session, {
        ...(difficulty && { difficulty }),
        ...(language && { language })
      })
    }

    // Add question-level filters
    if (questionType) {
      Object.assign(whereClause.question, { type: questionType })
    }

    // Add search filter for question content and topics
    if (search) {
      Object.assign(whereClause, {
        OR: [
          {
            question: {
              question: {
                contains: search,
                mode: 'insensitive' as const
              }
            }
          },
          {
            question: {
              session: {
                topic: {
                  contains: search,
                  mode: 'insensitive' as const
                }
              }
            }
          }
        ]
      })
    }

    // Query wrong answers with proper joins
    const [wrongAnswers, totalCount] = await withDatabase(async (prisma) => {
      return Promise.all([
        prisma.practiceAnswer.findMany({
          where: whereClause,
          orderBy: { attemptedAt: 'desc' },
          skip: offset,
          take: limit,
          include: {
            question: {
              include: {
                session: {
                  select: {
                    id: true,
                    topic: true,
                    difficulty: true,
                    language: true,
                    transcript: true,
                    createdAt: true
                  }
                }
              }
            }
          }
        }),
        prisma.practiceAnswer.count({
          where: whereClause
        })
      ])
    }, 'get wrong answers list')

    // Format the response according to the design specification
    const formattedWrongAnswers = wrongAnswers.map(answer => {
      // 安全解析 focus_areas 字段
      let focusAreas: string[] = []
      try {
        if (answer.question.focusAreas) {
          focusAreas = JSON.parse(answer.question.focusAreas)
        }
      } catch (error) {
        console.warn('Failed to parse focus_areas for question', {
          questionId: answer.question.id,
          focusAreas: answer.question.focusAreas,
          error
        })
      }

      return {
        answerId: answer.id,
        questionId: answer.question.id,
        sessionId: answer.question.session.id,
        session: {
          topic: answer.question.session.topic,
          difficulty: answer.question.session.difficulty,
          language: answer.question.session.language,
          createdAt: answer.question.session.createdAt.toISOString()
        },
        question: {
          index: answer.question.index,
          type: answer.question.type,
          question: answer.question.question,
          options: answer.question.options ? JSON.parse(answer.question.options) : undefined,
          correctAnswer: answer.question.correctAnswer,
          explanation: answer.question.explanation,
          transcript: answer.question.session.transcript,
          focus_areas: focusAreas // 添加能力标签信息
        },
        answer: {
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          attemptedAt: answer.attemptedAt.toISOString(),
          aiAnalysis: answer.aiAnalysis ? JSON.parse(answer.aiAnalysis) : undefined,
          aiAnalysisGeneratedAt: answer.aiAnalysisGeneratedAt?.toISOString(),
          needsAnalysis: answer.needsAnalysis
        }
      }
    })

    return NextResponse.json({
      wrongAnswers: formattedWrongAnswers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Get wrong answers list error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve wrong answers. Please try again later.' },
      { status: 500 }
    )
  }
}



if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  ; (globalThis as Record<string, unknown>).listHandler = GET
}
