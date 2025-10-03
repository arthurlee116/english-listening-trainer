import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
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

interface TopicsResponse {
  topics: string[]
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
    const { difficulty, wordCount, language = 'en-US', difficultyLevel, focusAreas } = await request.json()

    if (!difficulty || !wordCount) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    // 验证和处理 focusAreas 参数
    const validatedFocusAreas = validateFocusAreas(focusAreas)

    const languageName = LANGUAGE_NAMES[language as ListeningLanguage] || 'English'
    
    // 如果提供了数字难度等级，使用更精确的难度描述
    let difficultyDescription = difficulty
    if (difficultyLevel && typeof difficultyLevel === 'number') {
      const { getDifficultyPromptModifier } = await import('@/lib/difficulty-service')
      difficultyDescription = getDifficultyPromptModifier(difficultyLevel, language)
    }
    
    // 生成专项练习提示词
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

    const schema = {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['topics'],
      additionalProperties: false,
    }

    let attempts = 0
    const maxAttempts = validatedFocusAreas.length > 0 ? 2 : 1
    let currentPrompt = prompt
    let bestResult: { topics: string[], coverage: FocusCoverage } | null = null

    while (attempts < maxAttempts) {
      attempts++
      
      const messages: ArkMessage[] = [{ role: 'user', content: currentPrompt }]
      const result = await callArkAPI(messages, schema, 'topics_response') as TopicsResponse

      if (result && Array.isArray(result.topics)) {
        // 计算覆盖率
        const providedAreas = extractProvidedFocusAreas(result.topics, validatedFocusAreas)
        const focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)
        
        // 分析覆盖质量
        const qualityAnalysis = analyzeCoverageQuality(focusCoverage, attempts)
        
        // 保存最佳结果
        if (!bestResult || focusCoverage.coverage > bestResult.coverage.coverage) {
          bestResult = { topics: result.topics, coverage: focusCoverage }
        }
        
        // 如果质量足够或不应继续，返回结果
        if (!qualityAnalysis.shouldContinue || attempts >= maxAttempts) {
          // 记录降级事件
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
        
        // 需要重试，生成改进的提示词
        currentPrompt = generateRetryPrompt(prompt, focusCoverage, attempts + 1)
        console.log(`Topics generation attempt ${attempts}: coverage ${focusCoverage.coverage}, retrying with improved prompt...`)
      } else {
        break // AI响应格式异常，退出重试循环
      }
    }

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('生成话题失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
} 