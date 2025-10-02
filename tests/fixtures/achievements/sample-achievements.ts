import { AchievementBadge, AchievementCondition, AchievementNotification, UserGoalSettings, DashboardSummary } from '../../../lib/types'
import { SAMPLE_USER_PROGRESS, SAMPLE_GOAL_PROGRESS } from '../exercises/practice-sessions'

// Predefined achievement definitions covering all achievement types
export const ACHIEVEMENT_DEFINITIONS: Record<string, AchievementBadge> = {
  // Session-based achievements
  firstSession: {
    id: "first-session",
    titleKey: "achievements.firstSession.title",
    descriptionKey: "achievements.firstSession.desc", 
    conditions: { type: "sessions", threshold: 1 }
  },

  tenSessions: {
    id: "ten-sessions",
    titleKey: "achievements.tenSessions.title",
    descriptionKey: "achievements.tenSessions.desc",
    conditions: { type: "sessions", threshold: 10 }
  },

  fiftySessions: {
    id: "fifty-sessions", 
    titleKey: "achievements.fiftySessions.title",
    descriptionKey: "achievements.fiftySessions.desc",
    conditions: { type: "sessions", threshold: 50 }
  },

  hundredSessions: {
    id: "hundred-sessions",
    titleKey: "achievements.hundredSessions.title", 
    descriptionKey: "achievements.hundredSessions.desc",
    conditions: { type: "sessions", threshold: 100 }
  },

  // Accuracy-based achievements
  goodAccuracy: {
    id: "good-accuracy",
    titleKey: "achievements.goodAccuracy.title",
    descriptionKey: "achievements.goodAccuracy.desc",
    conditions: { type: "accuracy", threshold: 80, minSessions: 5 }
  },

  excellentAccuracy: {
    id: "excellent-accuracy", 
    titleKey: "achievements.excellentAccuracy.title",
    descriptionKey: "achievements.excellentAccuracy.desc",
    conditions: { type: "accuracy", threshold: 90, minSessions: 10 }
  },

  perfectAccuracy: {
    id: "perfect-accuracy",
    titleKey: "achievements.perfectAccuracy.title",
    descriptionKey: "achievements.perfectAccuracy.desc", 
    conditions: { type: "accuracy", threshold: 95, minSessions: 20 }
  },

  // Streak-based achievements
  weekStreak: {
    id: "week-streak",
    titleKey: "achievements.weekStreak.title",
    descriptionKey: "achievements.weekStreak.desc",
    conditions: { type: "streak", threshold: 7 }
  },

  twoWeekStreak: {
    id: "two-week-streak",
    titleKey: "achievements.twoWeekStreak.title", 
    descriptionKey: "achievements.twoWeekStreak.desc",
    conditions: { type: "streak", threshold: 14 }
  },

  monthStreak: {
    id: "month-streak",
    titleKey: "achievements.monthStreak.title",
    descriptionKey: "achievements.monthStreak.desc",
    conditions: { type: "streak", threshold: 30 }
  },

  // Minutes-based achievements
  firstHour: {
    id: "first-hour",
    titleKey: "achievements.firstHour.title",
    descriptionKey: "achievements.firstHour.desc",
    conditions: { type: "minutes", threshold: 60 }
  },

  tenHours: {
    id: "ten-hours",
    titleKey: "achievements.tenHours.title",
    descriptionKey: "achievements.tenHours.desc", 
    conditions: { type: "minutes", threshold: 600 }
  },

  hundredHours: {
    id: "hundred-hours",
    titleKey: "achievements.hundredHours.title",
    descriptionKey: "achievements.hundredHours.desc",
    conditions: { type: "minutes", threshold: 6000 }
  }
}

// Sample earned achievements for different user scenarios
export const SAMPLE_EARNED_ACHIEVEMENTS: Record<string, AchievementBadge[]> = {
  // New user - only first session earned
  newUser: [
    {
      ...ACHIEVEMENT_DEFINITIONS.firstSession,
      earnedAt: "2024-01-20T10:30:00Z"
    }
  ],

  // Experienced user - multiple achievements
  experiencedUser: [
    {
      ...ACHIEVEMENT_DEFINITIONS.firstSession,
      earnedAt: "2024-01-01T10:00:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.tenSessions,
      earnedAt: "2024-01-05T15:30:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.firstHour,
      earnedAt: "2024-01-03T14:20:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.goodAccuracy,
      earnedAt: "2024-01-07T11:45:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.weekStreak,
      earnedAt: "2024-01-08T09:15:00Z"
    }
  ],

  // High achiever - many achievements including difficult ones
  highAchiever: [
    {
      ...ACHIEVEMENT_DEFINITIONS.firstSession,
      earnedAt: "2023-12-01T10:00:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.tenSessions,
      earnedAt: "2023-12-05T15:30:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.fiftySessions,
      earnedAt: "2023-12-20T12:00:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.hundredSessions,
      earnedAt: "2024-01-15T16:30:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.firstHour,
      earnedAt: "2023-12-03T14:20:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.tenHours,
      earnedAt: "2023-12-25T11:00:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.goodAccuracy,
      earnedAt: "2023-12-07T11:45:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.excellentAccuracy,
      earnedAt: "2023-12-15T13:20:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.weekStreak,
      earnedAt: "2023-12-08T09:15:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.twoWeekStreak,
      earnedAt: "2023-12-15T10:30:00Z"
    },
    {
      ...ACHIEVEMENT_DEFINITIONS.monthStreak,
      earnedAt: "2024-01-01T12:00:00Z"
    }
  ]
}

// Sample achievement notifications
export const SAMPLE_ACHIEVEMENT_NOTIFICATIONS: Record<string, AchievementNotification[]> = {
  // Single new achievement
  singleNew: [
    {
      achievement: {
        ...ACHIEVEMENT_DEFINITIONS.tenSessions,
        earnedAt: new Date().toISOString()
      },
      isNew: true,
      timestamp: new Date().toISOString()
    }
  ],

  // Multiple new achievements (rare but possible)
  multipleNew: [
    {
      achievement: {
        ...ACHIEVEMENT_DEFINITIONS.fiftySessions,
        earnedAt: new Date().toISOString()
      },
      isNew: true,
      timestamp: new Date().toISOString()
    },
    {
      achievement: {
        ...ACHIEVEMENT_DEFINITIONS.tenHours,
        earnedAt: new Date().toISOString()
      },
      isNew: true,
      timestamp: new Date().toISOString()
    }
  ],

  // Mix of new and existing achievements
  mixedNotifications: [
    {
      achievement: {
        ...ACHIEVEMENT_DEFINITIONS.excellentAccuracy,
        earnedAt: new Date().toISOString()
      },
      isNew: true,
      timestamp: new Date().toISOString()
    },
    {
      achievement: {
        ...ACHIEVEMENT_DEFINITIONS.weekStreak,
        earnedAt: "2024-01-15T10:00:00Z"
      },
      isNew: false,
      timestamp: "2024-01-15T10:00:00Z"
    }
  ]
}

// Sample user goal settings
export const SAMPLE_USER_GOALS: Record<string, UserGoalSettings> = {
  // Conservative goals
  conservative: {
    dailyMinutesTarget: 10,
    weeklySessionsTarget: 3,
    lastUpdatedAt: "2024-01-15T10:00:00Z"
  },

  // Moderate goals
  moderate: {
    dailyMinutesTarget: 20,
    weeklySessionsTarget: 5,
    lastUpdatedAt: "2024-01-10T14:30:00Z"
  },

  // Ambitious goals
  ambitious: {
    dailyMinutesTarget: 45,
    weeklySessionsTarget: 10,
    lastUpdatedAt: "2024-01-01T09:00:00Z"
  }
}

// Sample dashboard summary data
export const SAMPLE_DASHBOARD_SUMMARIES: Record<string, DashboardSummary> = {
  newUser: {
    progressMetrics: SAMPLE_USER_PROGRESS.newUser,
    goalProgress: SAMPLE_GOAL_PROGRESS.onTrack,
    recentAchievements: SAMPLE_EARNED_ACHIEVEMENTS.newUser,
    availableAchievements: Object.values(ACHIEVEMENT_DEFINITIONS)
  },

  experiencedUser: {
    progressMetrics: SAMPLE_USER_PROGRESS.experiencedUser,
    goalProgress: SAMPLE_GOAL_PROGRESS.dailyCompleted,
    recentAchievements: SAMPLE_EARNED_ACHIEVEMENTS.experiencedUser.slice(-3), // Last 3 achievements
    availableAchievements: Object.values(ACHIEVEMENT_DEFINITIONS)
  },

  highAchiever: {
    progressMetrics: SAMPLE_USER_PROGRESS.highAchiever,
    goalProgress: SAMPLE_GOAL_PROGRESS.allCompleted,
    recentAchievements: SAMPLE_EARNED_ACHIEVEMENTS.highAchiever.slice(-5), // Last 5 achievements
    availableAchievements: Object.values(ACHIEVEMENT_DEFINITIONS)
  }
}

// Arrays for easy access
export const ALL_ACHIEVEMENT_DEFINITIONS = Object.values(ACHIEVEMENT_DEFINITIONS)
export const ALL_EARNED_ACHIEVEMENTS = Object.values(SAMPLE_EARNED_ACHIEVEMENTS).flat()
export const ALL_USER_GOALS = Object.values(SAMPLE_USER_GOALS)

// Helper functions for creating mock achievement data
export function createMockAchievement(overrides: Partial<AchievementBadge> = {}): AchievementBadge {
  const baseAchievement = ACHIEVEMENT_DEFINITIONS.firstSession
  return {
    ...baseAchievement,
    ...overrides,
    id: overrides.id || `mock-achievement-${Date.now()}`
  }
}

export function createEarnedAchievement(achievementId: string, earnedAt?: string): AchievementBadge {
  const achievement = ACHIEVEMENT_DEFINITIONS[achievementId]
  if (!achievement) {
    throw new Error(`Achievement with id "${achievementId}" not found`)
  }
  
  return {
    ...achievement,
    earnedAt: earnedAt || new Date().toISOString()
  }
}

export function createMockNotification(achievement: AchievementBadge, isNew: boolean = true): AchievementNotification {
  return {
    achievement,
    isNew,
    timestamp: new Date().toISOString()
  }
}

export function createMockUserGoals(overrides: Partial<UserGoalSettings> = {}): UserGoalSettings {
  const baseGoals = SAMPLE_USER_GOALS.moderate
  return {
    ...baseGoals,
    ...overrides,
    lastUpdatedAt: overrides.lastUpdatedAt || new Date().toISOString()
  }
}

// Helper to check if achievement conditions are met
export function checkAchievementCondition(condition: AchievementCondition, metrics: any): boolean {
  switch (condition.type) {
    case 'sessions':
      return metrics.totalSessions >= condition.threshold
    case 'accuracy':
      return metrics.averageAccuracy >= condition.threshold && metrics.totalSessions >= condition.minSessions
    case 'streak':
      return metrics.currentStreakDays >= condition.threshold
    case 'minutes':
      return metrics.totalListeningMinutes >= condition.threshold
    default:
      return false
  }
}

// Helper to get achievements that should be earned based on progress
export function getEarnableAchievements(metrics: any): AchievementBadge[] {
  return ALL_ACHIEVEMENT_DEFINITIONS.filter(achievement => 
    checkAchievementCondition(achievement.conditions, metrics)
  )
}