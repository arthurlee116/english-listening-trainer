import { FOCUS_AREA_LIST, type FocusArea, type WrongAnswerItem } from './types'

export type FocusAreaStats = Record<
  FocusArea,
  {
    attempts: number
    incorrect: number
    accuracy: number
    lastAttempt?: string
    trend: 'improving' | 'declining' | 'stable'
  }
>

export interface PracticeSession {
  id: string
  difficulty: string
  language: string
  topic: string
  accuracy: number
  createdAt: string
  exerciseData: string | null
}

function createEmptyStat(): FocusAreaStats[FocusArea] {
  return {
    attempts: 0,
    incorrect: 0,
    accuracy: 0,
    trend: 'stable'
  }
}

export function getDefaultStats(): FocusAreaStats {
  return FOCUS_AREA_LIST.reduce((acc, focus) => {
    acc[focus] = createEmptyStat()
    return acc
  }, {} as FocusAreaStats)
}

export function getDefaultRecommendations(): FocusArea[] {
  // Default to the core comprehension skills to guide new users
  return ['main-idea', 'detail-comprehension', 'inference']
}

interface ParsedExerciseData {
  focusAreas?: FocusArea[]
  questions?: Array<{ focus_areas?: FocusArea[] }>
}

function parseExerciseData(raw: string | null): ParsedExerciseData | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ParsedExerciseData
  } catch (error) {
    console.warn('Failed to parse practiceSession.exerciseData', error)
    return null
  }
}

function roundAccuracy(value: number): number {
  return Math.round(value * 10) / 10
}

function updateTrend(
  previous: number | undefined,
  current: number
): 'improving' | 'declining' | 'stable' {
  if (previous === undefined) return 'stable'
  const delta = current - previous
  if (delta > 5) return 'improving'
  if (delta < -5) return 'declining'
  return 'stable'
}

export function computeFocusStats(
  wrongAnswers: WrongAnswerItem[],
  sessions: PracticeSession[]
): FocusAreaStats {
  const stats = getDefaultStats()

  // Track per-session accuracy for trend calculation
  const perAreaSessionAccuracy: Record<FocusArea, number[]> = FOCUS_AREA_LIST.reduce(
    (acc, area) => {
      acc[area] = []
      return acc
    },
    {} as Record<FocusArea, number[]>
  )

  sessions.forEach((session) => {
    const parsed = parseExerciseData(session.exerciseData)
    const focusAreas =
      parsed?.focusAreas ??
      parsed?.questions?.flatMap((q) => q.focus_areas ?? [])?.filter(Boolean)

    if (!focusAreas || focusAreas.length === 0) {
      return
    }

    focusAreas.forEach((area) => {
      if (!stats[area]) return
      stats[area].attempts += 1
      stats[area].lastAttempt = session.createdAt
      perAreaSessionAccuracy[area].push(session.accuracy)
    })
  })

  wrongAnswers.forEach((wrongAnswer) => {
    const focusAreas = wrongAnswer.question.focus_areas ?? []
    focusAreas.forEach((area) => {
      if (!stats[area]) return
      stats[area].incorrect += 1
      stats[area].attempts += 1
      stats[area].lastAttempt = wrongAnswer.answer.attemptedAt
    })
  })

  FOCUS_AREA_LIST.forEach((area) => {
    const { attempts, incorrect } = stats[area]
    const correct = Math.max(attempts - incorrect, 0)
    stats[area].accuracy = attempts > 0 ? roundAccuracy((correct / attempts) * 100) : 0

    const history = perAreaSessionAccuracy[area]
    stats[area].trend = updateTrend(history[0], history[history.length - 1])
  })

  return stats
}

export function selectRecommendedFocusAreas(
  stats: Partial<FocusAreaStats>,
  limit = 3
): FocusArea[] {
  const scored = Object.entries(stats).flatMap(([area, data]) => {
    if (!data) return []
    if (data.attempts < 3) return []
    const errorRate = data.attempts === 0 ? 0 : data.incorrect / data.attempts
    const trendPenalty = data.trend === 'declining' ? 0.1 : data.trend === 'improving' ? -0.05 : 0
    const recencyBoost = data.lastAttempt ? 0.05 : 0
    const priorityScore = errorRate + trendPenalty + recencyBoost
    return [{ area: area as FocusArea, score: priorityScore }]
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((entry) => entry.area)
}
