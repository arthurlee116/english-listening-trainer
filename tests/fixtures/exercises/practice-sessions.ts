import { PracticeSessionData, DifficultyLevel, ListeningLanguage, UserProgressMetrics, GoalProgress } from '../../../lib/types'

// Sample practice session data with various scenarios
export const SAMPLE_PRACTICE_SESSIONS: Record<string, PracticeSessionData> = {
  // High-performing session
  excellentSession: {
    sessionId: "session-excellent-001",
    difficulty: "B2" as DifficultyLevel,
    language: "en-US" as ListeningLanguage,
    topic: "Technology Innovation",
    accuracy: 95,
    duration: 420, // 7 minutes
    questionsCount: 5,
    correctAnswersCount: 5,
    completedAt: "2024-01-20T10:30:00Z"
  },

  // Average performance session
  averageSession: {
    sessionId: "session-average-002", 
    difficulty: "B1" as DifficultyLevel,
    language: "en-GB" as ListeningLanguage,
    topic: "Environmental Issues",
    accuracy: 70,
    duration: 360, // 6 minutes
    questionsCount: 4,
    correctAnswersCount: 3,
    completedAt: "2024-01-20T14:15:00Z"
  },

  // Challenging session with lower accuracy
  challengingSession: {
    sessionId: "session-challenging-003",
    difficulty: "C1" as DifficultyLevel,
    language: "en-US" as ListeningLanguage,
    topic: "Academic Research Methods",
    accuracy: 45,
    duration: 480, // 8 minutes
    questionsCount: 6,
    correctAnswersCount: 3,
    completedAt: "2024-01-20T16:45:00Z"
  },

  // Quick beginner session
  quickBeginnerSession: {
    sessionId: "session-beginner-004",
    difficulty: "A1" as DifficultyLevel,
    language: "es" as ListeningLanguage,
    topic: "Daily Conversations",
    accuracy: 85,
    duration: 180, // 3 minutes
    questionsCount: 3,
    correctAnswersCount: 3,
    completedAt: "2024-01-21T09:00:00Z"
  },

  // Long advanced session
  longAdvancedSession: {
    sessionId: "session-advanced-005",
    difficulty: "C2" as DifficultyLevel,
    language: "fr" as ListeningLanguage,
    topic: "Philosophy and Ethics",
    accuracy: 80,
    duration: 600, // 10 minutes
    questionsCount: 8,
    correctAnswersCount: 6,
    completedAt: "2024-01-21T11:30:00Z"
  },

  // Recent session for streak calculation
  recentSession: {
    sessionId: "session-recent-006",
    difficulty: "B1" as DifficultyLevel,
    language: "ja" as ListeningLanguage,
    topic: "Cultural Traditions",
    accuracy: 75,
    duration: 300, // 5 minutes
    questionsCount: 4,
    correctAnswersCount: 3,
    completedAt: new Date().toISOString() // Today's session
  }
}

// Sample user progress metrics for achievement testing
export const SAMPLE_USER_PROGRESS: Record<string, UserProgressMetrics> = {
  // New user with minimal progress
  newUser: {
    totalSessions: 2,
    totalCorrectAnswers: 6,
    totalQuestions: 8,
    averageAccuracy: 75,
    totalListeningMinutes: 12,
    currentStreakDays: 1,
    longestStreakDays: 1,
    lastPracticedAt: new Date().toISOString(),
    weeklyTrend: [
      { date: "2024-01-20", sessions: 1 },
      { date: "2024-01-21", sessions: 1 },
      { date: "2024-01-22", sessions: 0 },
      { date: "2024-01-23", sessions: 0 },
      { date: "2024-01-24", sessions: 0 },
      { date: "2024-01-25", sessions: 0 },
      { date: "2024-01-26", sessions: 0 }
    ]
  },

  // Experienced user with good progress
  experiencedUser: {
    totalSessions: 45,
    totalCorrectAnswers: 180,
    totalQuestions: 225,
    averageAccuracy: 80,
    totalListeningMinutes: 240,
    currentStreakDays: 7,
    longestStreakDays: 14,
    lastPracticedAt: new Date().toISOString(),
    weeklyTrend: [
      { date: "2024-01-20", sessions: 2 },
      { date: "2024-01-21", sessions: 1 },
      { date: "2024-01-22", sessions: 2 },
      { date: "2024-01-23", sessions: 1 },
      { date: "2024-01-24", sessions: 2 },
      { date: "2024-01-25", sessions: 1 },
      { date: "2024-01-26", sessions: 2 }
    ]
  },

  // High achiever user
  highAchiever: {
    totalSessions: 100,
    totalCorrectAnswers: 450,
    totalQuestions: 500,
    averageAccuracy: 90,
    totalListeningMinutes: 600,
    currentStreakDays: 21,
    longestStreakDays: 30,
    lastPracticedAt: new Date().toISOString(),
    weeklyTrend: [
      { date: "2024-01-20", sessions: 3 },
      { date: "2024-01-21", sessions: 2 },
      { date: "2024-01-22", sessions: 3 },
      { date: "2024-01-23", sessions: 2 },
      { date: "2024-01-24", sessions: 3 },
      { date: "2024-01-25", sessions: 2 },
      { date: "2024-01-26", sessions: 3 }
    ]
  },

  // User with broken streak
  brokenStreakUser: {
    totalSessions: 25,
    totalCorrectAnswers: 100,
    totalQuestions: 150,
    averageAccuracy: 67,
    totalListeningMinutes: 150,
    currentStreakDays: 0,
    longestStreakDays: 10,
    lastPracticedAt: "2024-01-18T10:00:00Z", // 3 days ago
    weeklyTrend: [
      { date: "2024-01-20", sessions: 0 },
      { date: "2024-01-21", sessions: 0 },
      { date: "2024-01-22", sessions: 0 },
      { date: "2024-01-23", sessions: 0 },
      { date: "2024-01-24", sessions: 0 },
      { date: "2024-01-25", sessions: 0 },
      { date: "2024-01-26", sessions: 0 }
    ]
  }
}

// Sample goal progress data
export const SAMPLE_GOAL_PROGRESS: Record<string, GoalProgress> = {
  // Goals on track
  onTrack: {
    daily: {
      target: 15, // 15 minutes per day
      current: 12,
      isCompleted: false
    },
    weekly: {
      target: 5, // 5 sessions per week
      current: 3,
      isCompleted: false
    }
  },

  // Daily goal completed
  dailyCompleted: {
    daily: {
      target: 10,
      current: 15,
      isCompleted: true,
      lastCompletedAt: new Date().toISOString()
    },
    weekly: {
      target: 7,
      current: 4,
      isCompleted: false
    }
  },

  // Both goals completed
  allCompleted: {
    daily: {
      target: 20,
      current: 25,
      isCompleted: true,
      lastCompletedAt: new Date().toISOString()
    },
    weekly: {
      target: 5,
      current: 6,
      isCompleted: true,
      lastCompletedAt: new Date().toISOString()
    }
  },

  // Behind on goals
  behindGoals: {
    daily: {
      target: 30,
      current: 5,
      isCompleted: false
    },
    weekly: {
      target: 10,
      current: 2,
      isCompleted: false
    }
  }
}

// Arrays for easy access
export const ALL_PRACTICE_SESSIONS = Object.values(SAMPLE_PRACTICE_SESSIONS)
export const ALL_USER_PROGRESS = Object.values(SAMPLE_USER_PROGRESS)
export const ALL_GOAL_PROGRESS = Object.values(SAMPLE_GOAL_PROGRESS)

// Helper functions for creating mock data
export function createMockPracticeSession(overrides: Partial<PracticeSessionData> = {}): PracticeSessionData {
  const baseSessions = SAMPLE_PRACTICE_SESSIONS.averageSession
  return {
    ...baseSessions,
    ...overrides,
    sessionId: overrides.sessionId || `mock-session-${Date.now()}`,
    completedAt: overrides.completedAt || new Date().toISOString()
  }
}

export function createMockUserProgress(overrides: Partial<UserProgressMetrics> = {}): UserProgressMetrics {
  const baseProgress = SAMPLE_USER_PROGRESS.experiencedUser
  return {
    ...baseProgress,
    ...overrides,
    lastPracticedAt: overrides.lastPracticedAt || new Date().toISOString()
  }
}

export function createMockGoalProgress(overrides: Partial<GoalProgress> = {}): GoalProgress {
  const baseGoals = SAMPLE_GOAL_PROGRESS.onTrack
  return {
    ...baseGoals,
    ...overrides
  }
}

// Helper to create a series of sessions for streak testing
export function createSessionSeries(count: number, startDate: Date = new Date()): PracticeSessionData[] {
  const sessions: PracticeSessionData[] = []
  
  for (let i = 0; i < count; i++) {
    const sessionDate = new Date(startDate)
    sessionDate.setDate(sessionDate.getDate() - i)
    
    sessions.push(createMockPracticeSession({
      sessionId: `series-session-${i}`,
      completedAt: sessionDate.toISOString(),
      accuracy: 70 + Math.random() * 20, // Random accuracy between 70-90%
      duration: 300 + Math.random() * 180 // Random duration between 5-8 minutes
    }))
  }
  
  return sessions.reverse() // Return in chronological order
}

// Helper to create weekly trend data
export function createWeeklyTrend(sessionsPerDay: number[]): Array<{date: string, sessions: number}> {
  const today = new Date()
  const trend = []
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD format
    
    trend.push({
      date: dateString,
      sessions: sessionsPerDay[6 - i] || 0
    })
  }
  
  return trend
}