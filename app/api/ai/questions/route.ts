import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
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
    const { difficulty, transcript, duration, language = 'en-US' } = await request.json()

    if (!difficulty || !transcript) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const languageName = LANGUAGE_NAMES[language as ListeningLanguage] || 'English'

    // 计算建议题目数量
    const suggestedCount = duration ? (duration <= 120 ? Math.max(1, Math.floor(duration / 60)) : Math.min(10, Math.floor(duration / 60))) : 10
    const targetCount = Math.min(10, Math.max(8, suggestedCount))

    const prompt = `You are a professional listening comprehension question generator. Create comprehension questions based on the following ${languageName} listening material.

Listening Material:
${transcript}

Requirements:
1. Generate ${targetCount} questions total
2. Difficulty level: ${difficulty}
3. All questions and answer options must be in ${languageName}
4. Question type distribution:
   - First 9 questions: Multiple choice (single) with 4 options each
   - Last 1 question: Short answer (short) open-ended question
5. Multiple choice distribution:
   - First 2: Test main idea comprehension
   - Middle 4-6: Test detail comprehension  
   - Last 2-3: Test inference and analysis
6. Focus area tags:
   - Label each question with 2-3 accurate focus area tags
   - Available tags: main-idea, detail-comprehension, inference, vocabulary, cause-effect, sequence, speaker-attitude, comparison, number-information, time-reference
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

    const messages: ArkMessage[] = [{ role: 'user', content: prompt }]

    const result = await callArkAPI(messages, schema, 'questions_response') as any

    if (result && Array.isArray(result.questions)) {
      return NextResponse.json({ success: true, questions: result.questions })
    }

    return NextResponse.json({ error: 'AI响应格式异常' }, { status: 500 })
  } catch (error) {
    console.error('生成题目失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
} 