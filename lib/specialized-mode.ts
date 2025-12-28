import type { FocusArea } from './types'
import { validateFocusAreas } from './focus-area-utils'

const SPECIALIZED_MODE_STORAGE_KEY = 'english-listening-specialized-mode'
const FOCUS_AREA_CACHE_KEY = 'english-listening-focus-area-cache'

export interface SpecializedModeSettings {
  enabled: boolean
  selectedFocusAreas: FocusArea[]
  updatedAt: string
}

export interface FocusAreaCache {
  stats: Record<string, { attempts: number; incorrect: number; accuracy: number; trend: 'improving' | 'declining' | 'stable' }>
  recommendations: FocusArea[]
  lastCalculated: string
}

export function loadSpecializedModeSettings(): SpecializedModeSettings {
  if (typeof window === 'undefined') {
    return { enabled: false, selectedFocusAreas: [], updatedAt: new Date().toISOString() }
  }

  try {
    const raw = window.localStorage.getItem(SPECIALIZED_MODE_STORAGE_KEY)
    if (!raw) {
      return { enabled: false, selectedFocusAreas: [], updatedAt: new Date().toISOString() }
    }

    const parsed = JSON.parse(raw) as Partial<SpecializedModeSettings>
    const selectedFocusAreas = validateFocusAreas(parsed.selectedFocusAreas)
    return {
      enabled: Boolean(parsed.enabled),
      selectedFocusAreas,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    }
  } catch {
    return { enabled: false, selectedFocusAreas: [], updatedAt: new Date().toISOString() }
  }
}

export function saveSpecializedModeSettings(next: Pick<SpecializedModeSettings, 'enabled' | 'selectedFocusAreas'>): SpecializedModeSettings {
  const normalized: SpecializedModeSettings = {
    enabled: Boolean(next.enabled),
    selectedFocusAreas: validateFocusAreas(next.selectedFocusAreas),
    updatedAt: new Date().toISOString()
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SPECIALIZED_MODE_STORAGE_KEY, JSON.stringify(normalized))
    } catch {
      // Ignore localStorage errors
    }
  }

  return normalized
}

export function loadFocusAreaCache(): FocusAreaCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FOCUS_AREA_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FocusAreaCache
  } catch {
    return null
  }
}

export function saveFocusAreaCache(cache: FocusAreaCache): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FOCUS_AREA_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore
  }
}

