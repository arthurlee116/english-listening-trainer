import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AchievementBadge, UserGoalSettings, UserProgressMetrics, PracticeSessionData, Exercise } from '@/lib/types'

const mockGetProgressMetrics = vi.fn()
const mockSaveProgressMetrics = vi.fn()
const mockGetGoalSettings = vi.fn()
const mockGetAchievements = vi.fn()
const mockSaveAchievements = vi.fn()
const mockConvertExerciseToSessionData = vi.fn()

vi.mock('@/lib/storage', () => ({
  getProgressMetrics: () => mockGetProgressMetrics(),
  saveProgressMetrics: (metrics: UserProgressMetrics) => mockSaveProgressMetrics(metrics),
  getGoalSettings: () => mockGetGoalSettings(),
  getAchievements: () => mockGetAchievements(),
  saveAchievements: (achievements: AchievementBadge[]) => mockSaveAchievements(achievements),
  convertExerciseToSessionData: (exercise: Exercise) => mockConvertExerciseToSessionData(exercise),
}))

import {
  updateProgressMetrics,
  initializeAchievements,
  checkNewAchievements,
  calculateGoalProgress,
  migrateFromHistory,
  handlePracticeCompleted,
  getEarnedAchievements,
  getAvailableAchievements,
} from '@/lib/achievement-service'

function buildMetrics(overrides: Partial<UserProgressMetrics> = {}): UserProgressMetrics {
  return {
    totalSessions: 0,
    totalCorrectAnswers: 0,
    totalQuestions: 0,
    averageAccuracy: 0,
    totalListeningMinutes: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastPracticedAt: null,
    weeklyTrend: [],
    ...overrides,
  }
}

function buildGoals(overrides: Partial<UserGoalSettings> = {}): UserGoalSettings {
  return {
    dailyMinutesTarget: 20,
    weeklySessionsTarget: 5,
    lastUpdatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('achievement-service', () => {
  beforeEach(() => {
    mockGetProgressMetrics.mockReturnValue(buildMetrics())
    mockSaveProgressMetrics.mockReset()
    mockGetGoalSettings.mockReturnValue(buildGoals())
    mockGetAchievements.mockReturnValue([])
    mockSaveAchievements.mockReset()
    mockConvertExerciseToSessionData.mockReset()
  })

  it('updates progress metrics with new session data', () => {
    const today = new Date().toISOString()
    const sessionData: PracticeSessionData = {
      sessionId: 'session-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 80,
      duration: 180,
      questionsCount: 10,
      correctAnswersCount: 8,
      completedAt: today,
    }

    const updated = updateProgressMetrics(sessionData)

    expect(updated.totalSessions).toBe(1)
    expect(updated.totalCorrectAnswers).toBe(8)
    expect(updated.totalQuestions).toBe(10)
    expect(updated.totalListeningMinutes).toBe(3)
    expect(updated.averageAccuracy).toBe(80)
    expect(mockSaveProgressMetrics).toHaveBeenCalledWith(updated)
  })

  it('increments today trend when entry exists', () => {
    const today = new Date().toISOString().split('T')[0]
    mockGetProgressMetrics.mockReturnValue(buildMetrics({
      weeklyTrend: [{ date: today, sessions: 2 }]
    }))

    const sessionData: PracticeSessionData = {
      sessionId: 'session-2',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 90,
      duration: 120,
      questionsCount: 5,
      correctAnswersCount: 5,
      completedAt: new Date().toISOString(),
    }

    const updated = updateProgressMetrics(sessionData)

    expect(updated.weeklyTrend.find(item => item.date === today)?.sessions).toBe(3)
  })

  it('returns zero average accuracy when no questions exist', () => {
    mockGetProgressMetrics.mockReturnValue(buildMetrics())

    const sessionData: PracticeSessionData = {
      sessionId: 'session-3',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 0,
      duration: 0,
      questionsCount: 0,
      correctAnswersCount: 0,
      completedAt: new Date().toISOString(),
    }

    const updated = updateProgressMetrics(sessionData)
    expect(updated.averageAccuracy).toBe(0)
  })

  it('initializes achievements when none exist', () => {
    mockGetAchievements.mockReturnValue([])

    const result = initializeAchievements()

    expect(result.length).toBeGreaterThan(0)
    expect(mockSaveAchievements).toHaveBeenCalled()
  })

  it('skips initialization when achievements exist', () => {
    const existing: AchievementBadge[] = [
      {
        id: 'existing',
        titleKey: 'title',
        descriptionKey: 'desc',
        earnedAt: '2024-01-01T00:00:00.000Z',
        conditions: { type: 'sessions', threshold: 1 }
      }
    ]
    mockGetAchievements.mockReturnValue(existing)

    const result = initializeAchievements()

    expect(result).toEqual(existing)
    expect(mockSaveAchievements).not.toHaveBeenCalled()
  })

  it('marks new achievements and returns notifications', () => {
    const achievements: AchievementBadge[] = [
      {
        id: 'first-session',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'sessions', threshold: 1 }
      }
    ]
    mockGetAchievements.mockReturnValue(achievements)

    const metrics = buildMetrics({ totalSessions: 1 })
    const notifications = checkNewAchievements(metrics)

    expect(notifications).toHaveLength(1)
    expect(notifications[0].achievement.earnedAt).toBeDefined()
    expect(mockSaveAchievements).toHaveBeenCalled()
  })

  it('returns earned and available achievements', () => {
    const achievements: AchievementBadge[] = [
      {
        id: 'earned',
        titleKey: 't',
        descriptionKey: 'd',
        earnedAt: '2024-01-01T00:00:00.000Z',
        conditions: { type: 'sessions', threshold: 1 }
      },
      {
        id: 'pending',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'sessions', threshold: 5 }
      }
    ]
    mockGetAchievements.mockReturnValue(achievements)

    expect(getEarnedAchievements()).toHaveLength(1)
    expect(getAvailableAchievements()).toHaveLength(1)
  })

  it('does not award achievements when conditions are not met', () => {
    const achievements: AchievementBadge[] = [
      {
        id: 'accuracy-master',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'accuracy', threshold: 90, minSessions: 5 }
      }
    ]
    mockGetAchievements.mockReturnValue(achievements)

    const metrics = buildMetrics({ totalSessions: 2, averageAccuracy: 80 })
    const notifications = checkNewAchievements(metrics)

    expect(notifications).toHaveLength(0)
    expect(mockSaveAchievements).not.toHaveBeenCalled()
  })

  it('awards streak and minutes achievements when thresholds are met', () => {
    const achievements: AchievementBadge[] = [
      {
        id: 'streak-3',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'streak', threshold: 3 }
      },
      {
        id: 'minutes-100',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'minutes', threshold: 100 }
      }
    ]
    mockGetAchievements.mockReturnValue(achievements)

    const metrics = buildMetrics({ currentStreakDays: 4, totalListeningMinutes: 120 })
    const notifications = checkNewAchievements(metrics)

    expect(notifications).toHaveLength(2)
  })

  it('calculates goal progress from weekly trend', () => {
    const today = new Date().toISOString().split('T')[0]
    const metrics = buildMetrics({
      weeklyTrend: [{ date: today, sessions: 4 }]
    })
    const goals = buildGoals({ dailyMinutesTarget: 10, weeklySessionsTarget: 3 })

    const progress = calculateGoalProgress(metrics, goals)

    expect(progress.daily.current).toBe(12)
    expect(progress.daily.isCompleted).toBe(true)
    expect(progress.weekly.current).toBe(4)
    expect(progress.weekly.isCompleted).toBe(true)
  })

  it('reports incomplete goals when below targets', () => {
    const today = new Date().toISOString().split('T')[0]
    const metrics = buildMetrics({
      weeklyTrend: [{ date: today, sessions: 1 }]
    })
    const goals = buildGoals({ dailyMinutesTarget: 30, weeklySessionsTarget: 5 })

    const progress = calculateGoalProgress(metrics, goals)

    expect(progress.daily.isCompleted).toBe(false)
    expect(progress.weekly.isCompleted).toBe(false)
  })

  it('migrates from history and initializes achievements', () => {
    const exercises: Exercise[] = [
      {
        id: 'exercise-1',
        difficulty: 'B1',
        language: 'en-US',
        topic: 'topic',
        transcript: 'text',
        questions: [],
        answers: {},
        results: [],
        createdAt: new Date().toISOString(),
      }
    ]

    mockConvertExerciseToSessionData.mockReturnValue({
      sessionId: 'session-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 80,
      duration: 120,
      questionsCount: 5,
      correctAnswersCount: 4,
      completedAt: new Date().toISOString(),
    })

    const result = migrateFromHistory(exercises)

    expect(result.totalSessions).toBe(1)
    expect(mockSaveProgressMetrics).toHaveBeenCalled()
    expect(mockSaveAchievements).toHaveBeenCalled()
  })

  it('migrates empty history without crashing', () => {
    mockGetProgressMetrics.mockReturnValue(buildMetrics({ totalListeningMinutes: 25 }))
    const result = migrateFromHistory([])

    expect(result.totalSessions).toBe(0)
    expect(result.totalListeningMinutes).toBeGreaterThan(0)
  })

  it('batches large history without blocking', () => {
    const exercises: Exercise[] = Array.from({ length: 201 }).map((_, index) => ({
      id: `exercise-${index}`,
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'text',
      questions: [],
      answers: {},
      results: [],
      createdAt: new Date().toISOString(),
    }))

    const originalIdle = (globalThis as typeof globalThis & { requestIdleCallback?: () => void }).requestIdleCallback
    ;(globalThis as typeof globalThis & { requestIdleCallback?: () => void }).requestIdleCallback = () => {}

    mockConvertExerciseToSessionData.mockReturnValue({
      sessionId: 'session-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 80,
      duration: 0,
      questionsCount: 1,
      correctAnswersCount: 1,
      completedAt: new Date().toISOString(),
    })

    const result = migrateFromHistory(exercises)
    expect(result.totalSessions).toBe(201)

    ;(globalThis as typeof globalThis & { requestIdleCallback?: () => void }).requestIdleCallback = originalIdle
  })

  it('does not create a streak for stale sessions', () => {
    const oldDate = new Date('2023-01-01T00:00:00.000Z').toISOString()
    const exercises: Exercise[] = [
      {
        id: 'exercise-old',
        difficulty: 'B1',
        language: 'en-US',
        topic: 'topic',
        transcript: 'text',
        questions: [],
        answers: {},
        results: [],
        createdAt: oldDate,
      }
    ]

    mockConvertExerciseToSessionData.mockReturnValue({
      sessionId: 'session-old',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 70,
      duration: 60,
      questionsCount: 1,
      correctAnswersCount: 1,
      completedAt: oldDate,
    })

    const result = migrateFromHistory(exercises)
    expect(result.currentStreakDays).toBe(0)
  })

  it('handles practice completion and returns goal progress', () => {
    const achievements: AchievementBadge[] = [
      {
        id: 'first-session',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'sessions', threshold: 1 }
      }
    ]
    mockGetAchievements.mockReturnValue(achievements)

    mockConvertExerciseToSessionData.mockReturnValue({
      sessionId: 'session-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      accuracy: 80,
      duration: 180,
      questionsCount: 10,
      correctAnswersCount: 8,
      completedAt: new Date().toISOString(),
    })

    const exercise: Exercise = {
      id: 'exercise-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'text',
      questions: [],
      answers: {},
      results: [],
      createdAt: new Date().toISOString(),
    }

    const result = handlePracticeCompleted(exercise)

    expect(result.metrics.totalSessions).toBe(1)
    expect(result.newAchievements).toHaveLength(1)
    expect(result.goalProgress.daily).toBeDefined()
  })

  it('falls back when practice completion throws', () => {
    mockConvertExerciseToSessionData.mockImplementation(() => {
      throw new Error('bad session')
    })

    const fallbackMetrics = buildMetrics({
      totalSessions: 2,
      weeklyTrend: [{ date: new Date().toISOString().split('T')[0], sessions: 1 }]
    })
    mockGetProgressMetrics.mockReturnValue(fallbackMetrics)

    const exercise: Exercise = {
      id: 'exercise-2',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'text',
      questions: [],
      answers: {},
      results: [],
      createdAt: new Date().toISOString(),
    }

    const result = handlePracticeCompleted(exercise)

    expect(result.metrics.totalSessions).toBe(2)
    expect(result.newAchievements).toHaveLength(0)
  })
})
