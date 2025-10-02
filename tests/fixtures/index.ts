// Comprehensive test fixtures index for easy importing

// Exercise and Practice Session Fixtures
export * from './exercises/sample-exercises'
export * from './exercises/practice-sessions'

// Achievement System Fixtures  
export * from './achievements/sample-achievements'

// Focus Area Statistics Fixtures
export * from './focus-areas/sample-stats'

// AI Service Response Fixtures
export * from './api-responses/ai-responses'

// Re-export commonly used types for convenience
export type {
  Exercise,
  PracticeSessionData,
  UserProgressMetrics,
  AchievementBadge,
  FocusAreaStats,
  AIAnalysisResponse,
  QuestionGenerationResponse
} from '../../lib/types'