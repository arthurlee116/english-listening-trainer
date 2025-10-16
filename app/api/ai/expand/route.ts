import { NextRequest, NextResponse } from 'next/server'
import type { ArkMessage } from '@/lib/ark-helper'
import {
  countWords,
  meetsLengthRequirement,
  generateExpansionPrompt
} from '@/lib/text-expansion'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import { expansionSchema, type ExpansionStructuredResponse } from '@/lib/ai/schemas'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'

async function handleExpansion(request: NextRequest): Promise<NextResponse> {
  try {
    const {
      text,
      targetWordCount,
      topic,
      difficulty,
      language = 'en-US',
      maxAttempts = 5,
      minAcceptablePercentage = 0.9
    } = await request.json()

    if (!text || !targetWordCount || !topic || !difficulty) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    if (meetsLengthRequirement(text, targetWordCount, minAcceptablePercentage)) {
      const wordCount = countWords(text)
      return NextResponse.json({
        success: true,
        expandedText: text,
        originalWordCount: wordCount,
        finalWordCount: wordCount,
        expansionAttempts: 0,
        meetsRequirement: true,
        message: `文本已达到长度要求（${Math.round(minAcceptablePercentage * 100)}%），无需扩写`
      })
    }

    let currentText = text
    let attempt = 0
    let finalWordCount = countWords(currentText)
    const originalWordCount = finalWordCount

    while (
      attempt < maxAttempts &&
      !meetsLengthRequirement(currentText, targetWordCount, minAcceptablePercentage)
    ) {
      attempt += 1

      const currentWordCount = countWords(currentText)
      const prompt = generateExpansionPrompt(
        currentText,
        currentWordCount,
        targetWordCount,
        topic,
        difficulty,
        minAcceptablePercentage,
        language
      )

      const messages: ArkMessage[] = [{ role: 'user', content: prompt }]

      try {
        const result = await invokeStructured<ExpansionStructuredResponse>({
          messages,
          schema: expansionSchema,
          schemaName: 'expansion_response',
          options: {
            temperature: 0.4,
            maxTokens: 2048
          }
        })

        if (result && typeof result.expanded_text === 'string') {
          currentText = result.expanded_text.trim()
          finalWordCount = countWords(currentText)
          console.log(
            `扩写尝试 ${attempt}: ${currentWordCount} -> ${finalWordCount} 词 (目标: ${targetWordCount})`
          )
        } else {
          console.error(`扩写尝试 ${attempt} 失败: AI响应格式异常`)
          continue
        }
      } catch (error) {
        console.error(`扩写尝试 ${attempt} 失败:`, error)
        continue
      }

      if (finalWordCount >= targetWordCount * 1.5) {
        console.log(`扩写长度超过目标150%，停止扩写`)
        break
      }
    }

    const meetsRequirement = meetsLengthRequirement(
      currentText,
      targetWordCount,
      minAcceptablePercentage
    )
    const meetsBasicRequirement = meetsLengthRequirement(currentText, targetWordCount, 0.9)

    return NextResponse.json({
      success: true,
      expandedText: currentText,
      originalWordCount,
      finalWordCount,
      targetWordCount,
      expansionAttempts: attempt,
      meetsRequirement,
      meetsBasicRequirement,
      minAcceptablePercentage,
      message: meetsRequirement
        ? `扩写成功：从 ${originalWordCount} 词扩写到 ${finalWordCount} 词（达到${Math.round(minAcceptablePercentage * 100)}%要求）`
        : `扩写未完全达到目标：从 ${originalWordCount} 词扩写到 ${finalWordCount} 词（目标：${targetWordCount} 词，要求：${Math.round(minAcceptablePercentage * 100)}%）`
    })
  } catch (error) {
    console.error('文本扩写失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = createAiRoute(handleExpansion, {
  label: 'expand',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
