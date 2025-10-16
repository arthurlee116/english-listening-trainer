import type { FocusArea } from '../types'

export interface TopicsStructuredResponse {
  topics: string[]
}

export const topicsSchema = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['topics'],
  additionalProperties: false
} as const

export interface StructuredQuestion {
  type: 'single' | 'short'
  question: string
  options: string[] | null
  answer: string
  focus_areas: FocusArea[]
  explanation: string
}

export interface QuestionsStructuredResponse {
  questions: StructuredQuestion[]
}

export const questionsSchema = {
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
              { type: 'null' }
            ]
          },
          answer: { type: 'string' },
          focus_areas: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'main-idea',
                'detail-comprehension',
                'inference',
                'vocabulary',
                'cause-effect',
                'sequence',
                'speaker-attitude',
                'comparison',
                'number-information',
                'time-reference'
              ]
            }
          },
          explanation: { type: 'string' }
        },
        required: ['type', 'question', 'options', 'answer', 'focus_areas', 'explanation'],
        additionalProperties: false
      }
    }
  },
  required: ['questions'],
  additionalProperties: false
} as const

export interface TranscriptStructuredResponse {
  transcript: string
}

export const transcriptSchema = {
  type: 'object',
  properties: {
    transcript: { type: 'string' }
  },
  required: ['transcript'],
  additionalProperties: false
} as const

export interface GradingStructuredResult {
  type: 'single' | 'short'
  user_answer: string
  correct_answer: string
  is_correct: boolean
  standard_answer: string | null
  score: number | null
  short_feedback: string | null
  error_tags: string[]
  error_analysis: string | null
}

export interface GradingStructuredResponse {
  results: GradingStructuredResult[]
}

export const gradingSchema = {
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
          }
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
        additionalProperties: false
      }
    }
  },
  required: ['results'],
  additionalProperties: false
} as const

export interface ExpansionStructuredResponse {
  expanded_text: string
}

export const expansionSchema = {
  type: 'object',
  properties: {
    expanded_text: { type: 'string' }
  },
  required: ['expanded_text'],
  additionalProperties: false
} as const

export interface RelatedSentence {
  quote: string
  comment: string
}

export interface AnalysisStructuredResponse {
  analysis: string
  key_reason: string
  ability_tags: string[]
  signal_words: string[]
  strategy: string
  related_sentences: RelatedSentence[]
  confidence: 'high' | 'medium' | 'low'
}

export const analysisSchema = {
  type: 'object',
  properties: {
    analysis: {
      type: 'string',
      description: '详尽的中文解析，至少150字，包含错误原因分析、知识点解释和改进建议'
    },
    key_reason: {
      type: 'string',
      description: "简述主要错误原因，如'细节理解缺失'或'推理判断错误'"
    },
    ability_tags: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: '相关能力标签，如听力细节捕捉、推理判断、词汇理解等'
    },
    signal_words: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: '听力材料中的关键提示词和信号词'
    },
    strategy: {
      type: 'string',
      description: '针对该题型的作答策略和技巧建议'
    },
    related_sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: {
            type: 'string',
            description: '听力材料中的原句片段'
          },
          comment: {
            type: 'string',
            description: '该句与正确答案的关系说明'
          }
        },
        required: ['quote', 'comment'],
        additionalProperties: false
      },
      description: '相关句子引用和解释'
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: '分析结果的置信度'
    }
  },
  required: [
    'analysis',
    'key_reason',
    'ability_tags',
    'signal_words',
    'strategy',
    'related_sentences',
    'confidence'
  ],
  additionalProperties: false
} as const

export type {
  StructuredQuestion as QuestionsSchemaQuestion,
  RelatedSentence as AnalysisRelatedSentence
}

export interface HealthCheckStructuredResponse {
  status: string
}

export const healthCheckSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string'
    }
  },
  required: ['status'],
  additionalProperties: false
} as const
