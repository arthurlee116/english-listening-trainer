import type { Exercise, UserProgressMetrics, UserGoalSettings, AchievementBadge, PracticeSessionData, PracticeNotesEntry } from "./types"

const STORAGE_KEY = "english-listening-history"
const PROGRESS_STORAGE_KEY = "english-listening-progress"
const GOALS_STORAGE_KEY = "english-listening-goals"
const ACHIEVEMENTS_STORAGE_KEY = "english-listening-achievements"
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
    if (entry.sessionId) {
      return `session:${entry.sessionId}`
    }
    return `local:${entry.id}`
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

// =============== Achievement System Storage ===============

// Default progress metrics
function getDefaultProgressMetrics(): UserProgressMetrics {
  return {
    totalSessions: 0,
    totalCorrectAnswers: 0,
    totalQuestions: 0,
    averageAccuracy: 0,
    totalListeningMinutes: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastPracticedAt: null,
    weeklyTrend: []
  }
}

// Default goal settings
function getDefaultGoalSettings(): UserGoalSettings {
  return {
    dailyMinutesTarget: 20,
    weeklySessionsTarget: 5,
    lastUpdatedAt: new Date().toISOString()
  }
}

// Progress metrics storage with retry mechanism
export function saveProgressMetrics(metrics: UserProgressMetrics): void {
  const maxRetries = 3
  let attempts = 0
  
  const attemptSave = () => {
    try {
      // 验证数据完整性
      if (!metrics || typeof metrics.totalSessions !== 'number') {
        throw new Error('Invalid metrics data')
      }
      
      const dataToSave = JSON.stringify(metrics)
      
      // 检查数据大小，避免 localStorage 溢出
      if (dataToSave.length > 100000) { // 100KB 限制
        console.warn('Progress metrics data is too large, truncating weekly trend')
        const truncatedMetrics = {
          ...metrics,
          weeklyTrend: metrics.weeklyTrend.slice(0, 7) // 保持最近7天
        }
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(truncatedMetrics))
      } else {
        localStorage.setItem(PROGRESS_STORAGE_KEY, dataToSave)
      }
    } catch (error) {
      attempts++
      console.error(`Failed to save progress metrics (attempt ${attempts}):`, error)
      
      if (attempts < maxRetries) {
        // 等待一段时间后重试
        setTimeout(attemptSave, 100 * attempts)
      } else {
        console.error('Failed to save progress metrics after all retries')
      }
    }
  }
  
  attemptSave()
}

export function getProgressMetrics(): UserProgressMetrics {
  try {
    const stored = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      
      // 数据验证和修复
      const validatedMetrics = validateAndFixProgressMetrics(parsed)
      
      // Ensure all required fields exist (for backward compatibility)
      return {
        ...getDefaultProgressMetrics(),
        ...validatedMetrics
      }
    }
    return getDefaultProgressMetrics()
  } catch (error) {
    console.error("Failed to load progress metrics:", error)
    
    // 在错误情况下返回默认值，保证应用不崩溃
    return getDefaultProgressMetrics()
  }
}

// 数据验证和修复函数
function validateAndFixProgressMetrics(metrics: unknown): UserProgressMetrics {
  // First, ensure metrics is an object
  if (typeof metrics !== 'object' || metrics === null || Array.isArray(metrics)) {
    console.warn('Invalid metrics object, using defaults')
    return getDefaultProgressMetrics()
  }

  const metricsObj = metrics as Record<string, unknown>
  const defaultMetrics = getDefaultProgressMetrics()
  
  // Define numeric fields with their default values
  const numericFields: Array<{ key: keyof UserProgressMetrics; defaultValue: number }> = [
    { key: 'totalSessions', defaultValue: 0 },
    { key: 'totalCorrectAnswers', defaultValue: 0 },
    { key: 'totalQuestions', defaultValue: 0 },
    { key: 'averageAccuracy', defaultValue: 0 },
    { key: 'totalListeningMinutes', defaultValue: 0 },
    { key: 'currentStreakDays', defaultValue: 0 },
    { key: 'longestStreakDays', defaultValue: 0 }
  ]
  
  numericFields.forEach(({ key, defaultValue }) => {
    const value = metricsObj[key]
    if (typeof value !== 'number' || isNaN(value)) {
      console.warn(`Invalid ${String(key)} value, using default: ${defaultValue}`)
      ;(metricsObj as Record<string, unknown>)[key] = defaultValue
    } else if ((metricsObj[key] as number) < 0) {
      console.warn(`Negative ${String(key)} value, setting to 0`)
      ;(metricsObj as Record<string, unknown>)[key] = 0
    }
  })
  
  // Validate weeklyTrend array
  if (!Array.isArray(metricsObj.weeklyTrend)) {
    console.warn('Invalid weeklyTrend, using default')
    ;(metricsObj as Record<string, unknown>).weeklyTrend = defaultMetrics.weeklyTrend
  } else {
    // Limit array size to prevent memory issues
    ;(metricsObj as Record<string, unknown>).weeklyTrend = (metricsObj.weeklyTrend as unknown[]).slice(0, 7)
  }
  
  // Validate averageAccuracy range
  const avgAccuracy = metricsObj.averageAccuracy
  if (typeof avgAccuracy === 'number' && avgAccuracy > 100) {
    console.warn('Average accuracy exceeds 100%, capping at 100')
    ;(metricsObj as Record<string, unknown>).averageAccuracy = 100
  }
  
  return metricsObj as unknown as UserProgressMetrics
}

// Goal settings storage
export function saveGoalSettings(settings: UserGoalSettings): void {
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Failed to save goal settings:", error)
  }
}

export function getGoalSettings(): UserGoalSettings {
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...getDefaultGoalSettings(),
        ...parsed
      } as UserGoalSettings
    }
    return getDefaultGoalSettings()
  } catch (error) {
    console.error("Failed to load goal settings:", error)
    return getDefaultGoalSettings()
  }
}

// Achievement badges storage
export function saveAchievements(achievements: AchievementBadge[]): void {
  try {
    // Limit storage to prevent localStorage overflow
    const trimmedAchievements = achievements.slice(0, 50)
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(trimmedAchievements))
  } catch (error) {
    console.error("Failed to save achievements:", error)
  }
}

export function getAchievements(): AchievementBadge[] {
  try {
    const stored = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Failed to load achievements:", error)
    return []
  }
}

// Update single achievement (mark as earned)
export function markAchievementEarned(achievementId: string): void {
  try {
    const achievements = getAchievements()
    const achievement = achievements.find(a => a.id === achievementId)
    if (achievement && !achievement.earnedAt) {
      achievement.earnedAt = new Date().toISOString()
      saveAchievements(achievements)
    }
  } catch (error) {
    console.error("Failed to mark achievement as earned:", error)
  }
}

// Clear all achievement system data (for debugging/reset)
export function clearAchievementData(): void {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY)
    localStorage.removeItem(GOALS_STORAGE_KEY)
    localStorage.removeItem(ACHIEVEMENTS_STORAGE_KEY)
  } catch (error) {
    console.error("Failed to clear achievement data:", error)
  }
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

// Export practice session data for achievement calculation
export function convertExerciseToSessionData(exercise: Exercise): PracticeSessionData {
  const correctAnswers = exercise.results.filter(r => r.is_correct).length
  const accuracy = (correctAnswers / exercise.results.length) * 100
  
  // Calculate practice duration with priority fallback
  let durationInSeconds = 0
  
  // Prefer the standardized totalDurationSec when provided
  if (typeof exercise.totalDurationSec === 'number' && exercise.totalDurationSec > 0) {
    durationInSeconds = exercise.totalDurationSec
  } else {
    // Fallback: calculate from creation time to now (or use a reasonable estimate)
    const createdAt = new Date(exercise.createdAt)
    const now = new Date()
    const timeDiffSeconds = Math.round((now.getTime() - createdAt.getTime()) / 1000)
    
    // Use time difference if reasonable (between 30 seconds and 30 minutes)
    if (timeDiffSeconds >= 30 && timeDiffSeconds <= 1800) {
      durationInSeconds = timeDiffSeconds
    } else {
      // Use a reasonable default based on exercise content
      const wordCount = exercise.transcript.split(/\s+/).length
      const estimatedDuration = Math.max(60, Math.min(300, wordCount * 2)) // 2 seconds per word, 1-5 minutes range
      durationInSeconds = estimatedDuration
    }
  }
  
  return {
    sessionId: exercise.id,
    difficulty: exercise.difficulty,
    language: exercise.language,
    topic: exercise.topic,
    accuracy: Math.round(accuracy * 100) / 100, // 保留两位小数
    duration: durationInSeconds, // Use calculated duration in seconds
    questionsCount: exercise.questions.length,
    correctAnswersCount: correctAnswers,
    completedAt: exercise.createdAt
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
