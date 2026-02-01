import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Exercise } from '@/lib/types'

import {
  fetchAllPracticeHistory,
  mapSessionToExercise,
} from '@/lib/practice-history'

describe('practice-history', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps session exerciseData when available', () => {
    const exercise: Exercise = {
      id: 'ex-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'topic',
      transcript: 'text',
      questions: [],
      answers: {},
      results: [],
      createdAt: '2024-01-01T10:00:00.000Z'
    }

    const mapped = mapSessionToExercise({
      id: 'session-1',
      difficulty: 'B1',
      language: 'en-US',
      topic: 'server topic',
      accuracy: 80,
      score: 80,
      duration: 120,
      createdAt: '2024-01-02T10:00:00.000Z',
      exerciseData: exercise
    })

    expect(mapped.id).toBe('ex-1')
    expect(mapped.sessionId).toBe('session-1')
    expect(mapped.createdAt).toBe('2024-01-01T10:00:00.000Z')
  })

  it('returns fallback exercise when exerciseData is missing', () => {
    const mapped = mapSessionToExercise({
      id: 'session-2',
      difficulty: 'A2',
      language: 'en-US',
      topic: 'server topic',
      accuracy: 70,
      score: 70,
      duration: 90,
      createdAt: '2024-01-03T10:00:00.000Z',
      exerciseData: null
    })

    expect(mapped.id).toBe('session-2')
    expect(mapped.sessionId).toBe('session-2')
    expect(mapped.transcript).toBe('')
    expect(mapped.questions).toEqual([])
  })

  it('fetches all pages until hasMore is false', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            {
              id: 'session-1',
              difficulty: 'B1',
              language: 'en-US',
              topic: 'topic 1',
              accuracy: 80,
              score: 80,
              duration: 120,
              createdAt: '2024-01-01T10:00:00.000Z',
              exerciseData: null
            }
          ],
          pagination: {
            currentPage: 1,
            totalPages: 2,
            totalCount: 2,
            hasMore: true
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessions: [
            {
              id: 'session-2',
              difficulty: 'B2',
              language: 'en-US',
              topic: 'topic 2',
              accuracy: 90,
              score: 90,
              duration: 100,
              createdAt: '2024-01-02T10:00:00.000Z',
              exerciseData: null
            }
          ],
          pagination: {
            currentPage: 2,
            totalPages: 2,
            totalCount: 2,
            hasMore: false
          }
        })
      })

    vi.stubGlobal('fetch', fetchMock)

    const history = await fetchAllPracticeHistory({ limit: 1 })

    expect(history).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
