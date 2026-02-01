import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAchievementData,
  clearHistory,
  convertExerciseToSessionData,
  getAchievements,
  getGoalSettings,
  getHistory,
  mergePracticeHistory,
  getPracticeNote,
  getProgressMetrics,
  isStorageAvailable,
  markAchievementEarned,
  savePracticeNote,
  saveAchievements,
  saveGoalSettings,
  saveProgressMetrics,
  saveToHistory,
  deletePracticeNote
} from '../../lib/storage'
import type { AchievementBadge, Exercise, UserProgressMetrics } from '../../lib/types'
import type { ExerciseHistoryEntry } from '../../lib/storage'

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

  it('handles storage failures gracefully for history operations', () => {
    const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('read fail')
    })
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('write fail')
    })
    const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('remove fail')
    })

    expect(getHistory()).toEqual([])
    saveToHistory({
      id: 'ex-err',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'hello',
      questions: [],
      answers: {},
      results: [],
      createdAt: new Date().toISOString()
    })
    clearHistory()

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  })

  it('merges server and local history by session id and sorts newest first', () => {
    const serverHistory: ExerciseHistoryEntry[] = [
      {
        id: 'server-1',
        difficulty: 'B1',
        language: 'en-US',
        topic: 'server topic 1',
        transcript: 'server 1',
        questions: [],
        answers: {},
        results: [],
        createdAt: '2024-01-03T10:00:00.000Z',
        sessionId: 'session-1'
      },
      {
        id: 'server-2',
        difficulty: 'B2',
        language: 'en-US',
        topic: 'server topic 2',
        transcript: 'server 2',
        questions: [],
        answers: {},
        results: [],
        createdAt: '2024-01-02T10:00:00.000Z',
        sessionId: 'session-2'
      }
    ]

    const localHistory: ExerciseHistoryEntry[] = [
      {
        id: 'local-1',
        difficulty: 'A2',
        language: 'en-US',
        topic: 'local topic 1',
        transcript: 'local 1',
        questions: [],
        answers: {},
        results: [],
        createdAt: '2024-01-04T10:00:00.000Z'
      },
      {
        id: 'local-2',
        difficulty: 'A1',
        language: 'en-US',
        topic: 'local topic 2',
        transcript: 'local 2',
        questions: [],
        answers: {},
        results: [],
        createdAt: '2024-01-01T10:00:00.000Z'
      }
    ]

    const merged = mergePracticeHistory({
      serverHistory,
      localHistory,
      pageSize: 10
    })

    expect(merged).toHaveLength(4)
    expect(merged[0].id).toBe('local-1')
    expect(merged[1].id).toBe('server-1')
    expect(merged[2].id).toBe('server-2')
    expect(merged[3].id).toBe('local-2')
  })

  it('prefers server entries when session ids collide', () => {
    const serverHistory: ExerciseHistoryEntry[] = [
      {
        id: 'server-1',
        difficulty: 'B1',
        language: 'en-US',
        topic: 'server topic 1',
        transcript: 'server 1',
        questions: [],
        answers: {},
        results: [],
        createdAt: '2024-01-03T10:00:00.000Z',
        sessionId: 'session-1'
      }
    ]

    const localHistory: ExerciseHistoryEntry[] = [
      {
        id: 'local-1',
        difficulty: 'A2',
        language: 'en-US',
        topic: 'local topic 1',
        transcript: 'local 1',
        questions: [],
        answers: {},
        results: [],
        createdAt: '2024-01-04T10:00:00.000Z',
        sessionId: 'session-1'
      }
    ]

    const merged = mergePracticeHistory({
      serverHistory,
      localHistory,
      pageSize: 10
    })

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('server-1')
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

  it('safely reads and writes achievements', () => {
    const achievements: AchievementBadge[] = Array.from({ length: 60 }).map((_, index) => ({
      id: `a-${index}`,
      titleKey: 't',
      descriptionKey: 'd',
      conditions: { type: 'sessions', threshold: 1 }
    }))

    saveAchievements(achievements)
    const stored = getAchievements()
    expect(stored.length).toBeLessThanOrEqual(50)
  })

  it('handles invalid achievement data gracefully', () => {
    localStorage.setItem('english-listening-achievements', 'bad-json')
    const stored = getAchievements()
    expect(stored).toEqual([])
  })

  it('saves and loads goal settings with defaults', () => {
    saveGoalSettings({
      dailyMinutesTarget: 30,
      weeklySessionsTarget: 7,
      lastUpdatedAt: '2024-01-01T00:00:00.000Z'
    })

    const settings = getGoalSettings()
    expect(settings.dailyMinutesTarget).toBe(30)
    expect(settings.weeklySessionsTarget).toBe(7)
  })

  it('restores goal settings when stored data is invalid', () => {
    localStorage.setItem('english-listening-goals', 'not-json')
    const settings = getGoalSettings()
    expect(settings.dailyMinutesTarget).toBeGreaterThan(0)
  })

  it('clears all achievement system data', () => {
    localStorage.setItem('english-listening-progress', JSON.stringify({ totalSessions: 1 }))
    localStorage.setItem('english-listening-goals', JSON.stringify({ dailyMinutesTarget: 10 }))
    localStorage.setItem('english-listening-achievements', JSON.stringify([]))

    clearAchievementData()

    expect(localStorage.getItem('english-listening-progress')).toBeNull()
    expect(localStorage.getItem('english-listening-goals')).toBeNull()
    expect(localStorage.getItem('english-listening-achievements')).toBeNull()
  })

  it('fixes negative and oversized metrics values', () => {
    localStorage.setItem('english-listening-progress', JSON.stringify({
      totalSessions: -2,
      totalCorrectAnswers: -1,
      totalQuestions: -3,
      averageAccuracy: 200,
      totalListeningMinutes: -10,
      currentStreakDays: -1,
      longestStreakDays: -5,
      weeklyTrend: 'bad'
    }))

    const metrics = getProgressMetrics()
    expect(metrics.totalSessions).toBe(0)
    expect(metrics.averageAccuracy).toBe(100)
    expect(Array.isArray(metrics.weeklyTrend)).toBe(true)
  })

  it('trims weekly trend array to 7 entries', () => {
    localStorage.setItem('english-listening-progress', JSON.stringify({
      totalSessions: 2,
      totalCorrectAnswers: 1,
      totalQuestions: 2,
      averageAccuracy: 50,
      totalListeningMinutes: 5,
      currentStreakDays: 1,
      longestStreakDays: 2,
      weeklyTrend: Array.from({ length: 10 }).map((_, index) => ({
        date: `2024-01-${String(index + 1).padStart(2, '0')}`,
        sessions: 1
      }))
    }))

    const metrics = getProgressMetrics()
    expect(metrics.weeklyTrend.length).toBe(7)
  })

  it('checks storage availability', () => {
    expect(isStorageAvailable()).toBe(true)

    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(isStorageAvailable()).toBe(false)
    setItemSpy.mockRestore()
  })

  it('reports storage unavailable when removeItem fails', () => {
    const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(isStorageAvailable()).toBe(false)
    removeItemSpy.mockRestore()
  })

  it('converts exercise data with explicit duration', () => {
    const session = convertExerciseToSessionData({
      id: 'ex-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'hello world',
      questions: [],
      answers: {},
      results: [{ is_correct: true } as never],
      createdAt: new Date().toISOString(),
      totalDurationSec: 120
    })

    expect(session.duration).toBe(120)
    expect(session.correctAnswersCount).toBe(1)
  })

  it('converts exercise data with inferred duration', () => {
    const createdAt = new Date('2023-12-31T23:59:00.000Z').toISOString()
    const session = convertExerciseToSessionData({
      id: 'ex-2',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'word '.repeat(100),
      questions: [],
      answers: {},
      results: [{ is_correct: false } as never],
      createdAt
    })

    expect(session.duration).toBeGreaterThan(0)
  })

  it('falls back to word-based duration estimation', () => {
    const createdAt = new Date('2023-01-01T00:00:00.000Z').toISOString()
    const session = convertExerciseToSessionData({
      id: 'ex-3',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'word '.repeat(5),
      questions: [],
      answers: {},
      results: [{ is_correct: true } as never],
      createdAt
    })

    expect(session.duration).toBeGreaterThanOrEqual(60)
  })

  it('manages practice notes lifecycle', () => {
    expect(getPracticeNote('ex-1')).toBe('')

    const saved = savePracticeNote('ex-1', 'note')
    expect(saved).toBe(true)
    expect(getPracticeNote('ex-1')).toBe('note')

    const updated = savePracticeNote('ex-1', 'updated')
    expect(updated).toBe(true)
    expect(getPracticeNote('ex-1')).toBe('updated')

    const deleted = deletePracticeNote('ex-1')
    expect(deleted).toBe(true)
    expect(getPracticeNote('ex-1')).toBe('')
  })

  it('coerces non-string notes and ignores malformed note storage', () => {
    const saved = savePracticeNote('ex-3', 123 as unknown as string)
    expect(saved).toBe(true)
    expect(getPracticeNote('ex-3')).toBe('123')

    localStorage.setItem('english-listening-notes', JSON.stringify({ bad: 'data' }))
    expect(getPracticeNote('ex-4')).toBe('')
  })

  it('returns empty string when practice note lookup throws', () => {
    localStorage.setItem('english-listening-notes', JSON.stringify([
      { exerciseId: 'ex-err', note: 'note', updatedAt: new Date().toISOString() }
    ]))

    const findSpy = vi.spyOn(Array.prototype, 'find').mockImplementation(() => {
      throw new Error('find failed')
    })

    expect(getPracticeNote('ex-err')).toBe('')
    findSpy.mockRestore()
  })

  it('returns false when deleting missing practice note', () => {
    const deleted = deletePracticeNote('missing')
    expect(deleted).toBe(false)
  })

  it('rejects overly long practice notes', () => {
    const longNote = 'x'.repeat(3000)
    const saved = savePracticeNote('ex-2', longNote)
    expect(saved).toBe(false)
  })

  it('returns false when saving practice note fails', () => {
    const findIndexSpy = vi.spyOn(Array.prototype, 'findIndex').mockImplementation(() => {
      throw new Error('findIndex failed')
    })

    const saved = savePracticeNote('ex-fail', 'note')
    expect(saved).toBe(false)
    findIndexSpy.mockRestore()
  })

  it('returns false when deleting practice note fails', () => {
    const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(() => {
      throw new Error('filter failed')
    })

    const deleted = deletePracticeNote('ex-fail')
    expect(deleted).toBe(false)
    filterSpy.mockRestore()
  })

  it('limits stored practice notes to 100 entries', () => {
    Array.from({ length: 101 }).forEach((_, index) => {
      savePracticeNote(`ex-${index}`, `note-${index}`)
    })

    const stored = localStorage.getItem('english-listening-notes')
    const list = stored ? (JSON.parse(stored) as Array<{ exerciseId: string }>) : []
    expect(list).toHaveLength(100)
    expect(list.some(item => item.exerciseId === 'ex-0')).toBe(false)
  })

  it('truncates weekly trend when saving very large metrics', () => {
    const largeTrend = Array.from({ length: 20000 }).map((_, index) => ({
      date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
      sessions: 1
    }))

    const metrics: UserProgressMetrics = {
      totalSessions: 20000,
      totalCorrectAnswers: 15000,
      totalQuestions: 20000,
      averageAccuracy: 75,
      totalListeningMinutes: 60000,
      currentStreakDays: 3,
      longestStreakDays: 5,
      lastPracticedAt: new Date().toISOString(),
      weeklyTrend: largeTrend
    }

    saveProgressMetrics(metrics)
    const stored = getProgressMetrics()
    expect(stored.weeklyTrend.length).toBeLessThanOrEqual(7)
  })

  it('retries saving progress metrics after a failure', () => {
    vi.useRealTimers()
    vi.useFakeTimers()
    const originalSetItem = localStorage.setItem
    const setItemSpy = vi.spyOn(localStorage, 'setItem')
      .mockImplementationOnce(() => {
        throw new Error('fail once')
      })
      .mockImplementation(originalSetItem)

    const metrics: UserProgressMetrics = {
      totalSessions: 1,
      totalCorrectAnswers: 1,
      totalQuestions: 1,
      averageAccuracy: 100,
      totalListeningMinutes: 1,
      currentStreakDays: 1,
      longestStreakDays: 1,
      lastPracticedAt: new Date().toISOString(),
      weeklyTrend: []
    }

    saveProgressMetrics(metrics)
    vi.runAllTimers()

    expect(setItemSpy.mock.calls.length).toBeGreaterThan(1)
    vi.useRealTimers()
  })

  it('stops retrying after repeated failures', () => {
    vi.useRealTimers()
    vi.useFakeTimers()

    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('always fail')
    })

    saveProgressMetrics({
      totalSessions: 1,
      totalCorrectAnswers: 1,
      totalQuestions: 1,
      averageAccuracy: 100,
      totalListeningMinutes: 1,
      currentStreakDays: 1,
      longestStreakDays: 1,
      lastPracticedAt: new Date().toISOString(),
      weeklyTrend: []
    })

    vi.runAllTimers()

    expect(setItemSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
    setItemSpy.mockRestore()
    vi.useRealTimers()
  })

  it('retries when metrics are invalid', () => {
    vi.useRealTimers()
    vi.useFakeTimers()
    const setItemSpy = vi.spyOn(localStorage, 'setItem')
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    saveProgressMetrics({} as UserProgressMetrics)
    vi.runAllTimers()

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(timeoutSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
