import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
import type { ListeningLanguage, FocusArea, QuestionGenerationResponse, FocusCoverage } from '@/lib/types'
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

interface GeneratedQuestion {
  type: 'single' | 'short'
  question: string
  options: string[] | null
  answer: string
  focus_areas: FocusArea[]
  explanation: string
}

interface QuestionsResponse {
  questions: GeneratedQuestion[]
}

// 语言名称映射
const LANGUAGE_NAMES: Record<ListeningLanguage, string> = {
  'en-US': 'American English',
  'en-GB': 'British English', 
  'es': 'Spanish',
  'fr': 'French',
  'ja': 'Japanese',
  'it': 'Italian',
  'pt-BR': 'Portuguese',
  'hi': 'Hindi'
}

export async function POST(request: NextRequest) {
  try {
    const { difficulty, transcript, duration, language = 'en-US', difficultyLevel, focusAreas } = await request.json()

    if (!difficulty || !transcript) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    // 验证和处理 focusAreas 参数
    const validatedFocusAreas = validateFocusAreas(focusAreas)

    const languageName = LANGUAGE_NAMES[language as ListeningLanguage] || 'English'

    // 计算建议题目数量
    const suggestedCount = duration ? (duration <= 120 ? Math.max(1, Math.floor(duration / 60)) : Math.min(10, Math.floor(duration / 60))) : 10
    const targetCount = Math.min(10, Math.max(8, suggestedCount))

    // 如果提供了数字难度等级，使用更精确的难度描述
    let difficultyDescription = `Difficulty level: ${difficulty}`
    if (difficultyLevel && typeof difficultyLevel === 'number') {
      const { getDifficultyPromptModifier } = await import('@/lib/difficulty-service')
      difficultyDescription = getDifficultyPromptModifier(difficultyLevel, language)
    }

    // 生成专项练习提示词
    const focusAreasPrompt = generateFocusAreasPrompt(validatedFocusAreas, languageName)
    
    // 构建专项练习的分布要求
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

    const schema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['single', 'short'] },
              question: { type: 'string' },
              options: {
                anyOf: [
                  { type: 'array', items: { type: 'string' } },
                  { type: 'null' },
                ],
              },
              answer: { type: 'string' },
              focus_areas: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['main-idea', 'detail-comprehension', 'inference', 'vocabulary', 'cause-effect', 'sequence', 'speaker-attitude', 'comparison', 'number-information', 'time-reference']
                }
              },
              explanation: { type: 'string' },
            },
            required: ['type', 'question', 'options', 'answer', 'focus_areas', 'explanation'],
            additionalProperties: false,
          },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    }

    let attempts = 0
    const maxAttempts = validatedFocusAreas.length > 0 ? 2 : 1
    let currentPrompt = prompt
    let bestResult: { 
      questions: GeneratedQuestion[], 
      coverage: FocusCoverage,
      match: Array<{
        questionIndex: number
        matchedTags: FocusArea[]
        confidence: 'high' | 'medium' | 'low'
      }>
    } | null = null

    while (attempts < maxAttempts) {
      attempts++
      
      const messages: ArkMessage[] = [{ role: 'user', content: currentPrompt }]
      const result = await callArkAPI(messages, schema, 'questions_response') as QuestionsResponse

      if (result && Array.isArray(result.questions)) {
        // 计算覆盖率和匹配度
        const providedAreas = extractProvidedFocusAreas(result.questions, validatedFocusAreas)
        const focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)
        
        // 验证题目标签质量
        const taggingValidation = validateQuestionTagging(result.questions, validatedFocusAreas)
        
        // 计算每个题目的匹配度
        const focusMatch = result.questions.map((question, index) => {
          const questionAreas = question.focus_areas || []
          const matchedTags = questionAreas.filter(area => 
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
        
        // 分析覆盖质量
        const qualityAnalysis = analyzeCoverageQuality(focusCoverage, attempts)
        
        // 保存最佳结果
        if (!bestResult || focusCoverage.coverage > bestResult.coverage.coverage) {
          bestResult = { 
            questions: result.questions, 
            coverage: focusCoverage,
            match: focusMatch
          }
        }
        
        // 如果质量足够或不应继续，返回结果
        if (!qualityAnalysis.shouldContinue || attempts >= maxAttempts) {
          // 记录降级事件
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
        
        // 需要重试，生成改进的提示词
        const retryPromptAddition = taggingValidation.recommendations.length > 0 
          ? `\n\nIMPROVEMENT NEEDED: ${taggingValidation.recommendations.join('; ')}`
          : ''
        
        currentPrompt = generateRetryPrompt(prompt, focusCoverage, attempts + 1) + retryPromptAddition
        console.log(`Questions generation attempt ${attempts}: coverage ${focusCoverage.coverage}, retrying with improved prompt...`)
      } else {
        break // AI响应格式异常，退出重试循环
      }
    }

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('生成题目失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
} 