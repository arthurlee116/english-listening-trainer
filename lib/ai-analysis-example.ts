// Example usage of AI Analysis Service
// This file demonstrates how to use the AI analysis prompt and schema

import type { AnalysisRequest, AnalysisResponse } from './ai-analysis-service'

/**
 * Example request for AI analysis
 */
export const exampleAnalysisRequest: AnalysisRequest = {
  questionType: 'single',
  question: 'What is the main topic of the conversation?',
  options: [
    'Travel plans',
    'Work schedule', 
    'Weather forecast',
    'Restaurant review'
  ],
  userAnswer: 'Weather forecast',
  correctAnswer: 'Travel plans',
  transcript: `A: Are you ready for our trip to Paris next week? I've been looking forward to this vacation for months!
B: Yes, I'm so excited! I've packed everything and booked the hotel near the Eiffel Tower. 
A: Perfect! I checked the weather forecast and it looks like it'll be sunny most of the week.
B: That's great news. We should definitely visit the Louvre on the first day.`,
  exerciseTopic: 'Travel and Tourism',
  exerciseDifficulty: 'B1',
  language: 'en-US',
  attemptedAt: '2024-01-15T10:30:00Z'
}

/**
 * Example expected response from AI analysis
 */
export const exampleAnalysisResponse: AnalysisResponse = {
  analysis: `学生选择了"天气预报"作为答案，但正确答案应该是"旅行计划"。从听力材料中可以清楚地听到两人在讨论下周去巴黎的旅行安排。对话开头A就直接提到"Are you ready for our trip to Paris next week?"，明确表明这是关于旅行计划的对话。虽然对话中确实提到了天气预报("I checked the weather forecast")，但这只是旅行准备中的一个细节，而不是对话的主要话题。学生可能是被"weather forecast"这个词汇误导，没有从整体把握对话的核心内容。建议在听力理解中要重点关注对话的开头和整体脉络，而不是被单个词汇分散注意力。主旨理解题需要从全局角度分析对话内容。`,
  key_reason: '被细节词汇误导，未能把握对话主旨',
  ability_tags: [
    '听力主旨理解',
    '对话分析',
    '关键信息提取',
    '抗干扰能力'
  ],
  signal_words: [
    'trip',
    'Paris', 
    'next week',
    'vacation',
    'packed',
    'booked',
    'hotel'
  ],
  strategy: '在听主旨理解题时，要先快速浏览选项，预测可能的话题方向。听音频时重点关注对话开头的关键信息，这通常包含主要话题。要从整体对话内容判断主题，避免被单个词汇或细节信息误导。可以在听的过程中快速记录关键词，帮助把握对话脉络。',
  related_sentences: [
    {
      quote: 'Are you ready for our trip to Paris next week?',
      comment: '这是对话的开头，直接点明了主题是关于巴黎旅行计划，而不是天气预报'
    },
    {
      quote: 'I\'ve packed everything and booked the hotel near the Eiffel Tower',
      comment: '这句话进一步确认了他们在讨论旅行的具体准备工作，包括打包和订酒店'
    },
    {
      quote: 'I checked the weather forecast and it looks like it\'ll be sunny',
      comment: '虽然提到了天气预报，但这只是旅行准备的一个环节，不是对话的主要内容'
    }
  ],
  confidence: 'high'
}

/**
 * Example for short answer question
 */
export const exampleShortAnswerRequest: AnalysisRequest = {
  questionType: 'short',
  question: 'What city are they planning to visit?',
  options: undefined, // No options for short answer
  userAnswer: 'London',
  correctAnswer: 'Paris',
  transcript: `A: Are you ready for our trip to Paris next week?
B: Yes, I've packed everything and booked the hotel near the Eiffel Tower.`,
  exerciseTopic: 'Travel and Tourism',
  exerciseDifficulty: 'A2',
  language: 'en-US',
  attemptedAt: '2024-01-15T10:35:00Z'
}

/**
 * Demonstrates the comprehensive prompt structure
 */
export function getPromptStructureExample(): string {
  return `
AI Analysis Prompt Structure:

1. 系统角色设定
   - 专业语言学习导师身份
   - 专门分析听力练习错误

2. 练习上下文信息
   - 主题、难度、语言
   - 答题时间

3. 听力材料完整内容
   - 原始transcript

4. 题目详细信息
   - 题型、问题、选项（如有）

5. 答题情况对比
   - 学生答案 vs 正确答案

6. 结构化分析要求
   - 详细分析（至少150字）
   - 核心错误原因
   - 能力标签
   - 关键信号词
   - 答题策略
   - 相关句子引用
   - 置信度评估

7. 输出格式要求
   - 严格JSON结构
   - 中文表达
   - 实用性导向
  `
}

/**
 * Schema validation example
 */
export const schemaValidationRules = {
  analysis: {
    minLength: 50,
    description: '详尽的中文解析，包含错误原因、知识点解释和改进建议'
  },
  key_reason: {
    required: true,
    description: '简述主要错误原因'
  },
  ability_tags: {
    type: 'array',
    itemType: 'string',
    examples: ['听力细节捕捉', '推理判断', '词汇理解']
  },
  signal_words: {
    type: 'array',
    itemType: 'string',
    description: '听力材料中的关键提示词'
  },
  strategy: {
    required: true,
    description: '针对题型的作答策略和技巧'
  },
  related_sentences: {
    type: 'array',
    itemStructure: {
      quote: 'string - 听力材料原句',
      comment: 'string - 与答案关系说明'
    }
  },
  confidence: {
    enum: ['high', 'medium', 'low'],
    description: '分析结果置信度'
  }
}