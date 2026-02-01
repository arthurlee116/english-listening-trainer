import type { DifficultyLevel, Exercise, ListeningLanguage } from '@/lib/types'
import type { ExerciseHistoryEntry } from '@/lib/storage'

export interface PracticeHistorySession {
  id: string
  difficulty: DifficultyLevel
  language: ListeningLanguage
  topic: string
  accuracy?: number | null
  score?: number | null
  duration?: number | null
  createdAt: string
  exerciseData: Exercise | null
}

export interface PracticeHistoryResponse {
  sessions: PracticeHistorySession[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasMore: boolean
  }
}

const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_COUNT = 200

export function mapSessionToExercise(session: PracticeHistorySession): ExerciseHistoryEntry {
  if (session.exerciseData && typeof session.exerciseData === 'object') {
    return {
      ...session.exerciseData,
      createdAt: session.exerciseData.createdAt || session.createdAt,
      totalDurationSec: session.exerciseData.totalDurationSec ?? session.duration ?? undefined,
      sessionId: session.id
    }
  }

  return {
    id: session.id,
    difficulty: session.difficulty,
    language: session.language,
    topic: session.topic || 'Untitled',
    transcript: '',
    questions: [],
    answers: {},
    results: [],
    createdAt: session.createdAt,
    totalDurationSec: session.duration ?? undefined,
    sessionId: session.id
  }
}

export async function fetchPracticeHistoryPage(page: number, limit: number): Promise<PracticeHistoryResponse> {
  const response = await fetch(`/api/practice/history?page=${page}&limit=${limit}`, {
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(`History request failed with status ${response.status}`)
  }

  return (await response.json()) as PracticeHistoryResponse
}

export async function fetchAllPracticeHistory({
  limit = DEFAULT_PAGE_LIMIT,
  maxPages = MAX_PAGE_COUNT
}: {
  limit?: number
  maxPages?: number
} = {}): Promise<ExerciseHistoryEntry[]> {
  const allHistory: ExerciseHistoryEntry[] = []
  let page = 1
  let hasMore = true
  let totalPages = 1

  while (hasMore && page <= maxPages && page <= totalPages) {
    const data = await fetchPracticeHistoryPage(page, limit)
    const sessions = Array.isArray(data.sessions) ? data.sessions : []
    allHistory.push(...sessions.map(mapSessionToExercise))

    totalPages = data.pagination?.totalPages ?? totalPages
    hasMore = Boolean(data.pagination?.hasMore)
    page += 1
  }

  return allHistory
}
