import { NextRequest, NextResponse } from 'next/server'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'

export async function POST(request: NextRequest) {
  try {
    const { difficulty, transcript, duration } = await request.json()

    if (!difficulty || !transcript) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    // 计算建议题目数量
    const suggestedCount = duration ? (duration <= 120 ? Math.max(1, Math.floor(duration / 60)) : Math.min(10, Math.floor(duration / 60))) : 10
    const targetCount = Math.min(10, Math.max(8, suggestedCount))

    const prompt = `你是一个专业的英语听力题目生成专家。请根据以下听力材料生成理解题目。

听力材料：
${transcript}

生成要求：
1. 总共生成 ${targetCount} 道题目
2. 题目难度：${difficulty} 水平
3. 题目类型分布：
   - 前9道为选择题（single）：每题提供4个选项
   - 最后1道为简答题（short）：开放性回答题目
4. 选择题分布：
   - 前2道：测试主旨理解
   - 中间4-6道：测试细节理解
   - 最后2-3道：测试推理分析
5. 考察点标签：
   - 为每道题目标注2-3个准确的考察点标签
   - 可用标签：main-idea(主旨理解), detail-comprehension(细节理解), inference(推理判断), vocabulary(词汇理解), cause-effect(因果关系), sequence(顺序理解), speaker-attitude(说话人态度), comparison(比较分析), number-information(数字信息), time-reference(时间信息)
6. 题目解释：为每道题目提供简短的解释说明

请确保题目质量高，标签准确，能够有效测试听力理解能力。`

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