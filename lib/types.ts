export interface Question {
  type: "single" | "short"
  question: string
  // AI 可能返回 null 表示简答题无选项
  options?: string[] | null
  answer: string
  // 题目考察的知识点标签
  focus_areas?: string[]
  // 题目描述和解释
  explanation?: string
}

export interface GradingResult {
  type: "single" | "short"
  user_answer: string
  correct_answer: string
  is_correct: boolean
  standard_answer?: string | null
  score?: number | null
  short_feedback?: string | null
  error_tags?: string[]
  error_analysis?: string | null
}

export interface Exercise {
  id: string
  difficulty: string
  topic: string
  transcript: string
  questions: Question[]
  answers: Record<number, string>
  results: GradingResult[]
  createdAt: string
}

export interface ErrorTag {
  tag_name: string
  tag_name_cn: string
  category: 'error-type' | 'knowledge' | 'context' | 'difficulty'
  description: string
  color: string
}

export interface WrongAnswer {
  id: string
  invitation_code: string
  exercise_id: string
  question_index: number
  question_data: Question
  user_answer: string
  correct_answer: string
  transcript_snippet?: string
  topic: string
  difficulty: string
  tags: string[]
  tagDetails?: ErrorTag[]
  error_analysis?: string
  // 新增的详细分析字段
  extended_error_analysis?: string
  solution_tips?: string
  highlighting_annotations?: {
    transcript_highlights: Array<{
      text: string
      type: '线索词' | '干扰项' | '关键信息' | '转折否定词' | '时间数字信息'
      explanation: string
    }>
    question_highlights: Array<{
      text: string
      type: '线索词' | '干扰项' | '关键信息' | '转折否定词' | '时间数字信息'
      explanation: string
    }>
  }
  detailed_analysis_status?: 'pending' | 'generating' | 'completed' | 'failed'
  created_at: string
}

export interface UserWeakness {
  tag_name: string
  tag_name_cn: string
  category: string
  color: string
  frequency: number
  last_occurrence: string
  improvement_rate: number
}

export interface TagStats {
  tag_name: string
  tag_name_cn: string
  category: string
  color: string
  count: number
  last_occurrence: string
}
