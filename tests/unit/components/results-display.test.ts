import { describe, expect, it } from 'vitest'

import { getExerciseResultSummary } from '@/components/results-display'
import type { Exercise } from '@/lib/types'

function createExercise(overrides: Partial<Exercise> = {}) {
  return {
    id: 'exercise-1',
    difficulty: 'B1',
    language: 'en-US',
    topic: 'Test topic',
    transcript: 'Transcript',
    questions: [],
    answers: {},
    results: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as Exercise & { accuracy?: number | null }
}

describe('getExerciseResultSummary', () => {
  it('uses stored accuracy when detailed results are missing', () => {
    const summary = getExerciseResultSummary(
      createExercise({ accuracy: 0.5 })
    )

    expect(summary.accuracy).toBe(50)
    expect(summary.totalQuestions).toBe(0)
    expect(summary.hasDetailedResults).toBe(false)
  })

  it('calculates accuracy from detailed results when available', () => {
    const summary = getExerciseResultSummary(
      createExercise({
        results: [
          { type: 'single', user_answer: 'A', correct_answer: 'A', is_correct: true },
          { type: 'single', user_answer: 'B', correct_answer: 'C', is_correct: false },
        ],
      })
    )

    expect(summary.accuracy).toBe(50)
    expect(summary.correctAnswers).toBe(1)
    expect(summary.totalQuestions).toBe(2)
    expect(summary.hasDetailedResults).toBe(true)
  })
})
