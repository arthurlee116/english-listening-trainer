import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AchievementPanel } from '@/components/achievement-panel'

const mockUseSyncedProgressMetrics = vi.fn()

vi.mock('@/hooks/use-synced-progress-metrics', () => ({
  useSyncedProgressMetrics: (options?: unknown) => mockUseSyncedProgressMetrics(options),
}))

vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/components/ui/bilingual-text', () => ({
  BilingualText: ({ translationKey }: { translationKey: string }) => (
    <span>{translationKey}</span>
  ),
}))

vi.mock('@/lib/storage', () => ({
  getGoalSettings: () => ({
    dailyMinutesTarget: 10,
    weeklySessionsTarget: 3,
    lastUpdatedAt: new Date().toISOString(),
  }),
  saveGoalSettings: vi.fn(),
  isStorageAvailable: () => true,
}))

vi.mock('@/lib/achievement-service', () => ({
  calculateGoalProgress: vi.fn(() => null),
  getEarnedAchievements: () => [],
  getAvailableAchievements: () => [],
}))

describe('AchievementPanel', () => {
  it('clears error state when metrics error resolves', async () => {
    const hookState = {
      metrics: null,
      isLoading: false,
      error: 'network error',
    }

    mockUseSyncedProgressMetrics.mockImplementation(() => hookState)

    const { rerender } = render(
      <AchievementPanel isOpen={false} onToggle={vi.fn()} userAuthenticated={true} />
    )

    await waitFor(() => {
      expect(screen.getByText('components.achievementPanel.loadError')).toBeInTheDocument()
    })

    hookState.error = null
    rerender(
      <AchievementPanel isOpen={false} onToggle={vi.fn()} userAuthenticated={true} />
    )

    await waitFor(() => {
      expect(
        screen.queryByText('components.achievementPanel.loadError')
      ).not.toBeInTheDocument()
    })
  })
})
