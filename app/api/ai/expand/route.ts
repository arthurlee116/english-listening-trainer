import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
import { 
  countWords, 
  meetsLengthRequirement, 
  generateExpansionPrompt 
} from '@/lib/text-expansion'
import type { ListeningLanguage } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { text, targetWordCount, topic, difficulty, language = 'en-US', maxAttempts = 5, minAcceptablePercentage = 0.9 } = await request.json()

    if (!text || !targetWordCount || !topic || !difficulty) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    // 检查是否已经达到要求
    if (meetsLengthRequirement(text, targetWordCount, minAcceptablePercentage)) {
      return NextResponse.json({ 
        success: true, 
        expandedText: text,
        originalWordCount: countWords(text),
        finalWordCount: countWords(text),
        expansionAttempts: 0,
        meetsRequirement: true,
        message: `文本已达到长度要求（${Math.round(minAcceptablePercentage * 100)}%），无需扩写`
      })
    }

    let currentText = text
    let attempt = 0
    let finalWordCount = countWords(currentText)
    const originalWordCount = finalWordCount

    // 扩写循环
    while (attempt < maxAttempts && !meetsLengthRequirement(currentText, targetWordCount, minAcceptablePercentage)) {
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

      const schema = {
        type: 'object',
        properties: {
          expanded_text: { type: 'string' },
        },
        required: ['expanded_text'],
        additionalProperties: false,
      }

      try {
        const messages: ArkMessage[] = [{ role: 'user', content: prompt }]
        const result = await callArkAPI(messages, schema, 'expansion_response') as any

        if (result && typeof result.expanded_text === 'string') {
          currentText = result.expanded_text.trim()
          finalWordCount = countWords(currentText)
          
          console.log(`扩写尝试 ${attempt}: ${currentWordCount} -> ${finalWordCount} 词 (目标: ${targetWordCount})`)
        } else {
          console.error(`扩写尝试 ${attempt} 失败: AI响应格式异常`)
          // 如果AI响应异常，继续尝试下一次
          continue
        }
      } catch (error) {
        console.error(`扩写尝试 ${attempt} 失败:`, error)
        // 如果调用失败，继续尝试下一次
        continue
      }

      // 防止无限循环的安全检查
      if (finalWordCount >= targetWordCount * 1.5) {
        console.log(`扩写长度超过目标150%，停止扩写`)
        break
      }
    }

    // 检查最终结果
    const meetsRequirement = meetsLengthRequirement(currentText, targetWordCount, minAcceptablePercentage)
    const meetsBasicRequirement = meetsLengthRequirement(currentText, targetWordCount, 0.9)  // 检查是否达到90%基本要求
    
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