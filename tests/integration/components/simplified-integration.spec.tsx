import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../helpers/render-utils'
import { createMockExercise } from '../../helpers/mock-utils'
import { ResultsDisplay } from '../../../components/results-display'
import { QuestionInterface } from '../../../components/question-interface'
import type { Exercise } from '../../../lib/types'

// Mock dependencies
vi.mock('../../../lib/storage', () => ({
  getProgressMetrics: vi.fn(() => ({
    totalSessions: 10,
    averageAccuracy: 85,
    currentStreakDays: 3,
    totalListeningMinutes: 45,
  })),
  getPracticeNote: vi.fn(() => ''),
  savePracticeNote: vi.fn(() => true),
  isStorageAvailable: vi.fn(() => true),
}))

vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('Simplified Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('ResultsDisplay Component Integration', () => {
    it('should render specialized practice results correctly', async () => {
      const mockExercise = createMockExercise({
        specializedMode: true,
        focusAreas: ['main-idea', 'detail-comprehension'],
        perFocusAccuracy: {
          'main-idea': 85,
          'detail-comprehension': 70,
        },
      })

      const mockProps = {
        exercise: mockExercise,
        onRestart: vi.fn(),
        onExport: vi.fn(),
      }

      renderWithProviders(<ResultsDisplay {...mockProps} />, { skipI18nInit: true })

      // Should render exercise completion message
      expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()

      // Should show accuracy percentage
      const correctAnswers = mockExercise.results.filter(r => r.is_correct).length
      const totalQuestions = mockExercise.results.length
      const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
      expect(screen.getByText(`${accuracy}%`)).toBeInTheDocument()
    })

    it('should handle practice notes functionality', async () => {
      const mockExercise = createMockExercise()
      const mockProps = {
        exercise: mockExercise,
        onRestart: vi.fn(),
        onExport: vi.fn(),
      }

      renderWithProviders(<ResultsDisplay {...mockProps} />, { skipI18nInit: true })

      // Should show notes section
      expect(screen.getByText(/practice.*notes/i)).toBeInTheDocument()

      // Should have a textarea for notes
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()

      // Should have a save button
      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeInTheDocument()
    })

    it('should handle restart and export actions', async () => {
      const mockExercise = createMockExercise()
      const onRestart = vi.fn()
      const onExport = vi.fn()

      const mockProps = {
        exercise: mockExercise,
        onRestart,
        onExport,
      }

      renderWithProviders(<ResultsDisplay {...mockProps} />, { skipI18nInit: true })

      // Find and click restart button
      const restartButton = screen.getByRole('button', { name: /start.*new.*practice/i })
      await user.click(restartButton)
      expect(onRestart).toHaveBeenCalledTimes(1)

      // Find and click export button
      const exportButton = screen.getByRole('button', { name: /export.*results/i })
      await user.click(exportButton)
      expect(onExport).toHaveBeenCalledTimes(1)
    })
  })

  describe('QuestionInterface Component Integration', () => {
    it('should render questions with focus areas', async () => {
      const mockQuestions = [
        {
          type: 'single' as const,
          question: 'What is the main topic?',
          options: ['Technology', 'Business', 'Education', 'Travel'],
          answer: 'Technology',
          focus_areas: ['main-idea'],
          explanation: 'Test explanation',
        },
      ]

      const mockProps = {
        questions: mockQuestions,
        answers: {},
        onAnswerChange: vi.fn(),
        onSubmit: vi.fn(),
        loading: false,
        loadingMessage: '',
        audioUrl: 'blob:mock-audio-url',
        transcript: 'Test transcript',
      }

      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Should show question
      expect(screen.getByText('What is the main topic?')).toBeInTheDocument()

      // Should show focus areas
      expect(screen.getByText(/focus areas/i)).toBeInTheDocument()

      // Should show answer options
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Business')).toBeInTheDocument()
    })

    it('should handle answer selection', async () => {
      const mockQuestions = [
        {
          type: 'single' as const,
          question: 'Test question?',
          options: ['Option A', 'Option B'],
          answer: 'Option A',
          focus_areas: ['main-idea'],
          explanation: 'Test explanation',
        },
      ]

      const onAnswerChange = vi.fn()

      const mockProps = {
        questions: mockQuestions,
        answers: {},
        onAnswerChange,
        onSubmit: vi.fn(),
        loading: false,
        loadingMessage: '',
        audioUrl: '',
        transcript: 'Test transcript',
      }

      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Find and click an option
      const optionA = screen.getByLabelText(/A\.\s*Option A/i)
      await user.click(optionA)

      // Should call onAnswerChange
      expect(onAnswerChange).toHaveBeenCalledWith({ 0: 'Option A' })
    })

    it('should show audio player when audioUrl is provided', async () => {
      const mockProps = {
        questions: [],
        answers: {},
        onAnswerChange: vi.fn(),
        onSubmit: vi.fn(),
        loading: false,
        loadingMessage: '',
        audioUrl: 'blob:mock-audio-url',
        transcript: 'Test transcript',
      }

      renderWithProviders(<QuestionInterface {...mockProps} />, { skipI18nInit: true })

      // Should show audio player
      expect(screen.getByText(/audio player/i)).toBeInTheDocument()

      // Should have play/pause button (look for the button with play icon)
      const buttons = screen.getAllByRole('button')
      const playButton = buttons.find(button => 
        button.querySelector('svg') && 
        (button.title?.toLowerCase().includes('play') || button.title?.toLowerCase().includes('pause'))
      )
      expect(playButton).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing data gracefully', async () => {
      const emptyExercise = {
        id: 'empty-exercise',
        difficulty: 'B1' as const,
        language: 'en-US' as const,
        topic: 'Empty Exercise',
        transcript: '',
        questions: [],
        answers: {},
        results: [],
        createdAt: new Date().toISOString(),
      } as Exercise

      const mockProps = {
        exercise: emptyExercise,
        onRestart: vi.fn(),
        onExport: vi.fn(),
      }

      renderWithProviders(<ResultsDisplay {...mockProps} />, { skipI18nInit: true })

      // Should not crash and should show basic information
      expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()
    })

    it('should handle storage unavailability', async () => {
      // Mock localStorage to be unavailable
      const originalLocalStorage = global.localStorage
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true
      })

      const mockExercise = createMockExercise()
      const mockProps = {
        exercise: mockExercise,
        onRestart: vi.fn(),
        onExport: vi.fn(),
      }

      renderWithProviders(<ResultsDisplay {...mockProps} />, { skipI18nInit: true })

      // Should show storage unavailable message or handle gracefully
      expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()

      // Restore localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      })
    })
  })
})