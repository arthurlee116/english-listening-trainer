import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'

export async function POST(request: NextRequest) {
  try {
    const { difficulty, wordCount } = await request.json()

    if (!difficulty || !wordCount) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const prompt = `你是一个英语听力推荐话题生成助手，现在用户处于这个水平：${difficulty}，需要一个这么长的听力稿：${wordCount}字，请你帮忙生成五个符合用户水平和字数长度的听力主题，应该是一个话题短语或者一句话。`

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