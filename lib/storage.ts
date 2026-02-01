import type { Exercise, PracticeNotesEntry } from "./types"

const STORAGE_KEY = "english-listening-history"
const NOTES_STORAGE_KEY = "english-listening-notes"
const MAX_HISTORY_ITEMS = 10

export type ExerciseHistoryEntry = Exercise & { sessionId?: string }

interface MergePracticeHistoryOptions {
  serverHistory: ExerciseHistoryEntry[]
  localHistory: ExerciseHistoryEntry[]
  pageSize?: number
}

// =============== Exercise History Storage ===============

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

export function mergePracticeHistory({
  serverHistory,
  localHistory,
  pageSize = MAX_HISTORY_ITEMS
}: MergePracticeHistoryOptions): ExerciseHistoryEntry[] {
  const merged = mergeHistoryEntries({ serverHistory, localHistory })
  return merged.slice(0, pageSize)
}

interface MergeHistoryEntriesOptions {
  serverHistory: ExerciseHistoryEntry[]
  localHistory: ExerciseHistoryEntry[]
}

export function mergeHistoryEntries({
  serverHistory,
  localHistory
}: MergeHistoryEntriesOptions): ExerciseHistoryEntry[] {
  const merged: ExerciseHistoryEntry[] = []
  const seen = new Set<string>()

  const normalizeKey = (entry: ExerciseHistoryEntry): string => {
    // 使用主题和创建时间（容差10秒）作为匹配键，以识别本地与服务器同步后的同一条记录
    // 这样 serverHistory (先处理) 会占位，后续重复的 localHistory 会被去重
    const time = Math.floor(new Date(entry.createdAt).getTime() / 10000) // 10秒容差
    return `match:${entry.topic}-${time}`
  }

  const addEntry = (entry: ExerciseHistoryEntry) => {
    const key = normalizeKey(entry)
    if (seen.has(key)) return
    seen.add(key)
    merged.push(entry)
  }

  serverHistory.forEach(addEntry)
  localHistory.forEach(addEntry)

  merged.sort((a, b) => {
    const aTime = Number.isNaN(Date.parse(a.createdAt)) ? 0 : Date.parse(a.createdAt)
    const bTime = Number.isNaN(Date.parse(b.createdAt)) ? 0 : Date.parse(b.createdAt)
    return bTime - aTime
  })

  return merged
}

// Check if localStorage is available
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

// =============== Practice Notes Storage ===============
const MAX_NOTES = 100
const MAX_NOTE_LENGTH = 2000

function readAllNotes(): PracticeNotesEntry[] {
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY)
    if (!stored) return []
    const list = JSON.parse(stored) as unknown as PracticeNotesEntry[]
    return Array.isArray(list) ? list : []
  } catch (error) {
    console.error('Failed to parse notes:', error)
    return []
  }
}

function writeAllNotes(list: PracticeNotesEntry[]): void {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(list))
  } catch (error) {
    console.error('Failed to save notes:', error)
  }
}

export function getPracticeNote(exerciseId: string): string {
  try {
    const list = readAllNotes()
    const entry = list.find(n => n.exerciseId === exerciseId)
    return entry?.note ?? ''
  } catch (error) {
    console.error('Failed to get practice note:', error)
    return ''
  }
}

export function savePracticeNote(exerciseId: string, note: string): boolean {
  try {
    if (typeof note !== 'string') note = String(note ?? '')
    if (note.length > MAX_NOTE_LENGTH) {
      console.warn(`Note length exceeds ${MAX_NOTE_LENGTH} characters`)
      return false
    }

    const list = readAllNotes()
    const now = new Date().toISOString()
    const idx = list.findIndex(n => n.exerciseId === exerciseId)
    if (idx >= 0) {
      list[idx] = { exerciseId, note, updatedAt: now }
    } else {
      list.unshift({ exerciseId, note, updatedAt: now })
      if (list.length > MAX_NOTES) {
        // 删除最旧记录（列表末尾）
        list.pop()
      }
    }
    writeAllNotes(list)
    return true
  } catch (error) {
    console.error('Failed to save practice note:', error)
    return false
  }
}

export function deletePracticeNote(exerciseId: string): boolean {
  try {
    const list = readAllNotes()
    const next = list.filter(n => n.exerciseId !== exerciseId)
    writeAllNotes(next)
    return next.length !== list.length
  } catch (error) {
    console.error('Failed to delete practice note:', error)
    return false
  }
}
