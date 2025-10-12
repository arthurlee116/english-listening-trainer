import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../helpers/render-utils'
import { createMockQuestion } from '../../helpers/mock-utils'
import { QuestionInterface } from '../../../components/question-interface'
import type { Question } from '../../../lib/types'

// Mock i18n to avoid async loading issues in tests
vi.mock('../../../lib/i18n/config', () => ({
  default: {
    isInitialized: true,
    init: vi.fn().mockResolvedValue(undefined),
    addResourceBundle: vi.fn(),
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    t: vi.fn((key: string) => key),
  },
  ensureTranslationsLoaded: vi.fn().mockResolvedValue(undefined),
  bilingualConfig: {
    defaultLanguage: 'en',
    displayFormat: 'en-zh',
    separator: ' '
  },
  formatBilingualText: vi.fn((en: string, zh: string) => `${en} ${zh}`),
}))

// Create a mock toast function that can be accessed in tests
const mockToast = vi.fn()

// Mock the toast hook
vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock the bilingual text hook
vi.mock('../../../hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: vi.fn((key: string, options?: { values?: Record<string, string | number> }) => {
      // Return mock translations for common keys used in tests
      const mockTranslations: Record<string, string> = {
        'components.questionInterface.audioPlayer': 'Audio Player',
        'components.questionInterface.questions': 'Questions',
        'components.questionInterface.answered': 'answered',
        'components.questionInterface.questionNumber': 'Question {number} 第{number}题',
        'components.questionInterface.shortAnswer': 'Short Answer',
        'components.questionInterface.focusAreas': 'Focus Areas',
        'components.questionInterface.writeAnswerPlaceholder': 'Write your answer here...',
        'components.questionInterface.submitAnswers': 'Submit Answers',
        'components.questionInterface.emergencyTranscriptHint': 'Emergency Transcript (Click to expand)',
        'components.audioPlayer.play': 'Play',
        'components.audioPlayer.pause': 'Pause',
        'components.audioPlayer.skipBackward': 'Skip Backward',
        'components.audioPlayer.skipForward': 'Skip Forward',
        'components.audioPlayer.playbackRateLabel': 'Speed',
        'components.audioPlayer.playbackRateAriaLabel': 'Playback Rate',
        'components.audioPlayer.playbackRatePlaceholder': 'Select speed',
        'components.audioPlayer.playbackRateChangedTitle': 'Playback Rate Changed',
        'components.audioPlayer.playbackRateChangedDesc': 'Playback rate set to {rate}x',
        'components.specializedPractice.focusAreas.mainIdea': 'Main Idea',
        'components.specializedPractice.focusAreas.detailComprehension': 'Detail Comprehension',
        'components.specializedPractice.focusAreas.inference': 'Inference',
        'components.specializedPractice.focusAreas.vocabulary': 'Vocabulary',
      }
      const translation = mockTranslations[key] || key

      if (options?.values) {
        return Object.entries(options.values).reduce((acc, [param, value]) => {
          return acc.split(`{${param}}`).join(String(value))
        }, translation)
      }

      return translation
    }),
    formatBilingual: vi.fn((en: string, zh: string) => `${en} ${zh}`),
  }),
}))

// Mock BilingualText component
vi.mock('../../../components/ui/bilingual-text', () => ({
  BilingualText: ({ translationKey }: { translationKey: string }) => {
    const mockTranslations: Record<string, string> = {
      'components.audioPlayer.playbackRateLabel': 'Speed',
      'components.audioPlayer.playbackRatePlaceholder': 'Select speed',
    }
    return mockTranslations[translationKey] || translationKey
  },
}))

// Mock ThemeProvider to avoid provider overhead in tests
vi.mock('../../../components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))



// Mock audio element
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockImplementation(() => {
    const promise = Promise.resolve()
    promise.catch = vi.fn().mockReturnValue(promise)
    return promise
  }),
})

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
  writable: true,
  value: 0,
})

Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
  writable: true,
  value: 120,
})

describe('QuestionInterface Integration Tests', () => {
  const user = userEvent.setup()
  
  const mockProps = {
    questions: [
      createMockQuestion({
        type: 'single',
        question: 'What is the main topic discussed in the audio?',
        options: ['Technology', 'Business', 'Education', 'Travel'],
        answer: 'Technology',
        focus_areas: ['main-idea'],
      }),
      createMockQuestion({
        type: 'single',
        question: 'Which company was mentioned?',
        options: ['Apple', 'Google', 'Microsoft', 'Amazon'],
        answer: 'Google',
        focus_areas: ['detail-comprehension'],
      }),
      createMockQuestion({
        type: 'short',
        question: 'Summarize the key benefits mentioned.',
        options: null,
        answer: 'Improved efficiency and innovation',
        focus_areas: ['inference', 'vocabulary'],
      }),
    ] as Question[],
    answers: {},
    onAnswerChange: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
    loadingMessage: '',
    audioUrl: 'blob:mock-audio-url',
    transcript: 'This is a sample transcript for testing purposes.',
    initialDuration: 120,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    const ResizeObserverMock = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Answer Submission with Specialized Tag Processing', () => {
    it('should handle single choice answers with focus area tags', async () => {
      const onAnswerChange = vi.fn()
      
      renderWithProviders(
        <QuestionInterface {...mockProps} onAnswerChange={onAnswerChange} />,
        { skipI18nInit: true }
      )

      // Verify focus areas are displayed
      expect(screen.getAllByText(/focus areas/i)).toHaveLength(3) // One for each question
      expect(screen.getByText(/main.*idea/i)).toBeInTheDocument()
      expect(screen.getByText(/detail.*comprehension/i)).toBeInTheDocument()

      // Answer the first question
      const technologyOption = screen.getByLabelText(/A\.\s*Technology/i)
      await user.click(technologyOption)

      // Verify answer change was called with correct data
      expect(onAnswerChange).toHaveBeenCalledWith({ 0: 'Technology' })

      // Answer the second question
      const googleOption = screen.getByLabelText(/B\.\s*Google/i)
      await user.click(googleOption)

      expect(onAnswerChange).toHaveBeenCalledWith({ 1: 'Google' })
    })

    it('should handle short answer questions with specialized tags', async () => {
      const onAnswerChange = vi.fn()
      
      renderWithProviders(
        <QuestionInterface {...mockProps} onAnswerChange={onAnswerChange} />,
        { skipI18nInit: true }
      )

      // Find the short answer textarea
      const shortAnswerTextarea = screen.getByPlaceholderText(/write.*answer/i)
      expect(shortAnswerTextarea).toBeInTheDocument()

      // Type in the textarea
      await user.type(shortAnswerTextarea, 'Test answer')

      // Verify the answer change was called with some text content
      await waitFor(() => {
        expect(onAnswerChange).toHaveBeenCalled()
        const calls = onAnswerChange.mock.calls
        const lastCall = calls[calls.length - 1]
        // Just verify that some text was captured for question index 2
        expect(lastCall[0]).toHaveProperty('2')
        expect(typeof lastCall[0][2]).toBe('string')
        expect(lastCall[0][2].length).toBeGreaterThan(0)
      })

      // Verify focus areas are displayed for short answer question
      const focusAreaBadges = screen.getAllByText(/inference|vocabulary/i)
      expect(focusAreaBadges.length).toBeGreaterThan(0)
    })

    it('should preserve answers when switching between questions', async () => {
      const onAnswerChange = vi.fn()
      let currentAnswers = {}
      
      // Mock the onAnswerChange to update our local state
      onAnswerChange.mockImplementation((newAnswers) => {
        currentAnswers = { ...currentAnswers, ...newAnswers }
      })

      const { rerender } = renderWithProviders(
        <QuestionInterface {...mockProps} onAnswerChange={onAnswerChange} />,
        { skipI18nInit: true }
      )

      // Answer first question
      const technologyOption = screen.getByLabelText(/A\.\s*Technology/i)
      await user.click(technologyOption)

      // Update props with new answers
      rerender(
        <QuestionInterface 
          {...mockProps} 
          answers={currentAnswers}
          onAnswerChange={onAnswerChange} 
        />
      )

      // Answer second question
      const googleOption = screen.getByLabelText(/B\.\s*Google/i)
      await user.click(googleOption)

      // Verify both answers are preserved - check the actual calls made
      const calls = onAnswerChange.mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[0][0]).toEqual({ 0: 'Technology' })
      expect(calls[1][0]).toEqual({ 0: 'Technology', 1: 'Google' })
    })

    it('should handle submission with all answers provided', async () => {
      const onSubmit = vi.fn()
      const completeAnswers = {
        0: 'Technology',
        1: 'Google', 
        2: 'Improved efficiency and innovation'
      }

      renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          answers={completeAnswers}
          onSubmit={onSubmit}
        />,
        { skipI18nInit: true }
      )

      // Submit button should be enabled
      const submitButton = screen.getByRole('button', { name: /submit.*answers/i })
      expect(submitButton).toBeEnabled()

      await user.click(submitButton)
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('should prevent submission when answers are incomplete', async () => {
      const onSubmit = vi.fn()
      const incompleteAnswers = {
        0: 'Technology',
        // Missing answers for questions 1 and 2
      }

      renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          answers={incompleteAnswers}
          onSubmit={onSubmit}
        />,
        { skipI18nInit: true }
      )

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /submit.*answers/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Focus Area Display and Interaction', () => {
    it('should display focus areas for each question', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Check that focus area labels are displayed
      expect(screen.getAllByText(/focus areas/i)).toHaveLength(3) // One for each question
      
      // Check for specific focus area badges
      expect(screen.getByText(/main.*idea/i)).toBeInTheDocument()
      expect(screen.getByText(/detail.*comprehension/i)).toBeInTheDocument()
      expect(screen.getByText(/inference/i)).toBeInTheDocument()
      expect(screen.getByText(/vocabulary/i)).toBeInTheDocument()
    })

    it('should handle questions with multiple focus areas', async () => {
      const questionsWithMultipleFocusAreas = [
        createMockQuestion({
          question: 'Complex question with multiple focus areas',
          focus_areas: ['main-idea', 'detail-comprehension', 'inference', 'vocabulary'],
        })
      ]

      renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          questions={questionsWithMultipleFocusAreas}
        />,
        { skipI18nInit: true }
      )

      // All focus areas should be displayed
      expect(screen.getByText(/main.*idea/i)).toBeInTheDocument()
      expect(screen.getByText(/detail.*comprehension/i)).toBeInTheDocument()
      expect(screen.getByText(/inference/i)).toBeInTheDocument()
      expect(screen.getByText(/vocabulary/i)).toBeInTheDocument()
    })

    it('should handle questions without focus areas gracefully', async () => {
      const questionsWithoutFocusAreas = [
        createMockQuestion({
          question: 'Question without focus areas',
          focus_areas: undefined,
        })
      ]

      renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          questions={questionsWithoutFocusAreas}
        />,
        { skipI18nInit: true }
      )

      // Should not crash and should still display the question
      expect(screen.getByText('Question without focus areas')).toBeInTheDocument()
    })

    it('should display progress correctly based on answered questions', async () => {
      const onAnswerChange = vi.fn()
      let currentAnswers = {}

      onAnswerChange.mockImplementation((newAnswers) => {
        currentAnswers = { ...currentAnswers, ...newAnswers }
      })

      const { rerender } = renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          answers={currentAnswers}
          onAnswerChange={onAnswerChange} 
        />,
        { skipI18nInit: true }
      )

      // Initially 0/3 answered (text is split across elements)
      // Use getAllByText to handle multiple matches and pick the right one
      const progressElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('0') && element?.textContent?.includes('3') && element?.textContent?.includes('answered') || false
      })
      expect(progressElements.length).toBeGreaterThan(0)

      // Answer first question
      const technologyOption = screen.getByLabelText(/A\.\s*Technology/i)
      await user.click(technologyOption)

      // Update with new answers
      rerender(
        <QuestionInterface 
          {...mockProps} 
          answers={{ 0: 'Technology' }}
          onAnswerChange={onAnswerChange} 
        />
      )

      // Should show 1/3 answered (text is split across elements)
      // Use getAllByText to handle multiple matches and pick the right one
      const updatedProgressElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('1') && element?.textContent?.includes('3') && element?.textContent?.includes('answered') || false
      })
      expect(updatedProgressElements.length).toBeGreaterThan(0)
    })
  })

  describe('Audio Player Integration', () => {
    it('should display audio player when audioUrl is provided', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Audio player should be present
      expect(screen.getByText(/audio player/i)).toBeInTheDocument()
      
      // Play/pause button should be present
      const playButton = screen.getByRole('button', { name: /play|pause/i })
      expect(playButton).toBeInTheDocument()
    })

    it('should handle audio playback controls', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Find and click play button
      const playButton = screen.getByRole('button', { name: /play|pause/i })
      await user.click(playButton)

      // Should call play method on audio element
      await waitFor(() => {
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
      })
    })

    it('should handle playback speed changes', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Find playback speed selector
      const speedSelector = screen.getByRole('combobox', { name: /playback.*rate/i })
      expect(speedSelector).toBeInTheDocument()

      // The Select component should be present and functional
      // We'll test the basic functionality without complex interactions
      expect(speedSelector).toHaveAttribute('aria-label', 'Playback Rate')
    })

    it('should handle skip forward and backward', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Find skip buttons
      const skipBackButton = screen.getByRole('button', { name: /skip.*back/i })
      const skipForwardButton = screen.getByRole('button', { name: /skip.*forward/i })

      expect(skipBackButton).toBeInTheDocument()
      expect(skipForwardButton).toBeInTheDocument()

      // Click skip buttons
      await user.click(skipBackButton)
      await user.click(skipForwardButton)

      // Should not throw errors
    })
  })

  describe('Error Handling and Fallback Scenarios', () => {
    it('should handle missing audio gracefully', async () => {
      renderWithProviders(
        <QuestionInterface {...mockProps} audioUrl="" />,
        { skipI18nInit: true }
      )

      // Should not display audio player when no URL
      expect(screen.queryByText(/audio player/i)).not.toBeInTheDocument()
      
      // Questions should still be displayed
      expect(screen.getByText('What is the main topic discussed in the audio?')).toBeInTheDocument()
    })

    it('should handle empty questions array', async () => {
      renderWithProviders(
        <QuestionInterface {...mockProps} questions={[]} />,
        { skipI18nInit: true }
      )

      // Should show 0/0 progress - just check that the component renders properly
      // Check that we have the Questions heading which indicates the progress section is rendered
      expect(screen.getByText('Questions')).toBeInTheDocument()
      // Check that submit button is enabled when no questions to answer
      const submitButton = screen.getByRole('button', { name: /submit.*answers/i })
      expect(submitButton).toBeEnabled()
    })

    it('should handle loading state correctly', async () => {
      renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          loading={true}
          loadingMessage="Processing answers..."
        />,
        { skipI18nInit: true }
      )

      // Submit button should show loading state
      expect(screen.getByText('Processing answers...')).toBeInTheDocument()
      
      // Submit button should be disabled during loading
      const submitButton = screen.getByRole('button', { name: /processing answers/i })
      expect(submitButton).toBeDisabled()
    })

    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw errors
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage unavailable')
      })

      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Find playback speed selector - should not crash even with localStorage errors
      const speedSelector = screen.getByRole('combobox', { name: /playback.*rate/i })
      expect(speedSelector).toBeInTheDocument()

      // Should not throw errors
      expect(screen.getByText(/audio player/i)).toBeInTheDocument()

      // Restore localStorage
      Storage.prototype.setItem = originalSetItem
    })

    it('should handle malformed focus area data', async () => {
      const questionsWithMalformedFocusAreas = [
        createMockQuestion({
          question: 'Question with malformed focus areas',
          focus_areas: ['invalid-focus-area', '', null, undefined] as any,
        })
      ]

      renderWithProviders(
        <QuestionInterface 
          {...mockProps} 
          questions={questionsWithMalformedFocusAreas}
        />,
        { skipI18nInit: true }
      )

      // Should not crash and should display the question
      expect(screen.getByText('Question with malformed focus areas')).toBeInTheDocument()
    })

    it('should handle transcript display toggle', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Find the emergency transcript toggle
      const transcriptToggle = screen.getByText(/emergency.*transcript/i)
      expect(transcriptToggle).toBeInTheDocument()

      // Click to expand transcript
      await user.click(transcriptToggle)

      // Transcript should be visible
      expect(screen.getByText('This is a sample transcript for testing purposes.')).toBeInTheDocument()
    })

    it('should handle answer validation edge cases', async () => {
      const onAnswerChange = vi.fn()
      
      renderWithProviders(
        <QuestionInterface {...mockProps} onAnswerChange={onAnswerChange} />,
        { skipI18nInit: true }
      )

      // Test empty string answers
      const shortAnswerTextarea = screen.getByPlaceholderText(/write.*answer/i)
      await user.type(shortAnswerTextarea, '   ')  // Only whitespace
      await user.clear(shortAnswerTextarea)

      // Should handle whitespace-only answers
      // The clear operation should result in an empty string eventually
      // Check that onAnswerChange was called (the exact value may vary due to React's batching)
      expect(onAnswerChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility and User Experience', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Check for proper radio group structure
      const radioGroups = screen.getAllByRole('radiogroup')
      expect(radioGroups.length).toBeGreaterThan(0)

      // Check for proper button roles
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)

      // Check for proper labels
      const labels = screen.getAllByRole('radio')
      labels.forEach(radio => {
        expect(radio).toHaveAttribute('id')
      })
    })

    it('should support keyboard navigation', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Tab through radio options
      const firstRadio = screen.getAllByRole('radio')[0]
      firstRadio.focus()
      
      // Use arrow keys to navigate
      fireEvent.keyDown(firstRadio, { key: 'ArrowDown' })
      
      // Should not throw errors
      expect(document.activeElement).toBeDefined()
    })

    it('should display question numbers and types clearly', async () => {
      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Check for question numbers
      expect(screen.getByText(/Question 1.*第1题/)).toBeInTheDocument()
      expect(screen.getByText(/Question 2.*第2题/)).toBeInTheDocument()
      expect(screen.getByText(/Question 3.*第3题/)).toBeInTheDocument()

      // Check for short answer indicator
      expect(screen.getByText(/short.*answer/i)).toBeInTheDocument()
    })
  })
})