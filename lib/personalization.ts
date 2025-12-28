import type { DifficultyLevel, FocusArea } from './types'
import { getDifficultyRange, mapDifficultyToCEFR } from './difficulty-service'

const PERSONALIZATION_STORAGE_KEY = 'english-listening-personalization'

export interface PersonalizationState {
  difficultyLevel: number // 1-30
  updatedAt: string
}

export interface PersonalizationSnapshot {
  difficultyLevel: number
  difficultyRange: ReturnType<typeof getDifficultyRange>
  cefr: DifficultyLevel
  updatedAt: string
}

export function loadPersonalization(): PersonalizationSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersonalizationState>
    if (!parsed || typeof parsed.difficultyLevel !== 'number') return null
    const difficultyLevel = clampDifficultyLevel(parsed.difficultyLevel)
    return {
      difficultyLevel,
      difficultyRange: getDifficultyRange(difficultyLevel),
      cefr: mapDifficultyToCEFR(difficultyLevel) as DifficultyLevel,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    }
  } catch {
    return null
  }
}

export function savePersonalization(difficultyLevel: number): PersonalizationSnapshot {
  const normalized = clampDifficultyLevel(difficultyLevel)
  const state: PersonalizationState = {
    difficultyLevel: normalized,
    updatedAt: new Date().toISOString()
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore storage errors
    }
  }

  return {
    difficultyLevel: normalized,
    difficultyRange: getDifficultyRange(normalized),
    cefr: mapDifficultyToCEFR(normalized) as DifficultyLevel,
    updatedAt: state.updatedAt
  }
}

export function adjustDifficultyLevel(current: number, accuracy: number): number {
  const normalizedAccuracy = Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : 0
  // Target around 75%: below => easier, above => harder
  const error = normalizedAccuracy - 0.75
  const rawDelta = Math.round(error * 10) // ~[-8..+2] typical
  const delta = Math.max(-3, Math.min(3, rawDelta))
  return clampDifficultyLevel(current + delta)
}

function clampDifficultyLevel(level: number): number {
  if (!Number.isFinite(level)) return 11
  return Math.max(1, Math.min(30, Math.round(level)))
}

// Keep exported type imports used (FocusArea is referenced by other modules that may extend personalization later).
export type { FocusArea }

