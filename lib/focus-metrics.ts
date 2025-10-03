/**
 * Focus Area Metrics and Analysis Service
 * 
 * This module provides functions to analyze user performance across different
 * focus areas (listening skills) and generate intelligent recommendations
 * for specialized practice sessions.
 */

import { 
  FocusArea, 
  FocusAreaStats, 
  WrongAnswerItem, 
  FOCUS_AREA_LIST,
  Exercise  // Added Exercise import
} from './types'

/**
 * Interface for practice session data used in analysis
 */
export interface PracticeSession {
  id: string
  difficulty: string
  language: string
  topic: string
  accuracy?: number | null
  createdAt: string
  exerciseData: string | null
}

/**
 * Computes comprehensive statistics for each focus area based on wrong answers and practice sessions
 * 
 * @param wrongAnswers Array of wrong answer items from the database
 * @param sessions Array of practice sessions for calculating total attempts
 * @returns Object containing statistics for each focus area
 */
export function computeFocusStats(
  wrongAnswers: WrongAnswerItem[],
  sessions: PracticeSession[]
): FocusAreaStats {
  const stats: FocusAreaStats = {}
  
  // Initialize all focus areas with default stats
  FOCUS_AREA_LIST.forEach(area => {
    stats[area] = {
      attempts: 0,
      incorrect: 0,
      accuracy: 0,
      trend: 'stable'
    }
  })
  
  // Count incorrect answers by focus area
  wrongAnswers.forEach(item => {
    const focusAreas = item.question.focus_areas || []
    const attemptedAt = item.answer.attemptedAt
    
    // Safe conversion to timestamp for comparison, treating as unknown
    let attemptedAtTime: number = 0
    let attemptedAtDate: Date | null = null
    if (attemptedAt && typeof attemptedAt === 'object') {
      if ('getTime' in attemptedAt) {
        attemptedAtDate = attemptedAt as Date
        attemptedAtTime = attemptedAtDate.getTime()
      }
    } else if (typeof attemptedAt === 'string') {
      attemptedAtDate = new Date(attemptedAt)
      if (!isNaN(attemptedAtDate.getTime())) {
        attemptedAtTime = attemptedAtDate.getTime()
      }
    }
    
    focusAreas.forEach(area => {
      if (FOCUS_AREA_LIST.includes(area)) {
        stats[area].incorrect += 1
        
        // Update last attempt time if this is more recent
        const currentLastAttempt = stats[area].lastAttempt
        let currentLastTime: number = 0
        let currentLastDate: Date | null = null
        if (currentLastAttempt) {
          if (typeof currentLastAttempt === 'string') {
            currentLastDate = new Date(currentLastAttempt)
            if (!isNaN(currentLastDate.getTime())) {
              currentLastTime = currentLastDate.getTime()
            }
          } else if (typeof currentLastAttempt === 'number') {
            currentLastTime = currentLastAttempt
            currentLastDate = new Date(currentLastAttempt)
          }
        }
        if (attemptedAtTime > currentLastTime) {
          stats[area].lastAttempt = attemptedAtDate ? attemptedAtDate.toISOString() : new Date().toISOString()
        }
      }
    })
  })

  sessions.forEach(session => {
    const exerciseData: unknown = typeof session.exerciseData === 'string'
      ? JSON.parse(session.exerciseData)
      : session.exerciseData

    // Extract focus areas and question count from exercise data
    if (exerciseData && typeof exerciseData === 'object' && exerciseData !== null) {
      const exercise = exerciseData as Exercise
      if (Array.isArray(exercise.focusAreas)) {
        const questionCount = Array.isArray(exercise.questions)
          ? exercise.questions.length
          : 0
        
        exercise.focusAreas.forEach((area: FocusArea) => {
          if (FOCUS_AREA_LIST.includes(area)) {
            stats[area].attempts += questionCount
          }
        })
      }
    }
  })
  
  // Calculate accuracy and trends for each focus area
  Object.keys(stats).forEach(area => {
    const stat = stats[area]
    
    if (stat.attempts > 0) {
      // Calculate accuracy as percentage (rounded to 1 decimal place)
      stat.accuracy = Math.round(((stat.attempts - stat.incorrect) / stat.attempts) * 100 * 10) / 10
      
      // Calculate trend based on recent performance
      stat.trend = calculateTrend(area as FocusArea, sessions, wrongAnswers)
    }
  })
  
  return stats
}

/**
 * Selects recommended focus areas for specialized practice based on performance analysis
 * 
 * @param stats Focus area statistics computed by computeFocusStats
 * @param maxRecommendations Maximum number of recommendations to return (default: 3)
 * @returns Array of recommended focus areas sorted by priority
 */
export function selectRecommendedFocusAreas(
  stats: FocusAreaStats,
  maxRecommendations: number = 3
): FocusArea[] {
  // Filter areas with sufficient data and calculate priority scores
  const candidates = Object.entries(stats)
    .filter(([_, stat]) => stat.attempts >= 3) // Require at least 3 attempts for reliable data
    .map(([area, stat]) => ({
      area: area as FocusArea,
      priority: calculatePriority(stat)
    }))
    .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)
    .slice(0, maxRecommendations)
  
  return candidates.map(c => c.area)
}

/**
 * Calculates priority score for a focus area based on multiple factors
 * 
 * @param stat Statistics for a single focus area
 * @returns Priority score (higher = more recommended)
 */
function calculatePriority(stat: FocusAreaStats[string]): number {
  let priority = 0
  
  // Error rate weight (40%) - higher error rate = higher priority
  const errorRate = stat.attempts > 0 ? stat.incorrect / stat.attempts : 0
  priority += errorRate * 40
  
  // Recency weight (30%) - more recent errors = higher priority
  if (
    stat.lastAttempt &&
    typeof stat.lastAttempt === 'string' &&
    typeof Date.now === 'function'
  ) {
    const lastAttemptDate = new Date(stat.lastAttempt)
    const currentTime = new Date()
    const daysSinceLastAttempt = (currentTime.getTime() - lastAttemptDate.getTime()) / (1000 * 60 * 60 * 24)
    const recencyScore = Math.max(0, 1 - daysSinceLastAttempt / 30) // Weight decreases over 30 days
    priority += recencyScore * 30
  }
  
  // Trend weight (20%) - declining performance = higher priority
  const trendScore = stat.trend === 'declining' ? 1 : stat.trend === 'stable' ? 0.5 : 0
  priority += trendScore * 20
  
  // Attempt count weight (10%) - more attempts = more reliable data
  const attemptScore = Math.min(1, stat.attempts / 10) // Cap at 10 attempts for full weight
  priority += attemptScore * 10
  
  return priority
}

/**
 * Calculates performance trend for a focus area based on recent sessions
 * 
 * @param area Focus area to analyze
 * @param sessions All practice sessions
 * @param wrongAnswers All wrong answers
 * @returns Trend indicator: 'improving', 'declining', or 'stable'
 */
function calculateTrend(
  area: FocusArea,
  sessions: PracticeSession[],
  wrongAnswers: WrongAnswerItem[]
): 'improving' | 'declining' | 'stable' {
  // Get sessions from the last 30 days that include this focus area
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentSessions = sessions
    .filter(session => {
      const sessionDate = new Date(session.createdAt)
      return sessionDate.getTime() >= thirtyDaysAgo.getTime()
    })
    .filter(session => {
      try {
        const exerciseData = typeof session.exerciseData === 'string' 
          ? JSON.parse(session.exerciseData) 
          : session.exerciseData
        if (exerciseData && typeof exerciseData === 'object' && 'focusAreas' in exerciseData) {
          return (exerciseData as { focusAreas?: FocusArea[] }).focusAreas?.includes(area) || false
        }
        return false
      } catch {
        return false
      }
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return aTime - bTime
    })
    
  if (recentSessions.length < 2) {
    return 'stable' // Not enough data to determine trend
  }
  
  // Calculate accuracy for first half vs second half of recent sessions
  const midpoint = Math.floor(recentSessions.length / 2)
  const earlierSessions = recentSessions.slice(0, midpoint)
  const laterSessions = recentSessions.slice(midpoint)
  
  const earlierAccuracy = calculateAverageAccuracy(earlierSessions, area, wrongAnswers)
  const laterAccuracy = calculateAverageAccuracy(laterSessions, area, wrongAnswers)
  
  const improvementThreshold = 5 // 5% improvement threshold
  
  if (laterAccuracy - earlierAccuracy > improvementThreshold) {
    return 'improving'
  } else if (earlierAccuracy - laterAccuracy > improvementThreshold) {
    return 'declining'
  } else {
    return 'stable'
  }
}

/**
 * Calculates average accuracy for a focus area across given sessions
 * 
 * @param sessions Sessions to analyze
 * @param area Focus area to calculate accuracy for
 * @param wrongAnswers All wrong answers for context
 * @returns Average accuracy percentage
 */
function calculateAverageAccuracy(
  sessions: PracticeSession[],
  area: FocusArea,
  wrongAnswers: WrongAnswerItem[]
): number {
  let totalQuestions = 0
  let totalCorrect = 0
  
  sessions.forEach(session => {
    const exerciseData: unknown = typeof session.exerciseData === 'string'
      ? JSON.parse(session.exerciseData)
      : session.exerciseData

    // Extract focus areas and question count from exercise data
    if (exerciseData && typeof exerciseData === 'object' && exerciseData !== null) {
      const exercise = exerciseData as Exercise
      if (Array.isArray(exercise.focusAreas) && exercise.focusAreas.includes(area) && Array.isArray(exercise.questions)) {
        const questionsInArea = exercise.questions.filter((q: unknown): boolean => {
          if (
            q && 
            typeof q === 'object' && 
            'focus_areas' in q && 
            Array.isArray((q as Record<string, unknown>)['focus_areas'])
          ) {
            const focusAreas = (q as Record<string, unknown>)['focus_areas'] as unknown[]
            return focusAreas.some((fa: unknown) => fa === area)
          }
          return false
        }).length
          
        if (questionsInArea > 0) {
          totalQuestions += questionsInArea
          
          // Count correct answers (total questions minus wrong answers for this session/area)
          const wrongInSession = wrongAnswers.filter(wa => 
            wa.sessionId === session.id && 
            Array.isArray(wa.question.focus_areas) && 
            wa.question.focus_areas.includes(area)
          ).length
          
          totalCorrect += Math.max(0, questionsInArea - wrongInSession)
        }
      }
    }
  })
  
  return totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
}

/**
 * Gets default statistics for focus areas when no data is available
 * 
 * @returns Default focus area statistics
 */
export function getDefaultStats(): FocusAreaStats {
  const stats: FocusAreaStats = {}
  
  FOCUS_AREA_LIST.forEach(area => {
    stats[area] = {
      attempts: 0,
      incorrect: 0,
      accuracy: 0,
      trend: 'stable'
    }
  })
  
  return stats
}

/**
 * Gets default recommended focus areas for new users
 * 
 * @returns Array of default recommended focus areas
 */
export function getDefaultRecommendations(): FocusArea[] {
  return ['main-idea', 'detail-comprehension']
}