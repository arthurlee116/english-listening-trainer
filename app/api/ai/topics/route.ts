import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import type { ListeningLanguage, TopicGenerationResponse, FocusCoverage } from '@/lib/types'
import {
  validateFocusAreas,
  calculateFocusCoverage,
  generateFocusAreasPrompt,
  extractProvidedFocusAreas,
  analyzeCoverageQuality,
  generateRetryPrompt,
  logDegradationEvent
} from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { topicsSchema, type TopicsStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { getLanguageDisplayName } from '@/lib/language-config'
import { RateLimitConfigs } from '@/lib/rate-limiter'

async function handleTopics(request: NextRequest): Promise<NextResponse> {
  try {
    const {
      difficulty,
      wordCount,
      language = 'en-US',
      difficultyLevel,
      focusAreas
    } = await request.json()

    if (!difficulty || !wordCount) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const validatedFocusAreas = validateFocusAreas(focusAreas)
    const languageName = getLanguageDisplayName(language as ListeningLanguage)

    let difficultyDescription = difficulty
    if (difficultyLevel && typeof difficultyLevel === 'number') {
      const { getDifficultyPromptModifier } = await import('@/lib/difficulty-service')
      difficultyDescription = getDifficultyPromptModifier(difficultyLevel, language)
    }

    const focusAreasPrompt = generateFocusAreasPrompt(validatedFocusAreas, languageName)

    const prompt = `You are a listening comprehension topic generator. Generate 5 topics suitable for ${languageName} listening practice with approximately ${wordCount} words. 

${difficultyDescription}${focusAreasPrompt}

Requirements:
- All topics must be generated in ${languageName}
- Topics should match the specified difficulty characteristics
- Each topic should be a phrase or short sentence
- Topics should be engaging and practical
- Consider the vocabulary complexity and subject matter appropriate for this level
${validatedFocusAreas.length > 0 ? `- Topics should be suitable for practicing the specified focus areas: ${validatedFocusAreas.join(', ')}` : ''}

Return exactly 5 topics in ${languageName}.`

    let attempts = 0
    const maxAttempts = validatedFocusAreas.length > 0 ? 2 : 1
    let currentPrompt = prompt
    let bestResult: { topics: string[]; coverage: FocusCoverage } | null = null

    while (attempts < maxAttempts) {
      attempts += 1

      const messages: ArkMessage[] = [{ role: 'user', content: currentPrompt }]
      const result = await invokeStructured<TopicsStructuredResponse>({
        messages,
        schema: topicsSchema,
        schemaName: 'topics_response',
        options: {
          temperature: 0.6,
          maxTokens: 512
        }
      })

      if (result && Array.isArray(result.topics)) {
        const providedAreas = extractProvidedFocusAreas(result.topics, validatedFocusAreas)
        const focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)
        const qualityAnalysis = analyzeCoverageQuality(focusCoverage, attempts)

        if (!bestResult || focusCoverage.coverage > bestResult.coverage.coverage) {
          bestResult = { topics: result.topics, coverage: focusCoverage }
        }

        if (!qualityAnalysis.shouldContinue || attempts >= maxAttempts) {
          if (qualityAnalysis.degradationReason) {
            logDegradationEvent({
              type: 'topics',
              requestedAreas: validatedFocusAreas,
              finalCoverage: focusCoverage.coverage,
              attempts,
              reason: qualityAnalysis.degradationReason
            })
          }

          const response: TopicGenerationResponse = {
            success: true,
            topics: bestResult.topics,
            focusCoverage: validatedFocusAreas.length > 0 ? bestResult.coverage : undefined,
            attempts,
            degradationReason: qualityAnalysis.degradationReason
          }

          return NextResponse.json(response)
        }

        currentPrompt = generateRetryPrompt(prompt, focusCoverage, attempts + 1)
        console.log(
          `Topics generation attempt ${attempts}: coverage ${focusCoverage.coverage}, retrying with improved prompt...`
        )
      } else {
        break
      }
    }

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('生成话题失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = createAiRoute(handleTopics, {
  label: 'topics',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
