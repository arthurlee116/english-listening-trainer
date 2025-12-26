import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearHistory,
  getAchievements,
  getHistory,
  getProgressMetrics,
  markAchievementEarned,
  saveAchievements,
  saveProgressMetrics,
  saveToHistory
} from '../../lib/storage'
import type { AchievementBadge, Exercise, UserProgressMetrics } from '../../lib/types'

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    clearHistory()
  })

  it('saves history with newest first and caps at 10 items', () => {
    const buildExercise = (id: number): Exercise => ({
      id: `ex-${id}`,
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'hello world',
      questions: [],
      answers: {},
      results: [],
      createdAt: new Date().toISOString()
    })

    Array.from({ length: 11 }).forEach((_, index) => saveToHistory(buildExercise(index)))

    const history = getHistory()
    expect(history).toHaveLength(10)
    expect(history[0].id).toBe('ex-10')
    expect(history.at(-1)?.id).toBe('ex-1')
  })

  it('recovers progress metrics with validation when stored data is invalid', () => {
    localStorage.setItem('english-listening-progress', JSON.stringify({ totalSessions: 'bad' }))
    const metrics = getProgressMetrics()

    expect(metrics.totalSessions).toBe(0)
    expect(metrics.averageAccuracy).toBe(0)

    const updated: UserProgressMetrics = {
      ...metrics,
      totalSessions: 2,
      totalCorrectAnswers: 10,
      totalQuestions: 12,
      averageAccuracy: 83.3,
      totalListeningMinutes: 20,
      currentStreakDays: 1,
      longestStreakDays: 2,
      lastPracticedAt: new Date().toISOString(),
      weeklyTrend: []
    }
    saveProgressMetrics(updated)
    const persisted = getProgressMetrics()
    expect(persisted.totalSessions).toBe(2)
    expect(persisted.totalCorrectAnswers).toBe(10)
  })

  it('marks an achievement as earned with a timestamp', () => {
    const achievements: AchievementBadge[] = [
      {
        id: 'first-session',
        titleKey: 't',
        descriptionKey: 'd',
        conditions: { type: 'sessions', threshold: 1 }
      }
    ]

    saveAchievements(achievements)
    markAchievementEarned('first-session')

    const stored = getAchievements()
    expect(stored[0].earnedAt).toBeDefined()
  })
})
