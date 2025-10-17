import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import type { FocusArea, QuestionGenerationResponse, FocusCoverage, Question } from '@/lib/types'
import {
  calculateFocusCoverage,
  extractProvidedFocusAreas,
  analyzeCoverageQuality,
  generateRetryPrompt,
  logDegradationEvent,
  validateQuestionTagging
} from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import {
  questionsSchema,
  type QuestionsStructuredResponse,
  type QuestionsSchemaQuestion
} from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'
import { preprocessRequestContext } from '@/lib/ai/request-preprocessor'
import { buildQuestionsPrompt } from '@/lib/ai/prompt-templates'
import { executeWithCoverageRetry } from '@/lib/ai/retry-strategy'

async function handleQuestions(request: NextRequest): Promise<NextResponse> {
  const {
    difficulty,
    transcript,
    duration,
    language = 'en-US',
    difficultyLevel,
    focusAreas
  } = await request.json()

  if (!difficulty || !transcript) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 })
  }

  const suggestedCount = duration
    ? duration <= 120
      ? Math.max(1, Math.floor(duration / 60))
      : Math.min(10, Math.floor(duration / 60))
    : 10
  const targetCount = Math.min(10, Math.max(8, suggestedCount))

  const context = preprocessRequestContext({
    difficulty,
    language,
    difficultyLevel,
    focusAreas
  })

  const difficultyDescriptor = context.hasDifficultyLevel
    ? context.difficultyModifier
    : `Difficulty level: ${context.difficultyLabel}`

  const prompt = buildQuestionsPrompt({
    languageName: context.languageName,
    transcript,
    difficultyDescriptor,
    focusAreasPrompt: context.focusAreasPrompt,
    focusAreas: context.validatedFocusAreas,
    targetCount
  })

  const maxAttempts = context.validatedFocusAreas.length > 0 ? 2 : 1

  const { best, attempts, degradationReason } = await executeWithCoverageRetry<
    QuestionsStructuredResponse,
    FocusCoverage
  >({
    basePrompt: prompt,
    maxAttempts,
    generate: async (currentPrompt) => {
      const messages: ArkMessage[] = [{ role: 'user', content: currentPrompt }]
      const result = await invokeStructured<QuestionsStructuredResponse>({
        messages,
        schema: questionsSchema,
        schemaName: 'questions_response',
        options: {
          temperature: 0.5,
          maxTokens: 4096
        }
      })

      if (!result || !Array.isArray(result.questions)) {
        throw new Error('AI响应格式异常')
      }

      return result
    },
    evaluate: (result) => {
      const providedAreas = extractProvidedFocusAreas(result.questions, context.validatedFocusAreas)
      return calculateFocusCoverage(context.validatedFocusAreas, providedAreas)
    },
    shouldRetry: (coverage, attempt) => {
      const analysis = analyzeCoverageQuality(coverage, attempt)
      return {
        retry: analysis.shouldContinue,
        degradationReason: analysis.degradationReason
      }
    },
    buildRetryPrompt: (basePrompt, data, coverage, nextAttempt) => {
      const retryPrompt = generateRetryPrompt(basePrompt, coverage, nextAttempt)
      const taggingValidation = validateQuestionTagging(
        mapSchemaQuestionsToDomain(data.questions),
        context.validatedFocusAreas
      )

      if (taggingValidation.recommendations.length === 0) {
        return retryPrompt
      }

      return `${retryPrompt}\n\nIMPROVEMENT NEEDED: ${taggingValidation.recommendations.join('; ')}`
    },
    score: (coverage) => coverage.coverage
  })

  if (!best) {
    throw new Error('AI响应格式异常')
  }

  if (degradationReason && context.validatedFocusAreas.length > 0) {
    logDegradationEvent({
      type: 'questions',
      requestedAreas: context.validatedFocusAreas,
      finalCoverage: best.evaluation.coverage,
      attempts,
      reason: degradationReason
    })
  }

  const focusMatch = context.validatedFocusAreas.length > 0
    ? computeFocusMatch(best.data.questions, context.validatedFocusAreas)
    : undefined

  const response: QuestionGenerationResponse = {
    success: true,
    questions: best.data.questions,
    focusCoverage: context.validatedFocusAreas.length > 0 ? best.evaluation : undefined,
    focusMatch,
    attempts,
    degradationReason
  }

  return NextResponse.json(response)
}

function mapSchemaQuestionsToDomain(questions: QuestionsSchemaQuestion[]): Question[] {
  return questions.map((question) => ({
    question: question.question,
    type: question.type as Question['type'],
    options: question.options ?? undefined,
    answer: question.answer,
    focus_areas: (question.focus_areas ?? []) as FocusArea[],
    explanation: question.explanation
  }))
}

function computeFocusMatch(
  questions: QuestionsSchemaQuestion[],
  requestedAreas: FocusArea[]
) {
  return questions.map((question, index) => {
    const questionAreas = (question.focus_areas ?? []) as FocusArea[]
    const matchedTags = questionAreas.filter((area) => requestedAreas.includes(area))

    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (matchedTags.length >= 2) {
      confidence = 'high'
    } else if (matchedTags.length === 1) {
      confidence = 'medium'
    }

    return {
      questionIndex: index,
      matchedTags,
      confidence
    }
  })
}

export const POST = createAiRoute(handleQuestions, {
  label: 'questions',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
