import type { Exercise } from "./types"

const STORAGE_KEY = "english-listening-history"
const MAX_HISTORY_ITEMS = 10

export function saveToHistory(exercise: Exercise): void {
  try {
    const history = getHistory()

    // Add new exercise to the beginning
    history.unshift(exercise)

    // Keep only the latest MAX_HISTORY_ITEMS
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory))
  } catch (error) {
    console.error("Failed to save to history:", error)
  }
}

export function getHistory(): Exercise[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Failed to load history:", error)
    return []
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Failed to clear history:", error)
  }
}
