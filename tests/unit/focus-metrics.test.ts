import { describe, expect, it, vi } from 'vitest'
import {
  computeFocusStats,
  getDefaultRecommendations,
  getDefaultStats,
  selectRecommendedFocusAreas,
  type PracticeSession
} from '../../lib/focus-metrics'
import { FOCUS_AREA_LIST, type WrongAnswerItem } from '../../lib/types'

describe('focus-metrics', () => {
  it('returns defaults when no data is provided', () => {
    const stats = computeFocusStats([], [])

    expect(Object.keys(stats)).toHaveLength(FOCUS_AREA_LIST.length)
    FOCUS_AREA_LIST.forEach((area) => {
      expect(stats[area].attempts).toBe(0)
      expect(stats[area].incorrect).toBe(0)
      expect(stats[area].accuracy).toBe(0)
      expect(stats[area].trend).toBe('stable')
    })
  })

  it('handles malformed exercise data gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sessions: PracticeSession[] = [
      {
        id: 's1',
        accuracy: 75,
        createdAt: new Date().toISOString(),
        difficulty: 'B1',
        language: 'en-US',
        topic: 'tech',
        exerciseData: 'not-json'
      }
    ]

    const stats = computeFocusStats([], sessions)

    expect(warnSpy).toHaveBeenCalled()
    expect(stats['main-idea'].attempts).toBe(0)
    warnSpy.mockRestore()
  })

  it('tracks attempts, incorrect answers, and trend', () => {
    const attemptTime = new Date('2024-01-02T00:00:00.000Z').toISOString()
    const sessions: PracticeSession[] = [
      {
        id: 's1',
        accuracy: 40,
        createdAt: new Date('2023-12-30T00:00:00.000Z').toISOString(),
        difficulty: 'B1',
        language: 'en-US',
        topic: 'tech',
        exerciseData: JSON.stringify({
          focusAreas: ['main-idea'],
          questions: [{ focus_areas: ['main-idea'] }]
        })
      },
      {
        id: 's2',
        accuracy: 85,
        createdAt: new Date('2023-12-31T00:00:00.000Z').toISOString(),
        difficulty: 'B1',
        language: 'en-US',
        topic: 'tech',
        exerciseData: JSON.stringify({
          focusAreas: ['main-idea'],
          questions: [{ focus_areas: ['main-idea'] }]
        })
      }
    ]
    const wrongAnswers: WrongAnswerItem[] = [
      {
        answerId: 'a1',
        questionId: 'q1',
        sessionId: 's1',
        session: {
          topic: 'tech',
          difficulty: 'B1',
          language: 'en-US',
          createdAt: new Date().toISOString()
        },
        question: {
          index: 0,
          type: 'single',
          question: 'Main idea?',
          correctAnswer: 'yes',
          transcript: 'text',
          focus_areas: ['main-idea']
        },
        answer: {
          userAnswer: 'no',
          isCorrect: false,
          attemptedAt: attemptTime,
          needsAnalysis: false
        }
      }
    ]

    const stats = computeFocusStats(wrongAnswers, sessions)

    expect(stats['main-idea'].attempts).toBe(3)
    expect(stats['main-idea'].incorrect).toBe(1)
    expect(stats['main-idea'].accuracy).toBeCloseTo(66.7)
    expect(['improving', 'stable']).toContain(stats['main-idea'].trend)
    expect(stats['main-idea'].lastAttempt).toBe(attemptTime)
  })

  it('selects focus areas with the highest error rates', () => {
    const stats = getDefaultStats()
    stats['main-idea'] = { attempts: 10, incorrect: 7, accuracy: 30, trend: 'declining' }
    stats['detail-comprehension'] = { attempts: 5, incorrect: 1, accuracy: 80, trend: 'stable' }
    stats['inference'] = { attempts: 2, incorrect: 0, accuracy: 100, trend: 'improving' }

    const recommendations = selectRecommendedFocusAreas(stats, 2)

    expect(recommendations).toEqual(['main-idea', 'detail-comprehension'])
  })

  it('provides sensible default recommendations', () => {
    const defaults = getDefaultRecommendations()

    expect(defaults.length).toBeGreaterThan(0)
    expect(defaults).toContain('main-idea')
  })
})
