import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearHistory,
  deletePracticeNote,
  getHistory,
  getPracticeNote,
  isStorageAvailable,
  mergeHistoryEntries,
  mergePracticeHistory,
  savePracticeNote,
  saveToHistory
} from '../../lib/storage'
import type { Exercise } from '../../lib/types'
import type { ExerciseHistoryEntry } from '../../lib/storage'

describe('storage utilities (history + notes)', () => {
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

  it('merges all history entries without trimming', () => {
    const serverHistory: ExerciseHistoryEntry[] = [
      {
        id: 'server-1',
        difficulty: 'B1',
        language: 'en-US',
        topic: 'server topic',
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
        topic: 'local topic',
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

    const merged = mergeHistoryEntries({ serverHistory, localHistory })

    expect(merged).toHaveLength(3)
    expect(merged[0].id).toBe('local-1')
    expect(merged[1].id).toBe('server-1')
    expect(merged[2].id).toBe('local-2')
  })

  it('saves and deletes practice notes', () => {
    const okSave = savePracticeNote('ex-1', 'note')
    expect(okSave).toBe(true)
    expect(getPracticeNote('ex-1')).toBe('note')

    const okDelete = deletePracticeNote('ex-1')
    expect(okDelete).toBe(true)
    expect(getPracticeNote('ex-1')).toBe('')
  })

  it('handles storage availability checks', () => {
    expect(isStorageAvailable()).toBe(true)
  })
})
