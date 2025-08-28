import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'
import { v4 as uuidv4 } from 'uuid'
import type { Exercise } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { invitationCode, exercises } = await request.json()

    if (!invitationCode || !exercises || !Array.isArray(exercises)) {
      return NextResponse.json({ error: '参数缺失或格式错误' }, { status: 400 })
    }

    let processedCount = 0
    let wrongAnswersCount = 0
    let skippedCount = 0

    console.log(`开始处理 ${exercises.length} 条历史记录...`)

    for (const exercise of exercises) {
      try {
        // 检查这个练习是否已经有结果和答案
        if (!exercise.results || !exercise.answers || !exercise.questions) {
          skippedCount++
          continue
        }

        // 检查是否已经有错题标签（如果有就跳过重新处理）
        const hasErrorTags = exercise.results.some((result: any) => 
          result.error_tags && result.error_tags.length > 0
        )

        let resultsToProcess = exercise.results

        // 如果没有错题标签，需要重新批改生成标签
        if (!hasErrorTags) {
          console.log(`重新批改练习: ${exercise.topic}`)
          
          // 准备批改数据
          const questionsWithAnswers = exercise.questions.map((q: any, index: number) => ({
            question: q.question,
            type: q.type,
            options: q.options,
            correct_answer: q.answer,
            user_answer: exercise.answers[index] || '',
          }))

          // 调用AI重新批改并生成标签
          const prompt = `你是一个专业的英语听力批改助手。请根据听力材料和题目批改用户的答案。

听力材料：${exercise.transcript}

题目和答案：${JSON.stringify(questionsWithAnswers)}

批改要求：
1. 选择题：判断正确/错误，无需详细feedback
2. 简答题：专业批改，包括：
   - 生成简洁的英文参考答案（60-200个单词）
   - 给出1-10分的评分
   - 提供详细的中文批改意见
3. 错误分析标签：为每个错误答案生成2-4个标签，从以下标签库中选择：

错误类型标签：detail-missing(细节理解缺失), main-idea(主旨理解错误), inference(推理判断错误), vocabulary(词汇理解问题), number-confusion(数字混淆), time-confusion(时间理解错误), speaker-confusion(说话人混淆), negation-missed(否定词遗漏)

知识点标签：tense-error(时态理解), modal-verbs(情态动词), phrasal-verbs(短语动词), idioms(习语理解), pronoun-reference(代词指代), cause-effect(因果关系), sequence(顺序关系), comparison(比较关系)

场景标签：academic(学术场景), business(商务场景), daily-life(日常生活), travel(旅行场景), technology(科技话题), culture(文化话题)

难度标签：accent-difficulty(口音理解), speed-issue(语速问题), complex-sentence(复杂句型), technical-terms(专业术语)

请根据错误原因合理选择标签，帮助识别学习薄弱点。`

          const schema = {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['single', 'short'] },
                    user_answer: { type: 'string' },
                    correct_answer: { type: 'string' },
                    is_correct: { type: 'boolean' },
                    standard_answer: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    score: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                    short_feedback: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    error_tags: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '错误分析标签，仅在答案错误时提供'
                    },
                    error_analysis: { 
                      anyOf: [{ type: 'string' }, { type: 'null' }],
                      description: '错误分析说明，仅在答案错误时提供'
                    },
                  },
                  required: [
                    'type',
                    'user_answer',
                    'correct_answer',
                    'is_correct',
                    'standard_answer',
                    'score',
                    'short_feedback',
                    'error_tags',
                    'error_analysis'
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ['results'],
            additionalProperties: false,
          }

          const messages: ArkMessage[] = [{ role: 'user', content: prompt }]
          const result = await callArkAPI(messages, schema, 'grading_response') as any

          if (result && Array.isArray(result.results)) {
            resultsToProcess = result.results
            console.log(`✅ 重新批改完成，生成了 ${result.results.length} 个结果`)
          } else {
            console.log(`❌ 重新批改失败，使用原始结果`)
          }
        }

        // 收集错题
        const wrongAnswers: any[] = []
        resultsToProcess.forEach((result: any, index: number) => {
          if (!result.is_correct && result.error_tags && result.error_tags.length > 0) {
            const question = exercise.questions[index]
            
            // 提取相关的听力片段
            const transcript = exercise.transcript
            const transcriptSnippet = transcript.length > 100 
              ? transcript.substring(0, 200) + '...'
              : transcript

            const wrongAnswer = {
              id: uuidv4(),
              invitation_code: invitationCode,
              exercise_id: exercise.id,
              question_index: index,
              question_data: question,
              user_answer: result.user_answer,
              correct_answer: result.correct_answer,
              transcript_snippet: transcriptSnippet,
              topic: exercise.topic,
              difficulty: exercise.difficulty,
              language: exercise.language || 'en-US',
              tags: result.error_tags || [],
              error_analysis: result.error_analysis || null
            }

            wrongAnswers.push(wrongAnswer)
          }
        })

        // 保存错题到数据库
        for (const wrongAnswer of wrongAnswers) {
          if (await databaseAdapter.saveWrongAnswer(wrongAnswer)) {
            wrongAnswersCount++
          }
        }

        processedCount++
        console.log(`✅ 处理完成: ${exercise.topic}, 收集错题: ${wrongAnswers.length}`)

      } catch (error) {
        console.error(`处理练习失败 ${exercise.topic}:`, error)
        // 继续处理下一个，不中断整个流程
        skippedCount++
      }
    }

    console.log(`批量收集完成: 处理${processedCount}条，收集${wrongAnswersCount}个错题，跳过${skippedCount}条`)

    return NextResponse.json({
      success: true,
      message: '批量收集错题完成',
      processedCount,
      wrongAnswersCount,
      skippedCount
    })

  } catch (error) {
    console.error('批量收集错题失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}