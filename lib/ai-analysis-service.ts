// Server-side AI Analysis Service for Wrong Answers
import 'server-only'
import type { ArkMessage } from './ark-helper'
import { invokeStructured } from './ai/cerebras-service'
import {
  analysisSchema,
  type AnalysisStructuredResponse,
  type AnalysisRelatedSentence
} from './ai/schemas'

// Types for AI Analysis
export interface AnalysisRequest {
  questionType: string
  question: string
  options?: string[]
  userAnswer: string
  correctAnswer: string
  transcript: string
  exerciseTopic: string
  exerciseDifficulty: string
  language: string
  attemptedAt: string
}

export type RelatedSentence = AnalysisRelatedSentence
export type AnalysisResponse = AnalysisStructuredResponse

/**
 * Create comprehensive Chinese analysis prompt for wrong answers
 */
function createAnalysisPrompt(request: AnalysisRequest): string {
  const {
    questionType,
    question,
    options,
    userAnswer,
    correctAnswer,
    transcript,
    exerciseTopic,
    exerciseDifficulty,
    language,
    attemptedAt
  } = request

  const optionsText = options ? `\n选项：\n${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')}` : ''
  
  return `你是一位专业的语言学习导师，专门分析学生在听力练习中的错误答案。请对以下错误回答进行深入分析，并提供详细的中文解释和改进建议。

## 练习信息
- 主题：${exerciseTopic}
- 难度：${exerciseDifficulty}
- 语言：${language}
- 答题时间：${attemptedAt}

## 听力材料
${transcript}

## 题目信息
- 题型：${questionType}
- 问题：${question}${optionsText}

## 答题情况
- 学生答案：${userAnswer}
- 正确答案：${correctAnswer}

## 分析要求

请提供以下结构化分析：

1. **详细分析 (analysis)**：
   - 至少150字的详尽中文解析
   - 分析学生为什么会选择错误答案
   - 解释正确答案的依据和逻辑
   - 指出学生在理解上的具体问题
   - 提供知识点解释和改进建议

2. **核心错误原因 (key_reason)**：
   - 用简洁的中文概括主要错误原因
   - 例如："细节理解缺失"、"推理判断错误"、"词汇理解偏差"、"语音识别困难"等

3. **能力标签 (ability_tags)**：
   - 标识此题考查的核心能力
   - 例如：["听力细节捕捉", "推理判断", "词汇理解", "语音辨析", "语境理解"]

4. **关键信号词 (signal_words)**：
   - 提取听力材料中与正确答案相关的关键词汇
   - 包括时间词、转折词、强调词等重要信号

5. **答题策略 (strategy)**：
   - 针对此类题型的具体作答技巧
   - 包括听力技巧、注意事项、常见陷阱提醒

6. **相关句子 (related_sentences)**：
   - 引用听力材料中与答案直接相关的句子
   - 每个引用包含原句和解释说明

7. **置信度 (confidence)**：
   - 评估分析结果的可靠性
   - high: 错误原因明确，分析依据充分
   - medium: 错误原因较清楚，但可能存在其他因素
   - low: 错误原因不够明确，需要更多信息

请确保分析内容准确、实用，能够真正帮助学生理解错误并改进听力技能。所有内容必须使用中文表达。`
}

/**
 * Analyze a wrong answer using AI
 */
export async function analyzeWrongAnswer(request: AnalysisRequest): Promise<AnalysisResponse> {
  const prompt = createAnalysisPrompt(request)
  
  const messages: ArkMessage[] = [
    {
      role: "system",
      content: "你是一位专业的语言学习导师，擅长分析学生的听力练习错误并提供详细的中文指导。请严格按照要求的JSON格式返回分析结果。"
    },
    {
      role: "user", 
      content: prompt
    }
  ]

  try {
    const result = await invokeStructured<AnalysisResponse>({
      messages,
      schema: analysisSchema,
      schemaName: 'wrong_answer_analysis',
      options: {
        maxRetries: 3
      }
    })

    if (!isValidAnalysisResponse(result)) {
      throw new Error('Invalid analysis response structure')
    }

    return result
  } catch (error) {
    console.error('AI analysis failed:', error)
    throw new Error(`AI分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * Validate analysis response structure
 */
function isValidAnalysisResponse(response: unknown): response is AnalysisResponse {
  if (!response || typeof response !== 'object') {
    return false
  }

  const r = response as Record<string, unknown>
  
  // Check required fields
  const requiredFields = [
    'analysis', 'key_reason', 'ability_tags', 
    'signal_words', 'strategy', 'related_sentences', 'confidence'
  ]
  
  for (const field of requiredFields) {
    if (!(field in r)) {
      return false
    }
  }

  // Validate types
  if (typeof r.analysis !== 'string' || r.analysis.length < 50) {
    return false
  }
  
  if (typeof r.key_reason !== 'string' || r.key_reason.length === 0) {
    return false
  }
  
  if (!Array.isArray(r.ability_tags) || !r.ability_tags.every(tag => typeof tag === 'string')) {
    return false
  }
  
  if (!Array.isArray(r.signal_words) || !r.signal_words.every(word => typeof word === 'string')) {
    return false
  }
  
  if (typeof r.strategy !== 'string' || r.strategy.length === 0) {
    return false
  }
  
  if (!Array.isArray(r.related_sentences)) {
    return false
  }
  
  // Validate related sentences structure
  for (const sentence of r.related_sentences) {
    if (!sentence || typeof sentence !== 'object') {
      return false
    }
    const s = sentence as Record<string, unknown>
    if (typeof s.quote !== 'string' || typeof s.comment !== 'string') {
      return false
    }
  }
  
  if (!['high', 'medium', 'low'].includes(r.confidence as string)) {
    return false
  }

  return true
}

/**
 * Batch analyze multiple wrong answers
 */
export async function batchAnalyzeWrongAnswers(
  requests: AnalysisRequest[]
): Promise<{
  success: AnalysisResponse[]
  failed: { index: number; error: string }[]
}> {
  const success: AnalysisResponse[] = []
  const failed: { index: number; error: string }[] = []

  // Process requests with concurrency limit
  const BATCH_SIZE = 5 // Process 5 at a time to avoid overwhelming the API
  
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map(async (request, batchIndex) => {
      const actualIndex = i + batchIndex
      try {
        const result = await analyzeWrongAnswer(request)
        return { success: true, result, index: actualIndex }
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : '未知错误',
          index: actualIndex 
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    
    for (const result of batchResults) {
      if (result.success) {
        success.push(result.result)
      } else {
        failed.push({ index: result.index, error: result.error })
      }
    }
  }

  return { success, failed }
}
