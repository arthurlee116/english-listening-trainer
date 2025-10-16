import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import { countWords, meetsLengthRequirement } from '@/lib/text-expansion'
import type { ListeningLanguage, TranscriptGenerationResponse } from '@/lib/types'
import {
  validateFocusAreas,
  calculateFocusCoverage,
  generateFocusAreasPrompt,
  extractProvidedFocusAreas
} from '@/lib/focus-area-utils'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { transcriptSchema, type TranscriptStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'
import { getLanguageDisplayName } from '@/lib/language-config'

async function handleTranscript(request: NextRequest): Promise<NextResponse> {
  try {
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

    const validatedFocusAreas = validateFocusAreas(focusAreas)
    const languageName = getLanguageDisplayName(language as ListeningLanguage)

    let difficultyDescription = `at ${difficulty} level`
    if (difficultyLevel && typeof difficultyLevel === 'number') {
      const { getDifficultyPromptModifier } = await import('@/lib/difficulty-service')
      difficultyDescription = getDifficultyPromptModifier(difficultyLevel, language)
    }

    const focusAreasPrompt = generateFocusAreasPrompt(validatedFocusAreas, languageName)

    const basePrompt = `You are a professional listening comprehension script generator. Generate a ${languageName} listening script on the topic: "${topic}".

${difficultyDescription}${focusAreasPrompt}

Requirements:
- Target length: approximately ${wordCount} words
- Content must be entirely in ${languageName}
- Content should be coherent and natural
- Match the specified difficulty characteristics exactly
- Avoid redundancy and repetition
- Return only the script content, no additional explanations or punctuation
${validatedFocusAreas.length > 0 ? `- Content should provide opportunities to practice: ${validatedFocusAreas.join(', ')}` : ''}

Generate the listening script in ${languageName}.`

    let totalGenerationAttempts = 0
    const maxTotalAttempts = 3
    let bestTranscript = ''
    let bestWordCount = 0

    for (let attempt = 0; attempt < maxTotalAttempts; attempt += 1) {
      totalGenerationAttempts += 1
      console.log(`=== 第 ${totalGenerationAttempts} 次完整生成尝试 ===`)

      let transcript = ''
      let initialGenerationSuccess = false

      for (let genAttempt = 1; genAttempt <= 3; genAttempt += 1) {
        console.log(`生成尝试 ${genAttempt}: 目标 ${wordCount} 词`)

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
          const currentWordCount = countWords(transcript)
          console.log(`生成尝试 ${genAttempt} 结果: ${currentWordCount} 词`)

          if (meetsLengthRequirement(transcript, wordCount, 0.7)) {
            console.log(`初始生成已达到70%要求，可以进入扩写阶段: ${currentWordCount} 词`)
            initialGenerationSuccess = true
            break
          }
        } else {
          console.error(`AI响应格式异常，跳过第${genAttempt}次生成尝试`)
          continue
        }
      }

      if (!initialGenerationSuccess) {
        console.log(`第 ${totalGenerationAttempts} 次生成尝试失败，无法达到70%初始要求`)
        continue
      }

      console.log(`开始扩写，当前词数: ${countWords(transcript)} / ${wordCount}`)

      try {
        const baseUrl =
          request.nextUrl?.origin || `http://${request.headers.get('host') || 'localhost:3000'}`
        const expandResponse = await fetch(`${baseUrl}/api/ai/expand`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: transcript,
            targetWordCount: wordCount,
            topic,
            difficulty,
            language,
            maxAttempts: 5,
            minAcceptablePercentage: 0.95
          })
        })

        if (expandResponse.ok) {
          const expansionResult = await expandResponse.json()

          console.log(
            `扩写结果: ${expansionResult.originalWordCount} -> ${expansionResult.finalWordCount} 词`
          )

          if (expansionResult.meetsRequirement) {
            console.log(`✅ 第 ${totalGenerationAttempts} 次生成成功：达到95%要求`)

            const providedAreas = extractProvidedFocusAreas(
              expansionResult.expandedText,
              validatedFocusAreas
            )
            const focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)

            const response: TranscriptGenerationResponse = {
              success: true,
              transcript: expansionResult.expandedText,
              focusCoverage: validatedFocusAreas.length > 0 ? focusCoverage : undefined,
              attempts: totalGenerationAttempts
            }

            return NextResponse.json(response)
          }

          if (meetsLengthRequirement(expansionResult.expandedText, wordCount, 0.9)) {
            console.log(`⚠️ 第 ${totalGenerationAttempts} 次生成达到90%基本要求`)
            if (expansionResult.finalWordCount > bestWordCount) {
              bestTranscript = expansionResult.expandedText
              bestWordCount = expansionResult.finalWordCount
            }
          }
        } else {
          console.error(`扩写请求失败: ${expandResponse.status}`)
        }
      } catch (expansionError) {
        console.error('扩写失败:', expansionError)
      }
    }

    if (bestTranscript) {
      console.log(`📊 返回最佳结果：${bestWordCount} / ${wordCount} 词`)

      const providedAreas = extractProvidedFocusAreas(bestTranscript, validatedFocusAreas)
      const focusCoverage = calculateFocusCoverage(validatedFocusAreas, providedAreas)

      const response: TranscriptGenerationResponse = {
        success: true,
        transcript: bestTranscript,
        focusCoverage: validatedFocusAreas.length > 0 ? focusCoverage : undefined,
        attempts: totalGenerationAttempts,
        degradationReason: `经过${totalGenerationAttempts}次生成尝试，最佳结果：${bestWordCount} / ${wordCount} 词`
      }

      return NextResponse.json(response)
    }

    console.error(`❌ 所有生成尝试都失败`)
    return NextResponse.json(
      {
        error: `经过${totalGenerationAttempts}次生成尝试，无法生成符合要求的听力稿`
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('生成听力稿失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = createAiRoute(handleTranscript, {
  label: 'transcript',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
