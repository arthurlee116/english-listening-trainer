import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
import { countWords, meetsLengthRequirement } from '@/lib/text-expansion'
import type { ListeningLanguage } from '@/lib/types'

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
    const { difficulty, wordCount, topic, language = 'en-US', difficultyLevel } = await request.json()

    if (!difficulty || !wordCount || !topic) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const languageName = LANGUAGE_NAMES[language as ListeningLanguage] || 'English'

    // 如果提供了数字难度等级，使用更精确的难度描述
    let difficultyDescription = `at ${difficulty} level`
    if (difficultyLevel && typeof difficultyLevel === 'number') {
      const { getDifficultyPromptModifier } = await import('@/lib/difficulty-service')
      difficultyDescription = getDifficultyPromptModifier(difficultyLevel, language)
    }

    // 生成初始听力稿
    const basePrompt = `You are a professional listening comprehension script generator. Generate a ${languageName} listening script on the topic: "${topic}".

${difficultyDescription}

Requirements:
- Target length: approximately ${wordCount} words
- Content must be entirely in ${languageName}
- Content should be coherent and natural
- Match the specified difficulty characteristics exactly
- Avoid redundancy and repetition
- Return only the script content, no additional explanations or punctuation

Generate the listening script in ${languageName}.`

    const schema = {
      type: 'object',
      properties: {
        transcript: { type: 'string' },
      },
      required: ['transcript'],
      additionalProperties: false,
    }

    let totalGenerationAttempts = 0
    const maxTotalAttempts = 3  // 最多3次完整生成循环
    let bestTranscript = ''
    let bestWordCount = 0
    let totalExpansionAttempts = 0

    // 主循环：最多3次完整生成尝试
    for (let attempt = 0; attempt < maxTotalAttempts; attempt++) {
      totalGenerationAttempts++
      console.log(`=== 第 ${totalGenerationAttempts} 次完整生成尝试 ===`)
      
      // 第一步：生成初始听力稿
      let transcript = ''
      let initialGenerationSuccess = false
      
      for (let genAttempt = 1; genAttempt <= 3; genAttempt++) {
        console.log(`生成尝试 ${genAttempt}: 目标 ${wordCount} 词`)

        const messages: ArkMessage[] = [{ role: 'user', content: basePrompt }]
        const result = await callArkAPI(messages, schema, 'transcript_response') as any

        if (result && typeof result.transcript === 'string') {
          transcript = result.transcript.trim()
          const currentWordCount = countWords(transcript)
          console.log(`生成尝试 ${genAttempt} 结果: ${currentWordCount} 词`)
          
          // 检查是否达到70%要求（允许进入扩写阶段）
          if (meetsLengthRequirement(transcript, wordCount, 0.7)) {
            console.log(`初始生成已达到70%要求，可以进入扩写阶段: ${currentWordCount} 词`)
            initialGenerationSuccess = true
            break
          }
        } else {
          // AI 响应异常，跳过这次生成尝试
          console.error(`AI响应格式异常，跳过第${genAttempt}次生成尝试`)
          continue
        }
      }

      if (!initialGenerationSuccess) {
        console.log(`第 ${totalGenerationAttempts} 次生成尝试失败，无法达到70%初始要求`)
        continue
      }

      // 第二步：如果达到70%就尝试扩写，目标是95%
      console.log(`开始扩写，当前词数: ${countWords(transcript)} / ${wordCount}`)
      
      try {
        // 构造与当前请求同源的基址，避免端口/主机不一致导致的CORS问题
        const baseUrl = request.nextUrl?.origin || `http://${request.headers.get('host') || 'localhost:3000'}`
        const expandResponse = await fetch(`${baseUrl}/api/ai/expand`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: transcript,
            targetWordCount: wordCount,
            topic,
            difficulty,
            language,
            maxAttempts: 5,
            minAcceptablePercentage: 0.95  // 要求达到95%才算成功
          }),
        })

        if (expandResponse.ok) {
          const expansionResult = await expandResponse.json()
          totalExpansionAttempts += expansionResult.expansionAttempts
          
          console.log(`扩写结果: ${expansionResult.originalWordCount} -> ${expansionResult.finalWordCount} 词`)
          
          if (expansionResult.meetsRequirement) {
            // 扩写成功且达到95%要求
            console.log(`✅ 第 ${totalGenerationAttempts} 次生成成功：达到95%要求`)
            return NextResponse.json({
              success: true,
              transcript: expansionResult.expandedText,
              wordCount: expansionResult.finalWordCount,
              generationAttempts: totalGenerationAttempts,
              expansionAttempts: totalExpansionAttempts,
              message: `生成成功：达到95%要求，${expansionResult.finalWordCount} / ${wordCount} 词`
            })
          } else {
            // 扩写后未达到95%，检查是否达到90%
            if (meetsLengthRequirement(expansionResult.expandedText, wordCount, 0.9)) {
              console.log(`⚠️ 第 ${totalGenerationAttempts} 次生成达到90%基本要求`)
              // 记录最佳结果
              if (expansionResult.finalWordCount > bestWordCount) {
                bestTranscript = expansionResult.expandedText
                bestWordCount = expansionResult.finalWordCount
              }
            }
          }
        } else {
          console.error(`扩写请求失败: ${expandResponse.status}`)
        }
      } catch (expansionError) {
        console.error('扩写失败:', expansionError)
      }
    }

    // 所有尝试都完成后，返回最佳结果
    if (bestTranscript) {
      console.log(`📊 返回最佳结果：${bestWordCount} / ${wordCount} 词`)
      return NextResponse.json({
        success: true,
        transcript: bestTranscript,
        wordCount: bestWordCount,
        generationAttempts: totalGenerationAttempts,
        expansionAttempts: totalExpansionAttempts,
        warning: `经过${totalGenerationAttempts}次生成尝试，最佳结果：${bestWordCount} / ${wordCount} 词`
      })
    } else {
      console.error(`❌ 所有生成尝试都失败`)
      return NextResponse.json({ 
        error: `经过${totalGenerationAttempts}次生成尝试，无法生成符合要求的听力稿` 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('生成听力稿失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
