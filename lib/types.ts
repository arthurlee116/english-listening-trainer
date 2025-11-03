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

// 显式维护的能力标签运行时数组，避免对联合类型执行 Object.values
export const FOCUS_AREA_LIST: FocusArea[] = [
  'main-idea',
  'detail-comprehension',
  'inference',
  'vocabulary',
  'cause-effect',
  'sequence',
  'speaker-attitude',
  'comparison',
  'number-information',
  'time-reference',
]

// 能力标签映射，包含中英文标签和描述信息
export interface FocusAreaLabel {
  code: FocusArea
  nameEn: string
  nameZh: string
  description?: string
  category: 'comprehension' | 'analysis' | 'detail' | 'inference'
}

export const FOCUS_AREA_LABELS: Record<FocusArea, FocusAreaLabel> = {
  'main-idea': {
    code: 'main-idea',
    nameEn: 'Main Idea',
    nameZh: '主旨理解',
    description: 'Understanding the central theme or main point of the listening material',
    category: 'comprehension'
  },
  'detail-comprehension': {
    code: 'detail-comprehension',
    nameEn: 'Detail Comprehension',
    nameZh: '细节理解',
    description: 'Identifying specific facts, details, and explicit information',
    category: 'detail'
  },
  'inference': {
    code: 'inference',
    nameEn: 'Inference',
    nameZh: '推断能力',
    description: 'Drawing logical conclusions from implicit information',
    category: 'inference'
  },
  'vocabulary': {
    code: 'vocabulary',
    nameEn: 'Vocabulary',
    nameZh: '词汇理解',
    description: 'Understanding word meanings and context-specific usage',
    category: 'comprehension'
  },
  'cause-effect': {
    code: 'cause-effect',
    nameEn: 'Cause & Effect',
    nameZh: '因果关系',
    description: 'Identifying causal relationships and logical connections',
    category: 'analysis'
  },
  'sequence': {
    code: 'sequence',
    nameEn: 'Sequence',
    nameZh: '时序逻辑',
    description: 'Understanding chronological order and sequence of events',
    category: 'analysis'
  },
  'speaker-attitude': {
    code: 'speaker-attitude',
    nameEn: 'Speaker Attitude',
    nameZh: '说话者态度',
    description: 'Recognizing speaker\'s tone, opinion, and emotional stance',
    category: 'inference'
  },
  'comparison': {
    code: 'comparison',
    nameEn: 'Comparison',
    nameZh: '对比分析',
    description: 'Understanding similarities, differences, and comparative relationships',
    category: 'analysis'
  },
  'number-information': {
    code: 'number-information',
    nameEn: 'Number Information',
    nameZh: '数字信息',
    description: 'Processing numerical data, quantities, and statistical information',
    category: 'detail'
  },
  'time-reference': {
    code: 'time-reference',
    nameEn: 'Time Reference',
    nameZh: '时间信息',
    description: 'Understanding temporal references, dates, and time-related information',
    category: 'detail'
  }
}

// 标签覆盖率信息
export interface FocusCoverage {
  requested: FocusArea[]
  provided: FocusArea[]
  coverage: number // 0-1
  unmatchedTags: FocusArea[]
  partialMatches?: Array<{
    tag: FocusArea
    confidence: number
    reason?: string
  }>
}

// 专项统计数据
export interface FocusAreaStats {
  [key: string]: {
    attempts: number
    incorrect: number
    accuracy: number
    lastAttempt?: string
    trend: 'improving' | 'declining' | 'stable'
  }
}

// 专项练习配置
export interface SpecializedPracticeConfig {
  isEnabled: boolean
  selectedFocusAreas: FocusArea[]
  recommendedFocusAreas: FocusArea[]
  savedPresets: SpecializedPreset[]
}

// 专项模板预设
export interface SpecializedPreset {
  id: string
  name: string
  focusAreas: FocusArea[]
  difficulty: DifficultyLevel
  language: ListeningLanguage
  duration: number
  createdAt: string
}

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
  // 练习总时长（秒），用于成就系统与历史统计；如果缺失将使用回退逻辑估算
  totalDurationSec?: number
  // 专项练习模式字段
  focusAreas?: FocusArea[]
  focusCoverage?: FocusCoverage
  specializedMode?: boolean
  perFocusAccuracy?: Record<string, number>
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

// AI Analysis Types for Wrong Answers
export interface RelatedSentence {
  quote: string
  comment: string
}

export interface AIAnalysisResponse {
  analysis: string
  key_reason: string
  ability_tags: string[]
  signal_words: string[]
  strategy: string
  related_sentences: RelatedSentence[]
  confidence: 'high' | 'medium' | 'low'
}

export interface AIAnalysisRequest {
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

// AI生成响应扩展
export interface AIGenerationResponse {
  success: boolean
  focusCoverage?: FocusCoverage
  attempts?: number
  degradationReason?: string
}

// 题目生成响应
export interface QuestionGenerationResponse extends AIGenerationResponse {
  questions: Question[]
  focusMatch?: Array<{
    questionIndex: number
    matchedTags: FocusArea[]
    confidence: 'high' | 'medium' | 'low'
  }>
}

// 主题生成响应
export interface TopicGenerationResponse extends AIGenerationResponse {
  topics: string[]
}

// 转录生成响应
export interface TranscriptGenerationResponse extends AIGenerationResponse {
  transcript: string
}

// Wrong Answer Item interface for database-backed wrong answers
export interface WrongAnswerItem {
  answerId: string
  questionId: string
  sessionId: string
  session: {
    topic: string
    difficulty: string
    language: string
    createdAt: string
  }
  question: {
    index: number
    type: string
    question: string
    options?: string[]
    correctAnswer: string
    explanation?: string
    transcript: string
    focus_areas?: FocusArea[]
  }
  answer: {
    userAnswer: string
    isCorrect: boolean
    attemptedAt: string
    aiAnalysis?: AIAnalysisResponse
    aiAnalysisGeneratedAt?: string
    needsAnalysis: boolean
  }
}

// =============== Achievement System Types ===============

// User progress metrics for achievement calculation
export interface UserProgressMetrics {
  totalSessions: number              // 总练习次数
  totalCorrectAnswers: number        // 总正确答案数
  totalQuestions: number             // 总题目数
  averageAccuracy: number            // 平均准确率(%)，范围 0-100
  totalListeningMinutes: number      // 累计听力时长(分钟)
  currentStreakDays: number          // 当前连续练习天数
  longestStreakDays: number          // 最长连续练习天数
  lastPracticedAt: string | null     // 最后练习时间(ISO 8601)
  weeklyTrend: Array<{               // 最近7天练习趋势
    date: string                     // YYYY-MM-DD 格式
    sessions: number                 // 当日练习次数
  }>
}

// User goal settings
export interface UserGoalSettings {
  dailyMinutesTarget: number         // 每日目标听力时长(分钟)
  weeklySessionsTarget: number       // 每周目标练习次数
  lastUpdatedAt: string              // 目标最后更新时间(ISO 8601)
}

// Achievement badge definition
export interface AchievementBadge {
  id: string                         // 徽章唯一标识
  titleKey: string                   // 标题国际化键
  descriptionKey: string             // 描述国际化键
  earnedAt?: string                  // 获得时间(ISO 8601, 可选表示未获得)
  conditions: AchievementCondition   // 获得条件
}

// Achievement condition types
export type AchievementCondition = 
  | { type: 'sessions'; threshold: number }           // 练习次数条件
  | { type: 'accuracy'; threshold: number; minSessions: number }  // 准确率条件(需要最少练习次数)
  | { type: 'streak'; threshold: number }             // 连续天数条件
  | { type: 'minutes'; threshold: number }            // 累计时长条件

// Achievement notification data
export interface AchievementNotification {
  achievement: AchievementBadge
  isNew: boolean                     // 是否为新获得的成就
  timestamp: string                  // 通知时间戳
}

// Enhanced practice session data for achievement tracking
export interface PracticeSessionData {
  sessionId: string
  difficulty: DifficultyLevel
  language: ListeningLanguage
  topic: string
  accuracy: number                   // 0-100
  duration: number                   // 练习时长(秒)
  questionsCount: number             // 题目总数
  correctAnswersCount: number        // 正确答案数
  completedAt: string                // 完成时间(ISO 8601)
}

// Goal progress data
export interface GoalProgress {
  daily: {
    target: number                   // 目标值
    current: number                  // 当前进度
    isCompleted: boolean             // 是否已完成
    lastCompletedAt?: string         // 最后完成时间
  }
  weekly: {
    target: number
    current: number
    isCompleted: boolean
    lastCompletedAt?: string
  }
}

// =============== Challenge System Types ===============

export interface Challenge {
  id: string
  userId: string
  topic: string
  minDifficulty: DifficultyLevel
  maxDifficulty: DifficultyLevel
  targetSessionCount: number
  completedSessionCount: number
  status: 'active' | 'completed' | 'paused'
  lastSummaryAt?: string
  summaryText?: string
  createdAt: string
  updatedAt: string
}

export interface ChallengeProgressStats {
  completedSessions: number
  targetSessions: number
  completionPercentage: number
  averageAccuracy: number | null
  accuracyTrend: 'improving' | 'declining' | 'stable'
  totalDuration: number
  averageDuration: number | null
  lastSessionAt: Date | null
  difficultyDistribution: Record<string, number>
}

export interface ChallengeSession {
  id: string
  challengeId: string
  sessionId: string
  createdAt: string
}

export interface ChallengeWithStats extends Challenge {
  stats: ChallengeProgressStats
  sessions: Array<{
    id: string
    topic: string
    difficulty: DifficultyLevel
    accuracy: number | null
    score: number | null
    duration: number | null
    createdAt: string
    linkedAt: string
  }>
}

// Dashboard summary data
export interface DashboardSummary {
  progressMetrics: UserProgressMetrics
  goalProgress: GoalProgress
  recentAchievements: AchievementBadge[]  // 最近获得的成就
  availableAchievements: AchievementBadge[]  // 所有可获得的成就
}

// =============== Practice Notes ===============
export interface PracticeNotesEntry {
  exerciseId: string
  note: string
  updatedAt: string
}

// =============== Navigation System Types ===============

/**
 * Navigation action types
 */
export type NavigationActionType = "setState" | "callback" | "external"

/**
 * Navigation action for setState type
 */
export interface SetStateAction {
  type: "setState"
  targetState: string  // The step state to navigate to (e.g., "setup", "history", "assessment")
}

/**
 * Navigation action for callback type
 */
export interface CallbackAction {
  type: "callback"
  callbackName: string  // Name of the callback function to invoke (e.g., "handleLogout")
}

/**
 * Navigation action for external link type
 */
export interface ExternalAction {
  type: "external"
  href: string  // External URL or route path
  openInNewTab?: boolean  // Whether to open in a new tab
}

/**
 * Union type for all navigation actions
 */
export type NavigationAction = SetStateAction | CallbackAction | ExternalAction

/**
 * Navigation item definition
 */
export interface NavigationItem {
  id: string  // Unique identifier for the navigation item
  translationKey: string  // i18n key for the label (e.g., "navigation.assessment")
  icon: React.ComponentType<{ className?: string }>  // Lucide icon component
  action: NavigationAction  // Action to perform when clicked
  requiresAuth: boolean  // Whether the item requires authentication
  adminOnly: boolean  // Whether the item is only visible to admins
  badge?: string | number  // Optional badge to display (e.g., notification count)
}

/**
 * Navigation section definition
 */
export interface NavigationSection {
  id: string  // Unique identifier for the section
  labelKey: string  // i18n key for the section label
  items: NavigationItem[]  // Navigation items in this section
}
