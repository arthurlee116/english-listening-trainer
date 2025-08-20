import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'
import { callArkAPI, ArkMessage } from '@/lib/ark-helper'

export async function POST(request: NextRequest) {
  try {
    const { invitationCode, wrongAnswerId } = await request.json()

    if (!invitationCode && !wrongAnswerId) {
      return NextResponse.json({ error: '需要提供邀请码或错题ID' }, { status: 400 })
    }

    let wrongAnswersToProcess: any[] = []

    // 如果提供了特定错题ID，处理单个错题
    if (wrongAnswerId) {
      const wrongAnswer = dbOperations.getWrongAnswerWithDetailedAnalysis(wrongAnswerId)
      if (wrongAnswer && wrongAnswer.detailed_analysis_status !== 'completed') {
        wrongAnswersToProcess = [wrongAnswer]
      }
    }
    // 否则批量处理该用户所有待分析的错题
    else if (invitationCode) {
      wrongAnswersToProcess = dbOperations.getWrongAnswersForDetailedAnalysis(invitationCode, 5)
    }

    if (wrongAnswersToProcess.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有需要生成详细分析的错题',
        processedCount: 0
      })
    }

    let processedCount = 0
    let successCount = 0

    console.log(`开始生成 ${wrongAnswersToProcess.length} 个错题的详细分析...`)

    for (const wrongAnswer of wrongAnswersToProcess) {
      try {
        // 标记为正在生成
        dbOperations.updateDetailedAnalysisStatus(wrongAnswer.id, 'generating')

        const prompt = `你是一个资深的英语听力学习专家和教学辅导员，拥有多年的TOEFL、IELTS、大学四六级等听力考试辅导经验。请为以下错题进行深度学习分析。

【错题详情】
题型：${wrongAnswer.question_data.type === 'single' ? '单选题' : '简答题'}
题目：${wrongAnswer.question_data.question}
${wrongAnswer.question_data.options ? `选项：${wrongAnswer.question_data.options.join(', ')}` : ''}
学生作答：${wrongAnswer.user_answer}
标准答案：${wrongAnswer.correct_answer}
听力原文：${wrongAnswer.transcript_snippet || ''}
话题领域：${wrongAnswer.topic}
难度等级：${wrongAnswer.difficulty}
已识别的错误类型：${wrongAnswer.tags.join(', ')}

请你运用专业的教学经验，从以下三个维度进行深入分析：

【1. 深度错误诊断 - 约120-150字】
不仅要指出错在哪里，更要挖掘深层原因：学生的思维过程可能是什么样的？哪一步开始偏离了正确轨道？是听音辨词的问题、语义理解的偏差、逻辑推理的盲区，还是应试策略的缺陷？这样的错误在不同能力阶段的学生中常见吗？背后反映了什么样的学习薄弱环节？

【2. 实用解题策略 - 约100-120字】
请你基于对这道题的深刻理解，创造性地提出既有普遍适用性又针对具体情况的答题方法。不要局限于常规建议，而要从听力认知过程、信息筛选技巧、时间分配策略、心理调节等多角度思考。如果你是在现场指导这个学生，你会用什么具体可操作的方法帮助他们避免类似错误？

【3. 关键信息可视化标注】
请从听力原文和题目中识别并标注以下关键元素，每个标注需要简洁有力的解释说明：
- 线索词：直击答案的核心提示
- 干扰项：设置的陷阱和误导信息
- 关键信息：决定性的事实和细节
- 转折否定词：改变语义走向的关键词
- 时间数字信息：具体的量化数据

请充分发挥你的专业判断力，不要拘泥于固定模式，而要针对这道具体题目的特点，给出最富有洞察力和实用价值的分析指导。`

        const schema = {
          type: 'object',
          properties: {
            extended_error_analysis: {
              type: 'string',
              description: '详细错误分析，100-150字，深入分析错误原因和学习建议'
            },
            solution_tips: {
              type: 'string', 
              description: '答题技巧，约100字，包含通用技巧和个性化建议'
            },
            highlighting_annotations: {
              type: 'object',
              properties: {
                transcript_highlights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: '高亮的文本内容' },
                      type: { 
                        type: 'string', 
                        enum: ['线索词', '干扰项', '关键信息', '转折否定词', '时间数字信息'],
                        description: '标注类型' 
                      },
                      explanation: { type: 'string', description: '标注说明' }
                    },
                    required: ['text', 'type', 'explanation'],
                    additionalProperties: false
                  }
                },
                question_highlights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: '高亮的文本内容' },
                      type: { 
                        type: 'string', 
                        enum: ['线索词', '干扰项', '关键信息', '转折否定词', '时间数字信息'],
                        description: '标注类型' 
                      },
                      explanation: { type: 'string', description: '标注说明' }
                    },
                    required: ['text', 'type', 'explanation'],
                    additionalProperties: false
                  }
                }
              },
              required: ['transcript_highlights', 'question_highlights'],
              additionalProperties: false
            }
          },
          required: ['extended_error_analysis', 'solution_tips', 'highlighting_annotations'],
          additionalProperties: false
        }

        const messages: ArkMessage[] = [{ role: 'user', content: prompt }]
        const result = await callArkAPI(messages, schema, 'detailed_analysis_response') as any

        if (result && result.extended_error_analysis && result.solution_tips && result.highlighting_annotations) {
          // 保存详细分析结果
          const saveSuccess = dbOperations.saveDetailedAnalysis(wrongAnswer.id, {
            extended_error_analysis: result.extended_error_analysis,
            solution_tips: result.solution_tips,
            highlighting_annotations: result.highlighting_annotations
          })

          if (saveSuccess) {
            successCount++
            console.log(`✅ 成功生成错题详细分析: ${wrongAnswer.topic} - 题目 ${wrongAnswer.question_index + 1}`)
          } else {
            console.error(`❌ 保存详细分析失败: ${wrongAnswer.id}`)
            dbOperations.updateDetailedAnalysisStatus(wrongAnswer.id, 'failed')
          }
        } else {
          console.error(`❌ AI返回格式异常: ${wrongAnswer.id}`)
          dbOperations.updateDetailedAnalysisStatus(wrongAnswer.id, 'failed')
        }

        processedCount++

      } catch (error) {
        console.error(`处理错题详细分析失败 ${wrongAnswer.id}:`, error)
        dbOperations.updateDetailedAnalysisStatus(wrongAnswer.id, 'failed')
        processedCount++
      }
    }

    console.log(`详细分析生成完成: 处理${processedCount}个错题，成功${successCount}个`)

    return NextResponse.json({
      success: true,
      message: '详细分析生成完成',
      processedCount,
      successCount,
      failedCount: processedCount - successCount
    })

  } catch (error) {
    console.error('生成详细分析失败:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}