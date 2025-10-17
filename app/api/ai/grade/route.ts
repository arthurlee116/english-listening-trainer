import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import type { ListeningLanguage, Question, FocusArea, FocusCoverage } from '@/lib/types'
import { validateFocusAreas, calculateFocusCoverage } from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { gradingSchema, type GradingStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'
import { getLanguageDisplayName } from '@/lib/language-config'
import { buildGradingPrompt } from '@/lib/ai/prompt-templates'

async function handleGrade(request: NextRequest): Promise<NextResponse> {
  const { transcript, questions, answers, language = 'en-US', focusAreas } = await request.json()

  if (!transcript || !questions || !answers) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 })
  }

  const validatedFocusAreas = validateFocusAreas(focusAreas)
  const languageName = getLanguageDisplayName(language as ListeningLanguage)

  const questionsWithAnswers = questions.map((q: Question, index: number) => ({
    question: q.question,
    type: q.type,
    options: q.options,
    correct_answer: q.answer,
    user_answer: answers[index] || ''
  }))

  const prompt = buildGradingPrompt({
    languageName,
    transcript,
    questionsWithAnswers
  })

  const messages: ArkMessage[] = [{ role: 'user', content: prompt }]

  const result = await invokeStructured<GradingStructuredResponse>({
    messages,
    schema: gradingSchema,
    schemaName: 'grading_response',
    options: {
      temperature: 0.2,
      maxTokens: 4096
    }
  })

  if (!result || !Array.isArray(result.results)) {
    throw new Error('AI响应格式异常')
  }

  let focusCoverage: FocusCoverage | undefined

  if (validatedFocusAreas.length > 0) {
    const allQuestionAreas = questions.flatMap((q: Question) => q.focus_areas || [])
    const providedAreas = Array.from(new Set(allQuestionAreas)) as FocusArea[]
    focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)
  }

  return NextResponse.json({
    success: true,
    results: result.results,
    focusCoverage
  })
}

export const POST = createAiRoute(handleGrade, {
  label: 'grade',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
