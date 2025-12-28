import type { DifficultyLevel } from './types'

export type DifficultyMode = 'auto' | 'manual'

const STORAGE_KEY = 'english-listening-difficulty-mode'
const MANUAL_DIFFICULTY_KEY = 'english-listening-manual-difficulty'

export function loadDifficultyMode(): DifficultyMode {
  if (typeof window === 'undefined') return 'manual'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'auto' || raw === 'manual' ? raw : 'manual'
  } catch {
    return 'manual'
  }
}

export function saveDifficultyMode(mode: DifficultyMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

export function loadManualDifficulty(): DifficultyLevel | '' {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(MANUAL_DIFFICULTY_KEY)
    return raw === 'A1' || raw === 'A2' || raw === 'B1' || raw === 'B2' || raw === 'C1' || raw === 'C2' ? raw : ''
  } catch {
    return ''
  }
}

export function saveManualDifficulty(level: DifficultyLevel | ''): void {
  if (typeof window === 'undefined') return
  try {
    if (!level) {
      window.localStorage.removeItem(MANUAL_DIFFICULTY_KEY)
      return
    }
    window.localStorage.setItem(MANUAL_DIFFICULTY_KEY, level)
  } catch {
    // ignore
  }
}

