import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
import type { ListeningLanguage } from '@/lib/types'
import { getLanguageConfig } from '@/lib/language-config'

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
    const { difficulty, wordCount, language = 'en-US' } = await request.json()

    if (!difficulty || !wordCount) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const languageName = LANGUAGE_NAMES[language as ListeningLanguage] || 'English'
    
    const prompt = `You are a listening comprehension topic generator. Generate 5 topics suitable for ${languageName} listening practice at ${difficulty} level with approximately ${wordCount} words. 

Requirements:
- All topics must be generated in ${languageName}
- Topics should be appropriate for ${difficulty} language level
- Each topic should be a phrase or short sentence
- Topics should be engaging and practical

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

    const messages: ArkMessage[] = [{ role: 'user', content: prompt }]

    const result = await callArkAPI(messages, schema, 'topics_response') as any

    if (result && Array.isArray(result.topics)) {
      return NextResponse.json({ success: true, topics: result.topics })
    }

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('生成话题失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
} 