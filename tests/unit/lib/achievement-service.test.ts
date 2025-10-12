import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { mockStorage } from '../../helpers/storage-mock'
import { createMockExercise, createMockProgressMetrics, createMockGoalSettings } from '../../helpers/mock-utils'
import {
  updateProgressMetrics,
  checkNewAchievements,
  handlePracticeCompleted,
  initializeAchievements,
  getEarnedAchievements,
  getAvailableAchievements,
  calculateGoalProgress,
  migrateFromHistory
} from '../../../lib/achievement-service'
import { convertExerciseToSessionData } from '../../../lib/storage'
import type { UserProgressMetrics, AchievementBadge, Exercise } from '../../../lib/types'
import type { TranslationKey } from '@/lib/i18n/types'
import { useBilingualText, clearTranslationCache } from '@/hooks/use-bilingual-text'
import achievementsTranslations from '@/lib/i18n/translations/achievements.json'

const achievementsJson = achievementsTranslations as Record<string, unknown>
const achievementsJsonSection = (achievementsJson['achievements'] as Record<string, unknown>) || {}

const resolveAchievementTranslationFromJson = (key: string): TranslationKey | null => {
  const walkPath = (base: Record<string, unknown>, path: string[]): unknown => {
    return path.reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[segment]
      }
      return undefined
    }, base)
  }

  const directResult = walkPath(achievementsJson, key.split('.'))
  if (directResult && typeof directResult === 'object' && 'en' in directResult && 'zh' in directResult) {
    return directResult as TranslationKey
  }

  if (key.startsWith('achievements.')) {
    const remainder = key.substring(13)
    const base = remainder.startsWith('notifications.') || remainder.startsWith('dashboard.')
      ? achievementsJson
      : achievementsJsonSection
    const fallbackResult = walkPath(base, remainder.split('.'))

    if (fallbackResult && typeof fallbackResult === 'object' && 'en' in fallbackResult && 'zh' in fallbackResult) {
      return fallbackResult as TranslationKey
    }
  }

  return null
}

describe('Achievement Service', () => {
  beforeEach(() => {
    mockStorage()
    vi.clearAllMocks()
    clearTranslationCache()
  })

  describe('updateProgressMetrics', () => {
    it('should update progress metrics correctly', () => {
      const sessionData = {
        sessionId: 'test-session',
        difficulty: 'B1' as const,
        language: 'en-US' as const,
        topic: 'Technology',
        accuracy: 80,
        duration: 180,
        questionsCount: 5,
        correctAnswersCount: 4,
        completedAt: new Date().toISOString()
      }

      const updatedMetrics = updateProgressMetrics(sessionData)

      expect(updatedMetrics.totalSessions).toBe(1)
      expect(updatedMetrics.totalCorrectAnswers).toBe(4)
      expect(updatedMetrics.totalQuestions).toBe(5)
      expect(updatedMetrics.averageAccuracy).toBe(80)
      expect(updatedMetrics.totalListeningMinutes).toBe(3) // 180 seconds = 3 minutes
      expect(updatedMetrics.lastPracticedAt).toBe(sessionData.completedAt)
    })

    it('should accumulate session data correctly', () => {
      // First session
      const session1 = {
        sessionId: 'session-1',
        difficulty: 'B1' as const,
        language: 'en-US' as const,
        topic: 'Technology',
        accuracy: 80,
        duration: 120,
        questionsCount: 4,
        correctAnswersCount: 3,
        completedAt: new Date().toISOString()
      }

      const metrics1 = updateProgressMetrics(session1)

      // Second session
      const session2 = {
        sessionId: 'session-2',
        difficulty: 'B2' as const,
        language: 'en-US' as const,
        topic: 'Business',
        accuracy: 90,
        duration: 180,
        questionsCount: 6,
        correctAnswersCount: 5,
        completedAt: new Date().toISOString()
      }

      const metrics2 = updateProgressMetrics(session2)

      expect(metrics2.totalSessions).toBe(2)
      expect(metrics2.totalCorrectAnswers).toBe(8) // 3 + 5
      expect(metrics2.totalQuestions).toBe(10) // 4 + 6
      expect(metrics2.averageAccuracy).toBe(80) // 8/10 * 100
      expect(metrics2.totalListeningMinutes).toBe(5) // 2 + 3 minutes
    })

    it('should calculate streaks correctly', () => {
      const today = new Date()
      const sessionData = {
        sessionId: 'test-session',
        difficulty: 'B1' as const,
        language: 'en-US' as const,
        topic: 'Technology',
        accuracy: 80,
        duration: 180,
        questionsCount: 5,
        correctAnswersCount: 4,
        completedAt: today.toISOString()
      }

      const updatedMetrics = updateProgressMetrics(sessionData)

      expect(updatedMetrics.currentStreakDays).toBeGreaterThanOrEqual(1)
      expect(updatedMetrics.longestStreakDays).toBeGreaterThanOrEqual(1)
    })
  })

  describe('checkNewAchievements', () => {
    beforeEach(() => {
      // Initialize achievements
      initializeAchievements()
    })

    it('should detect newly earned achievements', () => {
      const metrics = createMockProgressMetrics({
        totalSessions: 1,
        averageAccuracy: 95,
        currentStreakDays: 3,
        totalListeningMinutes: 100
      })

      const newAchievements = checkNewAchievements(metrics)

      // Should earn first-session achievement
      const firstSessionAchievement = newAchievements.find(a => a.achievement.id === 'first-session')
      expect(firstSessionAchievement).toBeDefined()
      expect(firstSessionAchievement?.isNew).toBe(true)
    })

    it('should not duplicate already earned achievements', () => {
      const metrics = createMockProgressMetrics({
        totalSessions: 1
      })

      // First check - should earn achievement(s)
      const firstCheck = checkNewAchievements(metrics)
      expect(firstCheck.length).toBeGreaterThan(0)

      // Second check with same metrics - should not earn again
      const secondCheck = checkNewAchievements(metrics)
      expect(secondCheck).toHaveLength(0)
    })

    it('should check accuracy achievement with minimum sessions requirement', () => {
      const metrics = createMockProgressMetrics({
        totalSessions: 5,
        averageAccuracy: 95
      })

      const newAchievements = checkNewAchievements(metrics)

      const accuracyAchievement = newAchievements.find(a => a.achievement.id === 'accuracy-master')
      expect(accuracyAchievement).toBeDefined()
    })

    it('should not award accuracy achievement without minimum sessions', () => {
      const metrics = createMockProgressMetrics({
        totalSessions: 2, // Less than required minimum
        averageAccuracy: 95
      })

      const newAchievements = checkNewAchievements(metrics)

      const accuracyAchievement = newAchievements.find(a => a.achievement.id === 'accuracy-master')
      expect(accuracyAchievement).toBeUndefined()
    })

    it('should check streak achievements', () => {
      const metrics = createMockProgressMetrics({
        currentStreakDays: 7
      })

      const newAchievements = checkNewAchievements(metrics)

      const streak3Achievement = newAchievements.find(a => a.achievement.id === 'streak-3')
      const streak7Achievement = newAchievements.find(a => a.achievement.id === 'streak-7')
      
      expect(streak3Achievement).toBeDefined()
      expect(streak7Achievement).toBeDefined()
    })

    it('should check listening minutes achievements', () => {
      const metrics = createMockProgressMetrics({
        totalListeningMinutes: 150
      })

      const newAchievements = checkNewAchievements(metrics)

      const listening100Achievement = newAchievements.find(a => a.achievement.id === 'listening-100')
      expect(listening100Achievement).toBeDefined()
    })
  })

  describe('handlePracticeCompleted', () => {
    beforeEach(() => {
      initializeAchievements()
    })

    it('should integrate with performance monitoring', () => {
      const performanceSpy = vi.spyOn(performance, 'now')
        .mockReturnValueOnce(100) // Start time
        .mockReturnValueOnce(120) // End time

      const exercise = createMockExercise({
        results: [
          { is_correct: true } as any,
          { is_correct: true } as any,
          { is_correct: false } as any
        ]
      })

      const result = handlePracticeCompleted(exercise)

      expect(result.metrics).toBeDefined()
      expect(result.newAchievements).toBeDefined()
      expect(result.goalProgress).toBeDefined()
      expect(performanceSpy).toHaveBeenCalledTimes(2)

      performanceSpy.mockRestore()
    })

    it('should handle performance monitoring warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const performanceSpy = vi.spyOn(performance, 'now')
        .mockReturnValueOnce(100) // Start time
        .mockReturnValueOnce(200) // End time (100ms processing time > 50ms threshold)

      const exercise = createMockExercise()

      handlePracticeCompleted(exercise)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Achievement processing took')
      )

      consoleSpy.mockRestore()
      performanceSpy.mockRestore()
    })

    it('should handle errors gracefully and return fallback values', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Create an invalid exercise that will cause errors
      const invalidExercise = {
        ...createMockExercise(),
        results: null as any // This will cause errors in processing
      }

      const result = handlePracticeCompleted(invalidExercise)

      // Should return fallback values without crashing
      expect(result.metrics).toBeDefined()
      expect(result.goalProgress).toBeDefined()
      expect(consoleSpy).toHaveBeenCalledWith('Error processing practice completion:', expect.any(Error))

      consoleSpy.mockRestore()
    })

    it('should update metrics and check achievements', () => {
      const exercise = createMockExercise({
        results: [
          { is_correct: true } as any,
          { is_correct: true } as any,
          { is_correct: true } as any,
          { is_correct: true } as any,
          { is_correct: true } as any
        ]
      })

      const result = handlePracticeCompleted(exercise)

      expect(result.metrics.totalSessions).toBe(1)
      expect(result.metrics.totalCorrectAnswers).toBe(5)
      expect(result.newAchievements.length).toBeGreaterThan(0)
      
      // Should earn first-session achievement
      const firstSessionAchievement = result.newAchievements.find(a => a.achievement.id === 'first-session')
      expect(firstSessionAchievement).toBeDefined()
    })
  })

  describe('initializeAchievements', () => {
    it('should initialize predefined achievements', () => {
      const achievements = initializeAchievements()

      expect(achievements.length).toBeGreaterThan(0)
      
      // Check for some expected achievements
      const achievementIds = achievements.map(a => a.id)
      expect(achievementIds).toContain('first-session')
      expect(achievementIds).toContain('accuracy-master')
      expect(achievementIds).toContain('streak-3')
      expect(achievementIds).toContain('listening-100')

      // All should be unearned initially
      achievements.forEach(achievement => {
        expect(achievement.earnedAt).toBeUndefined()
      })
    })

    it('should not reinitialize if achievements already exist', () => {
      // First initialization
      const firstInit = initializeAchievements()
      
      // Earn an achievement by completing a practice session
      const exercise = createMockExercise()
      handlePracticeCompleted(exercise)
      
      // Second initialization should return existing achievements (with earned ones)
      const secondInit = initializeAchievements()
      
      // Should have the same length and some earned achievements
      expect(secondInit.length).toBe(firstInit.length)
      const earnedAchievements = secondInit.filter(a => a.earnedAt)
      expect(earnedAchievements.length).toBeGreaterThan(0)
    })
  })

  describe('getEarnedAchievements', () => {
    it('should return only earned achievements', () => {
      initializeAchievements()

      // Earn first achievement by completing a session
      const exercise = createMockExercise()
      handlePracticeCompleted(exercise)

      const earnedAchievements = getEarnedAchievements()
      
      expect(earnedAchievements.length).toBeGreaterThan(0)
      earnedAchievements.forEach(achievement => {
        expect(achievement.earnedAt).toBeDefined()
      })
    })

    it('should return empty array when no achievements are earned', () => {
      initializeAchievements()
      
      const earnedAchievements = getEarnedAchievements()

      expect(earnedAchievements).toEqual([])
    })

    it('should align earned achievement text with translation resources', () => {
      initializeAchievements()

      const exercise = createMockExercise()
      handlePracticeCompleted(exercise)

      const { result } = renderHook(() => useBilingualText())
      const { t, getBilingualValue } = result.current

      const earnedAchievements = getEarnedAchievements()
      expect(earnedAchievements.length).toBeGreaterThan(0)

      earnedAchievements.forEach(achievement => {
        const titleTranslation = resolveAchievementTranslationFromJson(achievement.titleKey)
        const descriptionTranslation = resolveAchievementTranslationFromJson(achievement.descriptionKey)

        expect(titleTranslation).not.toBeNull()
        expect(descriptionTranslation).not.toBeNull()

        if (titleTranslation) {
          expect(t(achievement.titleKey)).toBe(getBilingualValue(titleTranslation))
        }

        if (descriptionTranslation) {
          expect(t(achievement.descriptionKey)).toBe(getBilingualValue(descriptionTranslation))
        }
      })
    })
  })

  describe('getAvailableAchievements', () => {
    it('should return only unearned achievements', () => {
      initializeAchievements()
      
      const availableAchievements = getAvailableAchievements()
      
      expect(availableAchievements.length).toBeGreaterThan(0)
      availableAchievements.forEach(achievement => {
        expect(achievement.earnedAt).toBeUndefined()
      })
    })

    it('should exclude earned achievements', () => {
      initializeAchievements()
      
      // Earn an achievement
      const exercise = createMockExercise()
      handlePracticeCompleted(exercise)

      const availableAchievements = getAvailableAchievements()
      const earnedAchievements = getEarnedAchievements()
      
      // Available + earned should equal total
      const totalAchievements = initializeAchievements()
      expect(availableAchievements.length + earnedAchievements.length).toBe(totalAchievements.length)
    })
  })

  describe('calculateGoalProgress', () => {
    it('should calculate daily goal progress', () => {
      const metrics = createMockProgressMetrics({
        weeklyTrend: [
          { date: new Date().toISOString().split('T')[0], sessions: 2 }
        ]
      })
      const goals = createMockGoalSettings({
        dailyMinutesTarget: 20
      })

      const progress = calculateGoalProgress(metrics, goals)

      expect(progress.daily.target).toBe(20)
      expect(progress.daily.current).toBe(6) // 2 sessions * 3 minutes estimated per session
      expect(progress.daily.isCompleted).toBe(false)
    })

    it('should calculate weekly goal progress', () => {
      const currentWeekStart = getWeekStart(new Date()).toISOString().split('T')[0]
      const metrics = createMockProgressMetrics({
        weeklyTrend: [
          { date: currentWeekStart, sessions: 3 },
          { date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], sessions: 2 }
        ]
      })
      const goals = createMockGoalSettings({
        weeklySessionsTarget: 5
      })

      const progress = calculateGoalProgress(metrics, goals)

      expect(progress.weekly.target).toBe(5)
      expect(progress.weekly.current).toBeGreaterThanOrEqual(3)
      expect(progress.weekly.isCompleted).toBe(progress.weekly.current >= 5)
    })

    it('should mark goals as completed when targets are met', () => {
      const metrics = createMockProgressMetrics({
        weeklyTrend: [
          { date: new Date().toISOString().split('T')[0], sessions: 10 } // High session count
        ]
      })
      const goals = createMockGoalSettings({
        dailyMinutesTarget: 20,
        weeklySessionsTarget: 5
      })

      const progress = calculateGoalProgress(metrics, goals)

      expect(progress.daily.isCompleted).toBe(true)
      expect(progress.daily.lastCompletedAt).toBeDefined()
    })
  })

  describe('migrateFromHistory', () => {
    it('should calculate metrics from exercise history', () => {
      const exercises = [
        createMockExercise({
          results: [
            { is_correct: true } as any,
            { is_correct: false } as any,
            { is_correct: true } as any
          ],
          questions: [
            { question: 'Q1' } as any,
            { question: 'Q2' } as any,
            { question: 'Q3' } as any
          ],
          totalDurationSec: 180
        }),
        createMockExercise({
          results: [
            { is_correct: true } as any,
            { is_correct: true } as any
          ],
          questions: [
            { question: 'Q1' } as any,
            { question: 'Q2' } as any
          ],
          totalDurationSec: 120
        })
      ]

      const metrics = migrateFromHistory(exercises)

      expect(metrics.totalSessions).toBe(2)
      expect(metrics.totalCorrectAnswers).toBe(4) // 2 + 2
      expect(metrics.totalQuestions).toBe(5) // 3 + 2
      expect(metrics.averageAccuracy).toBe(80) // 4/5 * 100
      expect(metrics.totalListeningMinutes).toBe(5) // 180 + 120 seconds = 300 seconds = 5 minutes
    })

    it('should initialize achievements after migration', () => {
      const exercises = [createMockExercise()]

      migrateFromHistory(exercises)

      const achievements = getAvailableAchievements()
      expect(achievements.length).toBeGreaterThan(0)
    })

    it('should handle large exercise sets efficiently', () => {
      // Create a large set of exercises
      const exercises = Array.from({ length: 500 }, (_, i) => 
        createMockExercise({
          id: `exercise-${i}`,
          results: [{ is_correct: true } as any],
          questions: [{ question: 'Q1' } as any]
        })
      )

      const startTime = performance.now()
      const metrics = migrateFromHistory(exercises)
      const endTime = performance.now()

      expect(metrics.totalSessions).toBe(500)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('Achievement Condition Checking', () => {
    beforeEach(() => {
      initializeAchievements()
    })

    it('should check sessions condition correctly', () => {
      const metrics = createMockProgressMetrics({
        totalSessions: 10
      })

      const newAchievements = checkNewAchievements(metrics)
      
      const tenSessionsAchievement = newAchievements.find(a => a.achievement.id === 'ten-sessions')
      expect(tenSessionsAchievement).toBeDefined()
    })

    it('should check accuracy condition with session requirement', () => {
      const metrics = createMockProgressMetrics({
        totalSessions: 10,
        averageAccuracy: 92
      })

      const newAchievements = checkNewAchievements(metrics)
      
      const accuracyAchievement = newAchievements.find(a => a.achievement.id === 'accuracy-master')
      expect(accuracyAchievement).toBeDefined()
    })

    it('should check streak condition correctly', () => {
      const metrics = createMockProgressMetrics({
        currentStreakDays: 30
      })

      const newAchievements = checkNewAchievements(metrics)
      
      // Should earn all streak achievements up to 30 days
      const streak3 = newAchievements.find(a => a.achievement.id === 'streak-3')
      const streak7 = newAchievements.find(a => a.achievement.id === 'streak-7')
      const streak30 = newAchievements.find(a => a.achievement.id === 'streak-30')
      
      expect(streak3).toBeDefined()
      expect(streak7).toBeDefined()
      expect(streak30).toBeDefined()
    })

    it('should check minutes condition correctly', () => {
      const metrics = createMockProgressMetrics({
        totalListeningMinutes: 600
      })

      const newAchievements = checkNewAchievements(metrics)
      
      // Should earn both 100 and 500 minute achievements
      const listening100 = newAchievements.find(a => a.achievement.id === 'listening-100')
      const listening500 = newAchievements.find(a => a.achievement.id === 'listening-500')
      
      expect(listening100).toBeDefined()
      expect(listening500).toBeDefined()
    })
  })
})

// Helper function to get week start (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}