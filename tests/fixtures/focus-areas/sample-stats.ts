import { FocusAreaStats, FocusArea, FOCUS_AREA_LIST, FOCUS_AREA_LABELS } from '../../../lib/types'

// Sample focus area statistics with various performance scenarios
export const SAMPLE_FOCUS_STATS: Record<string, FocusAreaStats> = {
  // Balanced performance across all areas
  balanced: {
    'main-idea': {
      attempts: 15,
      incorrect: 3,
      accuracy: 80,
      lastAttempt: '2024-01-20T10:30:00Z',
      trend: 'stable'
    },
    'detail-comprehension': {
      attempts: 20,
      incorrect: 4,
      accuracy: 80,
      lastAttempt: '2024-01-20T14:15:00Z',
      trend: 'improving'
    },
    'inference': {
      attempts: 12,
      incorrect: 2,
      accuracy: 83,
      lastAttempt: '2024-01-19T16:45:00Z',
      trend: 'stable'
    },
    'vocabulary': {
      attempts: 18,
      incorrect: 3,
      accuracy: 83,
      lastAttempt: '2024-01-20T09:00:00Z',
      trend: 'improving'
    },
    'cause-effect': {
      attempts: 10,
      incorrect: 2,
      accuracy: 80,
      lastAttempt: '2024-01-19T11:30:00Z',
      trend: 'stable'
    },
    'sequence': {
      attempts: 8,
      incorrect: 1,
      accuracy: 88,
      lastAttempt: '2024-01-18T15:20:00Z',
      trend: 'improving'
    },
    'speaker-attitude': {
      attempts: 14,
      incorrect: 4,
      accuracy: 71,
      lastAttempt: '2024-01-20T12:10:00Z',
      trend: 'declining'
    },
    'comparison': {
      attempts: 9,
      incorrect: 1,
      accuracy: 89,
      lastAttempt: '2024-01-19T13:45:00Z',
      trend: 'stable'
    },
    'number-information': {
      attempts: 16,
      incorrect: 2,
      accuracy: 88,
      lastAttempt: '2024-01-20T11:00:00Z',
      trend: 'improving'
    },
    'time-reference': {
      attempts: 13,
      incorrect: 3,
      accuracy: 77,
      lastAttempt: '2024-01-19T14:30:00Z',
      trend: 'stable'
    }
  },

  // Beginner with some weak areas
  beginnerWeakAreas: {
    'main-idea': {
      attempts: 8,
      incorrect: 1,
      accuracy: 88,
      lastAttempt: '2024-01-20T10:00:00Z',
      trend: 'improving'
    },
    'detail-comprehension': {
      attempts: 12,
      incorrect: 5,
      accuracy: 58,
      lastAttempt: '2024-01-20T11:30:00Z',
      trend: 'declining'
    },
    'inference': {
      attempts: 6,
      incorrect: 3,
      accuracy: 50,
      lastAttempt: '2024-01-19T15:00:00Z',
      trend: 'declining'
    },
    'vocabulary': {
      attempts: 10,
      incorrect: 2,
      accuracy: 80,
      lastAttempt: '2024-01-20T09:15:00Z',
      trend: 'stable'
    },
    'time-reference': {
      attempts: 7,
      incorrect: 4,
      accuracy: 43,
      lastAttempt: '2024-01-19T16:20:00Z',
      trend: 'declining'
    }
  },

  // Advanced user with high performance
  advancedHighPerformance: {
    'main-idea': {
      attempts: 25,
      incorrect: 1,
      accuracy: 96,
      lastAttempt: '2024-01-20T14:30:00Z',
      trend: 'stable'
    },
    'detail-comprehension': {
      attempts: 30,
      incorrect: 2,
      accuracy: 93,
      lastAttempt: '2024-01-20T15:45:00Z',
      trend: 'improving'
    },
    'inference': {
      attempts: 22,
      incorrect: 1,
      accuracy: 95,
      lastAttempt: '2024-01-20T13:20:00Z',
      trend: 'stable'
    },
    'vocabulary': {
      attempts: 28,
      incorrect: 2,
      accuracy: 93,
      lastAttempt: '2024-01-20T12:00:00Z',
      trend: 'improving'
    },
    'cause-effect': {
      attempts: 18,
      incorrect: 1,
      accuracy: 94,
      lastAttempt: '2024-01-19T17:10:00Z',
      trend: 'stable'
    },
    'sequence': {
      attempts: 15,
      incorrect: 0,
      accuracy: 100,
      lastAttempt: '2024-01-19T16:30:00Z',
      trend: 'improving'
    },
    'speaker-attitude': {
      attempts: 20,
      incorrect: 2,
      accuracy: 90,
      lastAttempt: '2024-01-20T10:45:00Z',
      trend: 'stable'
    },
    'comparison': {
      attempts: 16,
      incorrect: 1,
      accuracy: 94,
      lastAttempt: '2024-01-19T14:15:00Z',
      trend: 'improving'
    },
    'number-information': {
      attempts: 24,
      incorrect: 1,
      accuracy: 96,
      lastAttempt: '2024-01-20T11:20:00Z',
      trend: 'stable'
    },
    'time-reference': {
      attempts: 19,
      incorrect: 1,
      accuracy: 95,
      lastAttempt: '2024-01-19T15:50:00Z',
      trend: 'improving'
    }
  },

  // User with specific challenging areas
  specificChallenges: {
    'main-idea': {
      attempts: 20,
      incorrect: 2,
      accuracy: 90,
      lastAttempt: '2024-01-20T09:30:00Z',
      trend: 'stable'
    },
    'detail-comprehension': {
      attempts: 25,
      incorrect: 3,
      accuracy: 88,
      lastAttempt: '2024-01-20T10:45:00Z',
      trend: 'improving'
    },
    'inference': {
      attempts: 18,
      incorrect: 8,
      accuracy: 56,
      lastAttempt: '2024-01-20T12:15:00Z',
      trend: 'declining'
    },
    'vocabulary': {
      attempts: 22,
      incorrect: 2,
      accuracy: 91,
      lastAttempt: '2024-01-19T14:30:00Z',
      trend: 'stable'
    },
    'cause-effect': {
      attempts: 15,
      incorrect: 6,
      accuracy: 60,
      lastAttempt: '2024-01-19T16:00:00Z',
      trend: 'declining'
    },
    'speaker-attitude': {
      attempts: 17,
      incorrect: 7,
      accuracy: 59,
      lastAttempt: '2024-01-20T11:30:00Z',
      trend: 'declining'
    },
    'number-information': {
      attempts: 12,
      incorrect: 1,
      accuracy: 92,
      lastAttempt: '2024-01-19T13:45:00Z',
      trend: 'improving'
    }
  },

  // Empty stats for new user
  empty: {},

  // Minimal data for testing edge cases
  minimal: {
    'main-idea': {
      attempts: 1,
      incorrect: 0,
      accuracy: 100,
      lastAttempt: '2024-01-20T10:00:00Z',
      trend: 'stable'
    }
  }
}

// Sample recommended focus areas based on performance
export const SAMPLE_FOCUS_RECOMMENDATIONS: Record<string, FocusArea[]> = {
  // For balanced user - recommend areas with lower accuracy
  balanced: ['speaker-attitude', 'time-reference', 'main-idea'],

  // For beginner - recommend weakest areas
  beginnerWeakAreas: ['time-reference', 'inference', 'detail-comprehension'],

  // For advanced user - recommend areas for perfection
  advancedHighPerformance: ['speaker-attitude', 'detail-comprehension', 'vocabulary'],

  // For user with specific challenges
  specificChallenges: ['inference', 'speaker-attitude', 'cause-effect'],

  // Default recommendations for new users
  newUser: ['main-idea', 'detail-comprehension', 'vocabulary'],

  // Empty recommendations
  empty: []
}

// Sample focus area priority scores for recommendation algorithm testing
export const SAMPLE_FOCUS_PRIORITIES: Record<string, Record<FocusArea, number>> = {
  balanced: {
    'main-idea': 0.8,
    'detail-comprehension': 0.7,
    'inference': 0.6,
    'vocabulary': 0.6,
    'cause-effect': 0.8,
    'sequence': 0.4,
    'speaker-attitude': 0.9, // Highest priority due to declining trend
    'comparison': 0.3,
    'number-information': 0.4,
    'time-reference': 0.8
  },

  beginnerWeakAreas: {
    'main-idea': 0.2,
    'detail-comprehension': 0.9,
    'inference': 0.95, // Highest priority due to low accuracy
    'vocabulary': 0.3,
    'cause-effect': 0.5,
    'sequence': 0.5,
    'speaker-attitude': 0.5,
    'comparison': 0.5,
    'number-information': 0.5,
    'time-reference': 1.0 // Maximum priority due to very low accuracy
  }
}

// Arrays for easy access
export const ALL_FOCUS_STATS = Object.values(SAMPLE_FOCUS_STATS)
export const ALL_FOCUS_RECOMMENDATIONS = Object.values(SAMPLE_FOCUS_RECOMMENDATIONS).flat()

// Helper functions for creating mock focus area data
export function createMockFocusStats(overrides: Partial<FocusAreaStats> = {}): FocusAreaStats {
  const baseStats = SAMPLE_FOCUS_STATS.balanced
  return {
    ...baseStats,
    ...overrides
  }
}

export function createFocusAreaStat(
  focusArea: FocusArea,
  attempts: number = 10,
  accuracy: number = 80,
  trend: 'improving' | 'declining' | 'stable' = 'stable'
) {
  const incorrect = Math.round(attempts * (100 - accuracy) / 100)
  return {
    attempts,
    incorrect,
    accuracy,
    lastAttempt: new Date().toISOString(),
    trend
  }
}

// Helper to create focus stats with specific accuracy ranges
export function createFocusStatsWithAccuracyRange(
  minAccuracy: number = 50,
  maxAccuracy: number = 90,
  focusAreas: FocusArea[] = FOCUS_AREA_LIST
): FocusAreaStats {
  const stats: FocusAreaStats = {}
  
  focusAreas.forEach(area => {
    const accuracy = minAccuracy + Math.random() * (maxAccuracy - minAccuracy)
    const attempts = 5 + Math.floor(Math.random() * 20) // 5-25 attempts
    const trends: Array<'improving' | 'declining' | 'stable'> = ['improving', 'declining', 'stable']
    const trend = trends[Math.floor(Math.random() * trends.length)]
    
    stats[area] = createFocusAreaStat(area, attempts, Math.round(accuracy), trend)
  })
  
  return stats
}

// Helper to get focus areas that need improvement (accuracy < threshold)
export function getFocusAreasNeedingImprovement(
  stats: FocusAreaStats,
  accuracyThreshold: number = 70
): FocusArea[] {
  return Object.entries(stats)
    .filter(([_, stat]) => stat.accuracy < accuracyThreshold)
    .map(([area, _]) => area as FocusArea)
    .sort((a, b) => stats[a].accuracy - stats[b].accuracy) // Sort by accuracy (worst first)
}

// Helper to get focus areas with declining trends
export function getDecliningFocusAreas(stats: FocusAreaStats): FocusArea[] {
  return Object.entries(stats)
    .filter(([_, stat]) => stat.trend === 'declining')
    .map(([area, _]) => area as FocusArea)
}

// Helper to calculate overall performance metrics
export function calculateOverallFocusMetrics(stats: FocusAreaStats) {
  const areas = Object.keys(stats)
  if (areas.length === 0) {
    return {
      averageAccuracy: 0,
      totalAttempts: 0,
      totalIncorrect: 0,
      areasCount: 0,
      strongAreas: [],
      weakAreas: []
    }
  }

  const totalAttempts = Object.values(stats).reduce((sum, stat) => sum + stat.attempts, 0)
  const totalIncorrect = Object.values(stats).reduce((sum, stat) => sum + stat.incorrect, 0)
  const averageAccuracy = totalAttempts > 0 ? ((totalAttempts - totalIncorrect) / totalAttempts) * 100 : 0

  const strongAreas = areas.filter(area => stats[area].accuracy >= 85) as FocusArea[]
  const weakAreas = areas.filter(area => stats[area].accuracy < 70) as FocusArea[]

  return {
    averageAccuracy: Math.round(averageAccuracy),
    totalAttempts,
    totalIncorrect,
    areasCount: areas.length,
    strongAreas,
    weakAreas
  }
}