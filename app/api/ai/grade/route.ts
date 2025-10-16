import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import type { ListeningLanguage, Question, FocusArea, FocusCoverage } from '@/lib/types'
import { validateFocusAreas, calculateFocusCoverage } from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { gradingSchema, type GradingStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'
import { getLanguageDisplayName } from '@/lib/language-config'

async function handleGrade(request: NextRequest): Promise<NextResponse> {
  try {
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

    const prompt = `You are a professional ${languageName} listening comprehension grader. Grade the user's answers based on the listening material and questions.

Listening Material (${languageName}):
${transcript}

Questions and Answers (${languageName}):
${JSON.stringify(questionsWithAnswers)}

Grading Requirements:
1. Multiple choice questions: Judge correct/incorrect, no detailed feedback needed
2. Short answer questions: Professional grading including:
   - Generate concise ${languageName} reference answer (60-200 words)
   - Give score 1-10
   - Provide detailed Chinese feedback and analysis (批改意见必须用中文)
3. Error analysis tags: Generate 2-4 tags for each incorrect answer from the following tag library:

Error Type Tags: detail-missing(细节理解缺失), main-idea(主旨理解错误), inference(推理判断错误), vocabulary(词汇理解问题), number-confusion(数字混淆), time-confusion(时间理解错误), speaker-confusion(说话人混淆), negation-missed(否定词遗漏)

Knowledge Point Tags: tense-error(时态理解), modal-verbs(情态动词), phrasal-verbs(短语动词), idioms(习语理解), pronoun-reference(代词指代), cause-effect(因果关系), sequence(顺序关系), comparison(比较关系)

Context Tags: academic(学术场景), business(商务场景), daily-life(日常生活), travel(旅行场景), technology(科技话题), culture(文化话题)

Difficulty Tags: accent-difficulty(口音理解), speed-issue(语速问题), complex-sentence(复杂句型), technical-terms(专业术语)

请根据错误原因合理选择标签，帮助识别学习薄弱点。所有分析和反馈必须用中文提供。`

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

    if (result && Array.isArray(result.results)) {
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

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('批改失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = createAiRoute(handleGrade, {
  label: 'grade',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
