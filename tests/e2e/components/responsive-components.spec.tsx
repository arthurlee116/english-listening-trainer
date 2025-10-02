/**
 * Component-Specific Responsive Design Tests
 * Tests individual components for responsive behavior and light theme consistency
 * Requirements: 4.1, 4.2, 7.1, 7.2, 7.3, 7.4
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ThemeProvider } from 'next-themes'
import { AudioPlayer } from '@/components/audio-player'
import { QuestionInterface } from '@/components/question-interface'
import { ResultsDisplay } from '@/components/results-display'
import { HistoryPanel } from '@/components/history-panel'
import { setViewportSize, STANDARD_VIEWPORTS, testAcrossViewports } from '@/tests/helpers/responsive-test-utils'
import type { Question, Exercise } from '@/lib/types'

// Mock dependencies
vi.mock('@/lib/tts-service', () => ({
  generateAudio: vi.fn().mockResolvedValue({
    audioUrl: 'mock-audio-url',
    duration: 120
  })
}))

vi.mock('@/lib/storage', () => ({
  getHistory: vi.fn().mockResolvedValue([]),
  saveToHistory: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined)
}))

// Test data
const mockQuestions: Question[] = [
  {
    id: 1,
    question: 'What is the main topic of the conversation?',
    options: ['Technology', 'Environment', 'Education', 'Health'],
    correctAnswer: 'Technology'
  },
  {
    id: 2,
    question: 'How long did the discussion last?',
    options: ['10 minutes', '15 minutes', '20 minutes', '25 minutes'],
    correctAnswer: '15 minutes'
  }
]

const mockExercise: Exercise = {
  id: '1',
  difficulty: 'B1',
  language: 'en-US',
  topic: 'Technology Trends',
  transcript: 'This is a test transcript about technology trends.',
  questions: mockQuestions,
  answers: { 1: 'Technology', 2: '15 minutes' },
  results: {
    score: 100,
    feedback: 'Excellent work!',
    correctAnswers: 2,
    totalQuestions: 2
  },
  createdAt: new Date().toISOString()
}

const renderWithLightTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {component}
    </ThemeProvider>
  )
}

describe('AudioPlayer Responsive Tests', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  })

  it('should maintain layout across all viewports', async () => {
    const viewports = Object.values(STANDARD_VIEWPORTS)
    
    await testAcrossViewports(viewports, async (viewport) => {
      renderWithLightTheme(
        <AudioPlayer
          transcript="Test transcript for responsive testing"
          difficulty="B1"
          topic="Test Topic"
          wordCount={240}
          audioUrl=""
          audioError={false}
          onGenerateAudio={vi.fn()}
          onStartQuestions={vi.fn()}
          loading={false}
          loadingMessage=""
        />
      )

      // Check main container
      const container = screen.getByRole('region', { name: /listening.*exercise/i })
      expect(container).toBeInTheDocument()

      // Verify light theme styling
      const card = container.closest('[class*="glass-effect"]')
      expect(card).toBeInTheDocument()

      // Check transcript area
      const transcript = screen.getByText(/Test transcript/)
      expect(transcript).toBeInTheDocument()

      // Verify buttons are accessible
      const generateAudioBtn = screen.getByRole('button', { name: /Generate Audio/i })
      expect(generateAudioBtn).toBeVisible()

      screen.unmount?.()
    })
  })

  it('should handle audio controls responsively', async () => {
    await testAcrossViewports([STANDARD_VIEWPORTS.mobile768, STANDARD_VIEWPORTS.desktop1440], async (viewport) => {
      renderWithLightTheme(
        <AudioPlayer
          transcript="Test transcript"
          difficulty="B1"
          topic="Test Topic"
          wordCount={240}
          audioUrl="mock-audio-url"
          audioError={false}
          onGenerateAudio={vi.fn()}
          onStartQuestions={vi.fn()}
          loading={false}
          loadingMessage=""
        />
      )

      // Check audio controls are visible
      const audioElement = document.querySelector('audio')
      expect(audioElement).toBeInTheDocument()

      // Verify control buttons
      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      expect(startQuestionsBtn).toBeVisible()

      screen.unmount?.()
    })
  })
})

describe('QuestionInterface Responsive Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  })

  it('should display questions properly across viewports', async () => {
    await testAcrossViewports(Object.values(STANDARD_VIEWPORTS), async (viewport) => {
      renderWithLightTheme(
        <QuestionInterface
          questions={mockQuestions}
          answers={{}}
          onAnswerChange={vi.fn()}
          onSubmit={vi.fn()}
          loading={false}
          loadingMessage=""
          audioUrl="mock-audio-url"
          transcript="Test transcript"
        />
      )

      // Check questions are displayed
      expect(screen.getByText(/What is the main topic/)).toBeInTheDocument()
      expect(screen.getByText(/How long did the discussion/)).toBeInTheDocument()

      // Verify answer options are visible
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Environment')).toBeInTheDocument()

      // Check submit button
      const submitBtn = screen.getByRole('button', { name: /Submit Answers/i })
      expect(submitBtn).toBeVisible()

      screen.unmount?.()
    })
  })

  it('should handle answer selection on mobile', async () => {
    setViewportSize(STANDARD_VIEWPORTS.mobile768.width, STANDARD_VIEWPORTS.mobile768.height)
    
    const onAnswerChange = vi.fn()
    
    renderWithLightTheme(
      <QuestionInterface
        questions={mockQuestions}
        answers={{}}
        onAnswerChange={onAnswerChange}
        onSubmit={vi.fn()}
        loading={false}
        loadingMessage=""
        audioUrl="mock-audio-url"
        transcript="Test transcript"
      />
    )

    // Test answer selection on mobile
    const technologyOption = screen.getByText('Technology')
    await user.click(technologyOption)

    // Verify the answer change was called
    expect(onAnswerChange).toHaveBeenCalled()
  })
})

describe('ResultsDisplay Responsive Tests', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  })

  it('should display results consistently across viewports', async () => {
    await testAcrossViewports(Object.values(STANDARD_VIEWPORTS), async (viewport) => {
      renderWithLightTheme(
        <ResultsDisplay
          exercise={mockExercise}
          onRestart={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // Check score display
      const scoreElement = screen.getByText(/Score|得分/)
      expect(scoreElement).toBeInTheDocument()

      // Verify feedback is shown
      expect(screen.getByText(/Excellent work!/)).toBeInTheDocument()

      // Check action buttons
      const restartBtn = screen.getByRole('button', { name: /restart|重新开始/i })
      const exportBtn = screen.getByRole('button', { name: /export|导出/i })
      
      expect(restartBtn).toBeVisible()
      expect(exportBtn).toBeVisible()

      screen.unmount?.()
    })
  })

  it('should maintain light theme styling in results', async () => {
    setViewportSize(STANDARD_VIEWPORTS.desktop1440.width, STANDARD_VIEWPORTS.desktop1440.height)
    
    renderWithLightTheme(
      <ResultsDisplay
        exercise={mockExercise}
        onRestart={vi.fn()}
        onExport={vi.fn()}
      />
    )

    // Check for light theme classes
    const container = screen.getByText(/Score|得分/).closest('[class*="glass-effect"]')
    expect(container).toBeInTheDocument()

    // Verify no dark theme classes are applied
    const darkElements = document.querySelectorAll('[class*="dark:"]')
    darkElements.forEach(element => {
      const classList = Array.from(element.classList)
      const activeDarkClasses = classList.filter(cls => 
        cls.startsWith('dark:') && !cls.includes('dark:hover') && !cls.includes('dark:focus')
      )
      expect(activeDarkClasses).toHaveLength(0)
    })
  })
})

describe('HistoryPanel Responsive Tests', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  })

  it('should display history items responsively', async () => {
    await testAcrossViewports([STANDARD_VIEWPORTS.mobile768, STANDARD_VIEWPORTS.desktop1440], async (viewport) => {
      renderWithLightTheme(
        <HistoryPanel
          onBack={vi.fn()}
          onRestore={vi.fn()}
        />
      )

      // Check back button
      const backBtn = screen.getByRole('button', { name: /back|返回/i })
      expect(backBtn).toBeVisible()

      // Check main heading
      const heading = screen.getByRole('heading', { name: /history|历史记录/i })
      expect(heading).toBeInTheDocument()

      screen.unmount?.()
    })
  })
})

describe('Cross-Component Integration Tests', () => {
  it('should maintain consistent styling across all components', async () => {
    const components = [
      {
        name: 'AudioPlayer',
        component: (
          <AudioPlayer
            transcript="Test"
            difficulty="B1"
            topic="Test"
            wordCount={240}
            audioUrl=""
            audioError={false}
            onGenerateAudio={vi.fn()}
            onStartQuestions={vi.fn()}
            loading={false}
            loadingMessage=""
          />
        )
      },
      {
        name: 'QuestionInterface',
        component: (
          <QuestionInterface
            questions={mockQuestions}
            answers={{}}
            onAnswerChange={vi.fn()}
            onSubmit={vi.fn()}
            loading={false}
            loadingMessage=""
            audioUrl=""
            transcript="Test"
          />
        )
      },
      {
        name: 'ResultsDisplay',
        component: (
          <ResultsDisplay
            exercise={mockExercise}
            onRestart={vi.fn()}
            onExport={vi.fn()}
          />
        )
      }
    ]

    for (const { name, component } of components) {
      setViewportSize(STANDARD_VIEWPORTS.desktop1440.width, STANDARD_VIEWPORTS.desktop1440.height)
      
      renderWithLightTheme(component)

      // Check for consistent glass-effect usage
      const glassElements = document.querySelectorAll('.glass-effect')
      expect(glassElements.length).toBeGreaterThan(0)

      // Verify light theme consistency
      const lightThemeElements = document.querySelectorAll('[class*="text-gray-900"], [class*="bg-white"]')
      expect(lightThemeElements.length).toBeGreaterThan(0)

      screen.unmount?.()
    }
  })
})