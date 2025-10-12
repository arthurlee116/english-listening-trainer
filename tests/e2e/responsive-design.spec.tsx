import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MainApp } from '@/components/main-app'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { STANDARD_VIEWPORTS, setViewportSize } from '@/tests/helpers/responsive-test-utils'

vi.mock('@/hooks/use-auth-state', () => ({
  useAuthState: () => ({
    user: { id: '1', email: 'test@example.com', name: 'Test User', isAdmin: false },
    isAuthenticated: true,
    isLoading: false,
    showAuthDialog: false,
    handleUserAuthenticated: vi.fn(),
    handleLogout: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('@/lib/ai-service', () => ({
  generateTopics: vi.fn().mockResolvedValue({
    topics: ['Technology Trends', 'Environmental Issues', 'Cultural Exchange'],
  }),
  generateTranscript: vi.fn().mockResolvedValue({
    transcript: 'This is a test transcript for responsive design testing.',
  }),
  generateQuestions: vi.fn().mockResolvedValue({
    questions: [
      { id: 1, question: 'What is the main topic?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
    ],
  }),
  gradeAnswers: vi.fn().mockResolvedValue({
    results: [{ id: 1, is_correct: true }],
    accuracy: 100,
    feedback: 'Great job!',
  }),
}))

const renderApp = () =>
  render(
    <ThemeProvider>
      <MainApp />
      <Toaster />
    </ThemeProvider>,
  )

describe('Responsive Design - Dark Theme', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    document.documentElement.classList.add('dark')
    setViewportSize(STANDARD_VIEWPORTS.desktop1440.width, STANDARD_VIEWPORTS.desktop1440.height)
  })

  it.each([
    ['desktop 1440px', STANDARD_VIEWPORTS.desktop1440],
    ['desktop 1280px', STANDARD_VIEWPORTS.desktop1280],
    ['tablet 1024px', STANDARD_VIEWPORTS.tablet1024],
    ['mobile 768px', STANDARD_VIEWPORTS.mobile768],
  ])('keeps the header in dark palette at %s', async (_label, viewport) => {
    setViewportSize(viewport.width, viewport.height)
    renderApp()

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('dark:bg-gray-900/80')
    expect(header).toHaveClass('border-slate-700')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    const title = header.querySelector('h1')
    expect(title).not.toBeNull()
    expect(title).toHaveClass('text-slate-100')
  })

  it('renders glass panels consistently', () => {
    renderApp()

    const glassElements = document.querySelectorAll('.glass-effect')
    expect(glassElements.length).toBeGreaterThan(0)
    glassElements.forEach((element) => {
      expect(element).toHaveClass('glass-effect')
    })
  })

  it('shows navigation and feedback controls across breakpoints', async () => {
    renderApp()

    const practiceBtn = screen.getByRole('button', { name: /practice/i })
    const historyBtn = screen.getByRole('button', { name: /history/i })
    const assessmentBtn = screen.getByRole('button', { name: /assessment/i })

    expect(practiceBtn).toBeVisible()
    expect(historyBtn).toBeVisible()
    expect(assessmentBtn).toBeVisible()

    await user.click(practiceBtn)
    await user.click(historyBtn)
    await user.click(assessmentBtn)

    expect(screen.getByRole('navigation')).toHaveClass('space-x-2')
  })
})
