import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MainApp } from '@/components/main-app'
import type { AuthState } from '@/hooks/use-auth-state'

let isMobileValue = false

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}))

vi.mock('@/hooks/use-is-mobile', () => ({
  useIsMobile: () => isMobileValue,
}))

vi.mock('@/hooks/use-legacy-migration', () => ({
  useLegacyMigration: () => ({
    shouldShowNotification: () => false,
  }),
}))

vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/hooks/use-exercise-workflow', () => ({
  useExerciseWorkflow: () => ({
    state: {
      currentStep: 'setup',
      difficulty: 'intermediate',
      duration: 300,
      language: 'en',
      topic: '',
      suggestedTopics: [],
      loading: false,
      loadingMessage: '',
      newsTopicId: null,
      newsTranscriptDurationMinutes: null,
      newsTranscriptMissingDurationMinutes: null,
    },
    wordCount: 0,
    isSetupComplete: false,
    setStep: vi.fn(),
    setDifficulty: vi.fn(),
    setDuration: vi.fn(),
    setLanguage: vi.fn(),
    setTopic: vi.fn(),
    setAnswers: vi.fn(),
    setAssessmentResult: vi.fn(),
    handleGenerateTopics: vi.fn(),
    handleRefreshTopics: vi.fn(),
    handleGenerateTranscript: vi.fn(),
    handleGenerateAudio: vi.fn(),
    handleStartQuestions: vi.fn(),
    handleSubmitAnswers: vi.fn(),
    handleRestart: vi.fn(),
    handleExport: vi.fn(),
    handleRestoreExercise: vi.fn(),
    setTranscript: vi.fn(),
    setNewsTopicId: vi.fn(),
    setNewsTranscriptDurationMinutes: vi.fn(),
    setNewsTranscriptMissingDurationMinutes: vi.fn(),
  }),
}))

vi.mock('@/components/navigation/mobile-navigation', () => ({
  MobileNavigation: () => null,
}))

vi.mock('@/components/app-layout-with-sidebar', () => ({
  AppLayoutWithSidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}))

vi.mock('@/components/home/recommended-topics', () => ({
  RecommendedTopics: () => <div data-testid="recommended-topics" />,
}))

vi.mock('@/components/home/practice-configuration', () => ({
  PracticeConfiguration: () => <div data-testid="practice-configuration" />,
}))

vi.mock('@/components/home/visitor-banner', () => ({
  VisitorBanner: () => null,
}))

const createAuthState = (): AuthState =>
  ({
    user: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      isAdmin: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    isAuthenticated: true,
    isLoading: false,
    showAuthDialog: false,
    handleUserAuthenticated: vi.fn(),
    handleLogout: vi.fn(),
  }) as AuthState

describe('MainApp layout', () => {
  it('does not pin the practice configuration panel on desktop', () => {
    isMobileValue = false
    const { container } = render(<MainApp authState={createAuthState()} />)
    expect(container.querySelector('div.sticky.top-24')).not.toBeInTheDocument()
  })

  it('does not constrain the mobile config panel height', async () => {
    isMobileValue = true
    window.localStorage.setItem('elt.mobile.config.collapsed', 'false')

    render(<MainApp authState={createAuthState()} />)

    const practiceConfig = await screen.findByTestId('practice-configuration')
    const wrapper = practiceConfig.parentElement

    expect(wrapper).not.toHaveClass('overflow-y-auto')
    expect(wrapper?.className).not.toContain('max-h-')
  })
})
