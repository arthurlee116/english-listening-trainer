import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

import { AchievementPanel } from '@/components/achievement-panel'
import type { AchievementBadge, UserGoalSettings, UserProgressMetrics } from '@/lib/types'
import achievementsTranslations from '@/lib/i18n/translations/achievements.json'
import { bilingualConfig } from '@/lib/i18n/types'
import { clearTranslationCache } from '@/hooks/use-bilingual-text'

const {
  getProgressMetricsMock,
  getGoalSettingsMock,
  saveGoalSettingsMock,
  isStorageAvailableMock,
  calculateGoalProgressMock,
  getEarnedAchievementsMock,
  getAvailableAchievementsMock,
} = vi.hoisted(() => ({
  getProgressMetricsMock: vi.fn<[], UserProgressMetrics | null>(),
  getGoalSettingsMock: vi.fn<[], UserGoalSettings | null>(),
  saveGoalSettingsMock: vi.fn(),
  isStorageAvailableMock: vi.fn<[], boolean>(),
  calculateGoalProgressMock: vi.fn(),
  getEarnedAchievementsMock: vi.fn<[], AchievementBadge[]>(),
  getAvailableAchievementsMock: vi.fn<[], AchievementBadge[]>(),
}))

vi.mock('@/lib/storage', () => ({
  getProgressMetrics: getProgressMetricsMock,
  getGoalSettings: getGoalSettingsMock,
  saveGoalSettings: saveGoalSettingsMock,
  isStorageAvailable: isStorageAvailableMock,
}))

vi.mock('@/lib/achievement-service', () => ({
  calculateGoalProgress: calculateGoalProgressMock,
  getEarnedAchievements: getEarnedAchievementsMock,
  getAvailableAchievements: getAvailableAchievementsMock,
}))

const achievementsJson = achievementsTranslations as Record<string, unknown>
const achievementsJsonSection = (achievementsJson['achievements'] as Record<string, unknown>) || {}

const walkPath = (base: Record<string, unknown>, path: string[]): unknown => {
  return path.reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment]
    }
    return undefined
  }, base)
}

const resolveTranslation = (key: string): { en: string; zh: string } | null => {
  const direct = walkPath(achievementsJson, key.split('.'))
  if (direct && typeof direct === 'object' && 'en' in direct && 'zh' in direct) {
    return direct as { en: string; zh: string }
  }

  if (key.startsWith('achievements.')) {
    const remainder = key.substring(13)
    const base = remainder.startsWith('notifications.') || remainder.startsWith('dashboard.')
      ? achievementsJson
      : achievementsJsonSection
    const fallback = walkPath(base, remainder.split('.'))

    if (fallback && typeof fallback === 'object' && 'en' in fallback && 'zh' in fallback) {
      return fallback as { en: string; zh: string }
    }
  }

  return null
}

const getExpectedText = (key: string): string => {
  const translation = resolveTranslation(key)
  if (!translation) {
    throw new Error(`Missing translation for key ${key}`)
  }

  return `${translation.en}${bilingualConfig.separator}${translation.zh}`
}

describe('AchievementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTranslationCache()

    const mockMetrics: UserProgressMetrics = {
      totalSessions: 5,
      totalCorrectAnswers: 20,
      totalQuestions: 25,
      averageAccuracy: 80,
      totalListeningMinutes: 60,
      currentStreakDays: 3,
      longestStreakDays: 5,
      lastPracticedAt: new Date().toISOString(),
      weeklyTrend: [
        { date: new Date().toISOString().split('T')[0], sessions: 2 },
        { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], sessions: 1 },
      ],
    }

    const mockGoals: UserGoalSettings = {
      dailyMinutesTarget: 30,
      weeklySessionsTarget: 5,
      lastUpdatedAt: new Date().toISOString(),
    }

    getProgressMetricsMock.mockReturnValue(mockMetrics)
    getGoalSettingsMock.mockReturnValue(mockGoals)
    saveGoalSettingsMock.mockImplementation(() => {})
    isStorageAvailableMock.mockReturnValue(true)

    calculateGoalProgressMock.mockReturnValue({
      daily: { target: 30, current: 15, isCompleted: false },
      weekly: { target: 5, current: 2, isCompleted: false },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders achievement text using translations for earned and available badges', async () => {
    const earned: AchievementBadge = {
      id: 'first-session',
      titleKey: 'achievements.firstSession.title',
      descriptionKey: 'achievements.firstSession.desc',
      earnedAt: '2024-01-01T00:00:00.000Z',
      conditions: { type: 'sessions', threshold: 1 },
    }

    const available: AchievementBadge = {
      id: 'goal-complete',
      titleKey: 'achievements.notifications.goalCompleted.title',
      descriptionKey: 'achievements.notifications.goalCompleted.dailyGoal',
      conditions: { type: 'sessions', threshold: 5 },
    }

    getEarnedAchievementsMock.mockReturnValue([earned])
    getAvailableAchievementsMock.mockReturnValue([available])

    render(
      <AchievementPanel
        isOpen
        onToggle={() => {}}
        userAuthenticated
      />
    )

    const expectedEarnedTitle = getExpectedText(earned.titleKey)
    const expectedEarnedDescription = getExpectedText(earned.descriptionKey)
    const expectedAvailableTitle = getExpectedText(available.titleKey)
    const expectedAvailableDescription = getExpectedText(available.descriptionKey)

    await waitFor(() => {
      expect(screen.getByText(expectedEarnedTitle)).toBeInTheDocument()
      expect(screen.getByText(expectedEarnedDescription)).toBeInTheDocument()
      expect(screen.getByText(expectedAvailableTitle)).toBeInTheDocument()
      expect(screen.getByText(expectedAvailableDescription)).toBeInTheDocument()
    })
  })
})
