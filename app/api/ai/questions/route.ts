import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import type {
  ListeningLanguage,
  FocusArea,
  QuestionGenerationResponse,
  FocusCoverage,
  Question
} from '@/lib/types'
import {
  validateFocusAreas,
  calculateFocusCoverage,
  generateFocusAreasPrompt,
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
import { getLanguageDisplayName } from '@/lib/language-config'

async function handleQuestions(request: NextRequest): Promise<NextResponse> {
  try {
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

    const validatedFocusAreas = validateFocusAreas(focusAreas)
    const languageName = getLanguageDisplayName(language as ListeningLanguage)

    const suggestedCount = duration
      ? duration <= 120
        ? Math.max(1, Math.floor(duration / 60))
        : Math.min(10, Math.floor(duration / 60))
      : 10
    const targetCount = Math.min(10, Math.max(8, suggestedCount))

    let difficultyDescription = `Difficulty level: ${difficulty}`
    if (difficultyLevel && typeof difficultyLevel === 'number') {
      const { getDifficultyPromptModifier } = await import('@/lib/difficulty-service')
      difficultyDescription = getDifficultyPromptModifier(difficultyLevel, language)
    }

    const focusAreasPrompt = generateFocusAreasPrompt(validatedFocusAreas, languageName)

    let distributionRequirement = `5. Multiple choice distribution:
   - First 2: Test main idea comprehension
   - Middle 4-6: Test detail comprehension  
   - Last 2-3: Test inference and analysis`

    if (validatedFocusAreas.length > 0) {
      distributionRequirement = `5. Multiple choice distribution (PRIORITIZE SELECTED FOCUS AREAS):
   - Ensure at least 70% of questions target the selected focus areas: ${validatedFocusAreas.join(', ')}
   - Distribute remaining questions across other areas as appropriate`
    }

    const prompt = `You are a professional listening comprehension question generator. Create comprehension questions based on the following ${languageName} listening material.

Listening Material:
${transcript}

${difficultyDescription}${focusAreasPrompt}

Requirements:
1. Generate ${targetCount} questions total
2. All questions and answer options must be in ${languageName}
3. Match the specified difficulty characteristics exactly:
   - Question complexity should match the difficulty level
   - Vocabulary in questions should be appropriate for the level
   - Inference requirements should match cognitive complexity
4. Question type distribution:
   - First 9 questions: Multiple choice (single) with 4 options each
   - Last 1 question: Short answer (short) open-ended question
${distributionRequirement}
6. Focus area tags:
   - Label each question with 2-3 accurate focus area tags
   - Available tags: main-idea, detail-comprehension, inference, vocabulary, cause-effect, sequence, speaker-attitude, comparison, number-information, time-reference
   ${validatedFocusAreas.length > 0 ? `- PRIORITY: Ensure questions targeting ${validatedFocusAreas.join(', ')} are properly tagged` : ''}
7. Question explanations: Provide brief explanations for each question

Ensure high quality questions with accurate tags that effectively test ${languageName} listening comprehension skills.`

    let attempts = 0
    const maxAttempts = validatedFocusAreas.length > 0 ? 2 : 1
    let currentPrompt = prompt
    let bestResult:
      | {
          questions: QuestionsSchemaQuestion[]
          coverage: FocusCoverage
          match: Array<{
            questionIndex: number
            matchedTags: FocusArea[]
            confidence: 'high' | 'medium' | 'low'
          }>
        }
      | null = null

    while (attempts < maxAttempts) {
      attempts += 1

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

      if (result && Array.isArray(result.questions)) {
        const providedAreas = extractProvidedFocusAreas(result.questions, validatedFocusAreas)
        const focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)

        const taggingValidation = validateQuestionTagging(
          result.questions as unknown as Question[],
          validatedFocusAreas
        )

        const focusMatch = result.questions.map((question, index) => {
          const questionAreas = question.focus_areas || []
          const matchedTags = questionAreas.filter((area) =>
            validatedFocusAreas.includes(area as FocusArea)
          )

          let confidence: 'high' | 'medium' | 'low' = 'low'
          if (matchedTags.length >= 2) confidence = 'high'
          else if (matchedTags.length === 1) confidence = 'medium'

          return {
            questionIndex: index,
            matchedTags: matchedTags as FocusArea[],
            confidence
          }
        })

        const qualityAnalysis = analyzeCoverageQuality(focusCoverage, attempts)

        if (!bestResult || focusCoverage.coverage > bestResult.coverage.coverage) {
          bestResult = {
            questions: result.questions,
            coverage: focusCoverage,
            match: focusMatch
          }
        }

        if (!qualityAnalysis.shouldContinue || attempts >= maxAttempts) {
          if (qualityAnalysis.degradationReason) {
            logDegradationEvent({
              type: 'questions',
              requestedAreas: validatedFocusAreas,
              finalCoverage: bestResult.coverage.coverage,
              attempts,
              reason: qualityAnalysis.degradationReason
            })
          }

          const response: QuestionGenerationResponse = {
            success: true,
            questions: bestResult.questions,
            focusCoverage: validatedFocusAreas.length > 0 ? bestResult.coverage : undefined,
            focusMatch: validatedFocusAreas.length > 0 ? bestResult.match : undefined,
            attempts,
            degradationReason: qualityAnalysis.degradationReason
          }

          return NextResponse.json(response)
        }

        const retryPromptAddition =
          taggingValidation.recommendations.length > 0
            ? `\n\nIMPROVEMENT NEEDED: ${taggingValidation.recommendations.join('; ')}`
            : ''

        currentPrompt = generateRetryPrompt(prompt, focusCoverage, attempts + 1) + retryPromptAddition
        console.log(
          `Questions generation attempt ${attempts}: coverage ${focusCoverage.coverage}, retrying with improved prompt...`
        )
      } else {
        break
      }
    }

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('生成题目失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = createAiRoute(handleQuestions, {
  label: 'questions',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
