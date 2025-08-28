// 题目类型枚举
export type QuestionType = "single" | "short"

// 难度级别枚举
export type DifficultyLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

// 听力语言类型
export type ListeningLanguage = 
  | "en-US"      // American English
  | "en-GB"      // British English  
  | "es"         // Spanish
  | "fr"         // French
  | "ja"         // Japanese
  | "it"         // Italian
  | "pt-BR"      // Portuguese (Brazil)
  | "hi"         // Hindi

// 语言配置接口
export interface LanguageConfig {
  code: string           // Kokoro TTS language code
  voice: string          // Default voice for this language
  displayName: string    // Display name in English
}

// 考察点标签类型
export type FocusArea = 
  | "main-idea" 
  | "detail-comprehension" 
  | "inference" 
  | "vocabulary" 
  | "cause-effect" 
  | "sequence" 
  | "speaker-attitude" 
  | "comparison" 
  | "number-information" 
  | "time-reference"

export interface Question {
  type: QuestionType
  question: string
  // AI 可能返回 null 表示简答题无选项
  options?: string[] | null
  answer: string
  // 题目考察的知识点标签
  focus_areas?: FocusArea[]
  // 题目描述和解释
  explanation?: string
}

export interface GradingResult {
  type: QuestionType
  user_answer: string
  correct_answer: string
  is_correct: boolean
  question_id?: number // 题目索引，用于恢复答案时识别
  standard_answer?: string | null
  score?: number | null // 1-10 分，仅简答题
  short_feedback?: string | null
  error_tags?: string[]
  error_analysis?: string | null
}

export interface Exercise {
  id: string
  difficulty: DifficultyLevel
  language: ListeningLanguage // 听力语言
  topic: string
  transcript: string
  questions: Question[]
  answers: Record<number, string>
  results: GradingResult[]
  createdAt: string // ISO 8601 格式
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
  userId: string
  exercise_id: string
  question_index: number
  question_data: Question
  user_answer: string
  correct_answer: string
  transcript_snippet?: string
  topic: string
  difficulty: DifficultyLevel
  language: ListeningLanguage // 听力语言
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

export type InvitationCodeState = 'unverified' | 'verifying' | 'verified' | 'invalid';

export interface UserAssessment {
  id: string;
  userId: string;
  level: DifficultyLevel;
  weaknesses: UserWeakness[];
  recommendations: string[];
  createdAt: string;
}

export interface AppError {
  message: string;
  code?: string | number;
}

export interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
  progress?: number;
}
