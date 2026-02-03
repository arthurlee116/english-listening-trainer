import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import type { TopicGenerationResponse, FocusCoverage } from '@/lib/types'
import {
  calculateFocusCoverage,
  extractProvidedFocusAreas,
  analyzeCoverageQuality,
  generateRetryPrompt,
  logDegradationEvent
} from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { topicsSchema, type TopicsStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'
import { preprocessRequestContext } from '@/lib/ai/request-preprocessor'
import { buildTopicsPrompt } from '@/lib/ai/prompt-templates'
import { executeWithCoverageRetry } from '@/lib/ai/retry-strategy'

async function handleTopics(request: NextRequest): Promise<NextResponse> {
  const {
    difficulty,
    wordCount,
    language = 'en-US',
    difficultyLevel,
    focusAreas,
    excludedTopics
  } = await request.json()

  if (!difficulty || !wordCount) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 })
  }

  const context = preprocessRequestContext({
    difficulty,
    language,
    difficultyLevel,
    focusAreas
  })

  const difficultyDescriptor = context.hasDifficultyLevel
    ? context.difficultyModifier
    : context.difficultyLabel

  const prompt = buildTopicsPrompt({
    languageName: context.languageName,
    wordCount,
    difficultyDescriptor,
    focusAreasPrompt: context.focusAreasPrompt,
    focusAreas: context.validatedFocusAreas,
    excludedTopics
  })

  const maxAttempts = context.validatedFocusAreas.length > 0 ? 2 : 1

  const { best, attempts, degradationReason } = await executeWithCoverageRetry<
    TopicsStructuredResponse,
    FocusCoverage
  >({
    basePrompt: prompt,
    maxAttempts,
    generate: async (currentPrompt) => {
      const messages: ArkMessage[] = [{ role: 'user', content: currentPrompt }]
      const result = await invokeStructured<TopicsStructuredResponse>({
        messages,
        schema: topicsSchema,
        schemaName: 'topics_response',
        options: {
          temperature: 0.3,
          maxTokens: 512
        }
      })

      if (!result || !Array.isArray(result.topics)) {
        throw new Error('AI响应格式异常')
      }

      return result
    },
    evaluate: (result) => {
      const providedAreas = extractProvidedFocusAreas(result.topics, context.validatedFocusAreas)
      return calculateFocusCoverage(context.validatedFocusAreas, providedAreas)
    },
    shouldRetry: (coverage, attempt) => {
      const analysis = analyzeCoverageQuality(coverage, attempt)
      return {
        retry: analysis.shouldContinue,
        degradationReason: analysis.degradationReason
      }
    },
    buildRetryPrompt: (basePrompt, _data, coverage, nextAttempt) =>
      generateRetryPrompt(basePrompt, coverage, nextAttempt),
    score: (coverage) => coverage.coverage
  })

  if (!best) {
    throw new Error('AI响应格式异常')
  }

  if (degradationReason && context.validatedFocusAreas.length > 0) {
    logDegradationEvent({
      type: 'topics',
      requestedAreas: context.validatedFocusAreas,
      finalCoverage: best.evaluation.coverage,
      attempts,
      reason: degradationReason
    })
  }

  const response: TopicGenerationResponse = {
    success: true,
    topics: best.data.topics,
    focusCoverage: context.validatedFocusAreas.length > 0 ? best.evaluation : undefined,
    attempts,
    degradationReason
  }

  return NextResponse.json(response)
}

export const POST = createAiRoute(handleTopics, {
  label: 'topics',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
