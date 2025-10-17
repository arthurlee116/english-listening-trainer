import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import { meetsLengthRequirement } from '@/lib/text-expansion'
import type { TranscriptGenerationResponse } from '@/lib/types'
import {
  calculateFocusCoverage,
  extractProvidedFocusAreas
} from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { transcriptSchema, type TranscriptStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'
import { preprocessRequestContext } from '@/lib/ai/request-preprocessor'
import { buildTranscriptPrompt } from '@/lib/ai/prompt-templates'
import { expandTranscript } from '@/lib/ai/transcript-expansion'

async function handleTranscript(request: NextRequest): Promise<NextResponse> {
  const {
    difficulty,
    wordCount,
    topic,
    language = 'en-US',
    difficultyLevel,
    focusAreas
  } = await request.json()

  if (!difficulty || !wordCount || !topic) {
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
    : `at ${context.difficultyLabel} level`

  const basePrompt = buildTranscriptPrompt({
    languageName: context.languageName,
    topic,
    wordCount,
    difficultyDescriptor,
    focusAreasPrompt: context.focusAreasPrompt,
    focusAreas: context.validatedFocusAreas
  })

  let totalGenerationAttempts = 0
  const maxTotalAttempts = 3
  let bestTranscript = ''
  let bestWordCount = 0

  for (let attempt = 0; attempt < maxTotalAttempts; attempt += 1) {
    totalGenerationAttempts += 1

    let transcript = ''
    let initialGenerationSuccess = false

    for (let genAttempt = 1; genAttempt <= 3; genAttempt += 1) {
      const messages: ArkMessage[] = [{ role: 'user', content: basePrompt }]
      const result = await invokeStructured<TranscriptStructuredResponse>({
        messages,
        schema: transcriptSchema,
        schemaName: 'transcript_response',
        options: {
          temperature: 0.35,
          maxTokens: 4096
        }
      })

      if (result && typeof result.transcript === 'string') {
        transcript = result.transcript.trim()

        if (meetsLengthRequirement(transcript, wordCount, 0.7)) {
          initialGenerationSuccess = true
          break
        }
      }
    }

    if (!initialGenerationSuccess) {
      continue
    }

    const expansionResult = await expandTranscript({
      text: transcript,
      targetWordCount: wordCount,
      topic,
      difficulty,
      language: context.languageCode,
      maxAttempts: 5,
      minAcceptablePercentage: 0.95
    })

    if (expansionResult.meetsRequirement) {
      const providedAreas = extractProvidedFocusAreas(
        expansionResult.expandedText,
        context.validatedFocusAreas
      )
      const focusCoverage = calculateFocusCoverage(context.validatedFocusAreas, providedAreas)

      const response: TranscriptGenerationResponse = {
        success: true,
        transcript: expansionResult.expandedText,
        focusCoverage: context.validatedFocusAreas.length > 0 ? focusCoverage : undefined,
        attempts: totalGenerationAttempts
      }

      return NextResponse.json(response)
    }

    if (meetsLengthRequirement(expansionResult.expandedText, wordCount, 0.9)) {
      if (expansionResult.finalWordCount > bestWordCount) {
        bestTranscript = expansionResult.expandedText
        bestWordCount = expansionResult.finalWordCount
      }
    }
  }

  if (bestTranscript) {
    const providedAreas = extractProvidedFocusAreas(bestTranscript, context.validatedFocusAreas)
    const focusCoverage = calculateFocusCoverage(context.validatedFocusAreas, providedAreas)

    const response: TranscriptGenerationResponse = {
      success: true,
      transcript: bestTranscript,
      focusCoverage: context.validatedFocusAreas.length > 0 ? focusCoverage : undefined,
      attempts: totalGenerationAttempts,
      degradationReason: `经过${totalGenerationAttempts}次生成尝试，最佳结果：${bestWordCount} / ${wordCount} 词`
    }

    return NextResponse.json(response)
  }

  return NextResponse.json(
    {
      error: `经过${totalGenerationAttempts}次生成尝试，无法生成符合要求的听力稿`
    },
    { status: 500 }
  )
}

export const POST = createAiRoute(handleTranscript, {
  label: 'transcript',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
