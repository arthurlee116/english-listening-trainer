import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../helpers/render-utils'
import { createMockExercise, createMockFocusAreaStats } from '../../helpers/mock-utils'
import { ResultsDisplay } from '../../../components/results-display'
import { HistoryPanel } from '../../../components/history-panel'
import type { Exercise, FocusAreaStats } from '../../../lib/types'

// Mock external dependencies
vi.mock('../../../lib/storage', () => ({
  getHistory: vi.fn(() => []),
  clearHistory: vi.fn(),
  getProgressMetrics: vi.fn(() => ({
    totalSessions: 10,
    averageAccuracy: 85,
    currentStreakDays: 3,
    totalListeningMinutes: 45,
  })),
  getPracticeNote: vi.fn(() => ''),
  savePracticeNote: vi.fn(() => true),
  deletePracticeNote: vi.fn(() => true),
  isStorageAvailable: vi.fn(() => true),
}))

vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe('ResultsDisplay Integration Tests', () => {
  const user = userEvent.setup()
  
  const mockExercise = createMockExercise({
    id: 'test-exercise-1',
    specializedMode: true,
    focusAreas: ['main-idea', 'detail-comprehension'],
    perFocusAccuracy: {
      'main-idea': 85,
      'detail-comprehension': 70,
    },
    focusCoverage: {
      requested: ['main-idea', 'detail-comprehension'],
      provided: ['main-idea', 'detail-comprehension'],
      coverage: 1.0,
      unmatchedTags: [],
      partialMatches: [],
    },
  })

  const mockFocusAreaStats = createMockFocusAreaStats({
    'main-idea': {
      attempts: 10,
      incorrect: 2,
      accuracy: 80,
      lastAttempt: new Date().toISOString(),
      trend: 'improving',
    },
    'detail-comprehension': {
      attempts: 8,
      incorrect: 3,
      accuracy: 62.5,
      lastAttempt: new Date().toISOString(),
      trend: 'stable',
    },
  })

  const mockProps = {
    exercise: mockExercise,
    onRestart: vi.fn(),
    onExport: vi.fn(),
    focusAreaStats: mockFocusAreaStats,
    onRetryWithAdjustedTags: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Specialized Data Rendering', () => {
    it('should render specialized practice statistics correctly', async () => {
      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Check for specialized stats section
      expect(screen.getByText(/specialized.*stats/i)).toBeInTheDocument()

      // Check focus area performance display
      expect(screen.getByText(/main.*idea/i)).toBeInTheDocument()
      expect(screen.getByText(/detail.*comprehension/i)).toBeInTheDocument()

      // Check accuracy percentages
      expect(screen.getByText('85.0%')).toBeInTheDocument()
      expect(screen.getByText('70.0%')).toBeInTheDocument()

      // Check improvement indicators
      const improvementIndicators = screen.getAllByText(/\+.*%|\-.*%/)
      expect(improvementIndicators.length).toBeGreaterThan(0)
    })

    it('should display focus coverage warnings when coverage is incomplete', async () => {
      const exerciseWithPartialCoverage = createMockExercise({
        ...mockExercise,
        focusCoverage: {
          requested: ['main-idea', 'detail-comprehension', 'inference'],
          provided: ['main-idea', 'detail-comprehension'],
          coverage: 0.67,
          unmatchedTags: ['inference'],
          partialMatches: [],
        },
      })

      renderWithProviders(
        <ResultsDisplay 
          {...mockProps} 
          exercise={exerciseWithPartialCoverage}
        />
      )

      // Check for coverage warning
      expect(screen.getByText(/coverage.*warning/i)).toBeInTheDocument()
      expect(screen.getByText(/67%/)).toBeInTheDocument()
      expect(screen.getByText(/unmatched.*tags/i)).toBeInTheDocument()
    })

    it('should handle retry with adjusted tags functionality', async () => {
      const exerciseWithPartialCoverage = createMockExercise({
        ...mockExercise,
        focusCoverage: {
          requested: ['main-idea', 'detail-comprehension', 'inference'],
          provided: ['main-idea', 'detail-comprehension'],
          coverage: 0.67,
          unmatchedTags: ['inference'],
          partialMatches: [],
        },
      })

      const onRetryWithAdjustedTags = vi.fn()

      renderWithProviders(
        <ResultsDisplay 
          {...mockProps} 
          exercise={exerciseWithPartialCoverage}
          onRetryWithAdjustedTags={onRetryWithAdjustedTags}
        />
      )

      // Find and click retry button
      const retryButton = screen.getByRole('button', { name: /retry.*covered.*tags/i })
      await user.click(retryButton)

      expect(onRetryWithAdjustedTags).toHaveBeenCalledWith(['main-idea', 'detail-comprehension'])
    })

    it('should display recommendations based on performance', async () => {
      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Check for recommendations section
      expect(screen.getByText(/next.*step.*recommendations/i)).toBeInTheDocument()

      // Should show improvement recommendation for detail-comprehension (70% < 70%)
      // and mastery recommendation for main-idea (85% >= 90% is false, but >= 70%)
      const recommendations = screen.getAllByText(/•/)
      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('Data Persistence and Retrieval', () => {
    it('should load and display practice notes correctly', async () => {
      const { getPracticeNote } = require('../../../lib/storage')
      getPracticeNote.mockReturnValue('This is a test note for the exercise.')

      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Check for notes section
      expect(screen.getByText(/practice.*notes/i)).toBeInTheDocument()

      // Check if note is loaded
      const textarea = screen.getByPlaceholderText(/notes.*placeholder/i)
      expect(textarea).toHaveValue('This is a test note for the exercise.')

      const lengthHint = screen.getByText(/Length:/)
      expect(lengthHint).toHaveTextContent('Length: 0/2000')
      expect(lengthHint.textContent).not.toContain('{')
    })

    it('should save practice notes with proper validation', async () => {
      const { savePracticeNote } = require('../../../lib/storage')
      const { toast } = require('../../../hooks/use-toast')()

      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Find notes textarea and add content
      const textarea = screen.getByPlaceholderText(/notes.*placeholder/i)
      await user.type(textarea, 'New practice note content')

      // Find and click save button
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Verify save was called
      expect(savePracticeNote).toHaveBeenCalledWith('test-exercise-1', 'New practice note content')
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        })
      )
    })

    it('should handle note length validation', async () => {
      const { toast } = require('../../../hooks/use-toast')()

      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Create a note that exceeds the limit (2000 characters)
      const longNote = 'a'.repeat(2001)
      
      const textarea = screen.getByPlaceholderText(/notes.*placeholder/i)
      await user.clear(textarea)
      await user.type(textarea, longNote)

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Should show error toast
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/failed/i),
          variant: 'destructive',
        })
      )
    })

    it('should handle storage unavailability gracefully', async () => {
      const { isStorageAvailable } = require('../../../lib/storage')
      isStorageAvailable.mockReturnValue(false)

      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Notes textarea should be disabled
      const textarea = screen.getByPlaceholderText(/notes.*placeholder/i)
      expect(textarea).toBeDisabled()

      // Should show storage unavailable message
      expect(screen.getByText(/storage.*unavailable/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling and Fallback Scenarios', () => {
    it('should handle missing focus area data gracefully', async () => {
      const exerciseWithoutFocusAreas = createMockExercise({
        specializedMode: false,
        focusAreas: undefined,
        perFocusAccuracy: undefined,
      })

      renderWithProviders(
        <ResultsDisplay 
          {...mockProps} 
          exercise={exerciseWithoutFocusAreas}
          focusAreaStats={undefined}
        />
      )

      // Should not show specialized stats section
      expect(screen.queryByText(/specialized.*stats/i)).not.toBeInTheDocument()

      // Should still show basic results
      expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()
    })

    it('should handle corrupted exercise data', async () => {
      const corruptedExercise = {
        ...mockExercise,
        results: [], // Empty results
        questions: [], // Empty questions
        answers: {}, // Empty answers
      } as Exercise

      renderWithProviders(
        <ResultsDisplay {...mockProps} exercise={corruptedExercise} />
      )

      // Should not crash and should show some basic information
      expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()
    })

    it('should handle progress metrics loading failure', async () => {
      const { getProgressMetrics } = require('../../../lib/storage')
      getProgressMetrics.mockImplementation(() => {
        throw new Error('Failed to load metrics')
      })

      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Should not crash and should still render main content
      expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()
    })
  })

  describe('User Interaction and Controls', () => {
    it('should toggle details visibility correctly', async () => {
      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Details should be visible by default
      expect(screen.getByText(/answer.*details/i)).toBeInTheDocument()

      // Find and click hide details button
      const hideButton = screen.getByRole('button', { name: /hide.*details/i })
      await user.click(hideButton)

      // Details should be hidden
      expect(screen.queryByText(/answer.*details/i)).not.toBeInTheDocument()

      // Button text should change
      expect(screen.getByRole('button', { name: /show.*details/i })).toBeInTheDocument()
    })

    it('should toggle transcript visibility correctly', async () => {
      renderWithProviders(<ResultsDisplay {...mockProps} />)

      // Transcript should be hidden by default
      expect(screen.queryByText(mockExercise.transcript)).not.toBeInTheDocument()

      // Find and click show transcript button
      const showTranscriptButton = screen.getByRole('button', { name: /show.*transcript/i })
      await user.click(showTranscriptButton)

      // Transcript should be visible
      expect(screen.getByText(mockExercise.transcript)).toBeInTheDocument()

      // Button text should change
      expect(screen.getByRole('button', { name: /hide.*transcript/i })).toBeInTheDocument()
    })

    it('should handle restart and export actions', async () => {
      const onRestart = vi.fn()
      const onExport = vi.fn()

      renderWithProviders(
        <ResultsDisplay {...mockProps} onRestart={onRestart} onExport={onExport} />
      )

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
})

describe('HistoryPanel Integration Tests', () => {
  const user = userEvent.setup()
  
  const mockExercises = [
    createMockExercise({
      id: 'exercise-1',
      topic: 'Technology Trends',
      difficulty: 'B1',
      language: 'en-US',
      specializedMode: true,
      focusAreas: ['main-idea', 'detail-comprehension'],
      createdAt: '2024-01-15T10:00:00Z',
    }),
    createMockExercise({
      id: 'exercise-2',
      topic: 'Business Innovation',
      difficulty: 'B2',
      language: 'en-US',
      specializedMode: false,
      createdAt: '2024-01-14T15:30:00Z',
    }),
    createMockExercise({
      id: 'exercise-3',
      topic: 'Environmental Issues',
      difficulty: 'A2',
      language: 'zh-CN',
      specializedMode: true,
      focusAreas: ['inference', 'vocabulary'],
      createdAt: '2024-01-13T09:15:00Z',
    }),
  ]

  const mockProps = {
    onBack: vi.fn(),
    onRestore: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    const { getHistory } = require('../../../lib/storage')
    getHistory.mockReturnValue(mockExercises)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('History Data Persistence and Retrieval', () => {
    it('should load and display exercise history correctly', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Check for history header
      expect(screen.getByText(/practice.*history/i)).toBeInTheDocument()

      // Check for exercise records
      expect(screen.getByText('Technology Trends')).toBeInTheDocument()
      expect(screen.getByText('Business Innovation')).toBeInTheDocument()
      expect(screen.getByText('Environmental Issues')).toBeInTheDocument()

      // Check for specialized mode indicators
      const specializedBadges = screen.getAllByText(/specialized.*practice/i)
      expect(specializedBadges.length).toBe(2) // Two specialized exercises
    })

    it('should display progress metrics and statistics', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Check for statistics overview
      expect(screen.getByText(/statistics.*overview/i)).toBeInTheDocument()

      // Check for metric values
      expect(screen.getByText('10')).toBeInTheDocument() // Total sessions
      expect(screen.getByText('85.0%')).toBeInTheDocument() // Average accuracy
      expect(screen.getByText('3')).toBeInTheDocument() // Current streak
      expect(screen.getByText('45')).toBeInTheDocument() // Total listening minutes
    })

    it('should handle specialized practice statistics correctly', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Should show specialized vs general practice breakdown
      const specializedCount = mockExercises.filter(ex => ex.specializedMode).length
      const generalCount = mockExercises.filter(ex => !ex.specializedMode).length

      expect(screen.getByText(specializedCount.toString())).toBeInTheDocument()
      expect(screen.getByText(generalCount.toString())).toBeInTheDocument()
    })

    it('should handle empty history gracefully', async () => {
      const { getHistory } = require('../../../lib/storage')
      getHistory.mockReturnValue([])

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Should show empty state
      expect(screen.getByText(/no.*records/i)).toBeInTheDocument()
      expect(screen.getByText(/no.*records.*description/i)).toBeInTheDocument()

      // Should not show clear history button
      expect(screen.queryByRole('button', { name: /clear.*history/i })).not.toBeInTheDocument()
    })
  })

  describe('Filtering and Search Functionality', () => {
    it('should filter exercises by search term', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Search for "Technology"
      const searchInput = screen.getByPlaceholderText(/search.*topics/i)
      await user.type(searchInput, 'Technology')

      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
        expect(screen.queryByText('Business Innovation')).not.toBeInTheDocument()
        expect(screen.queryByText('Environmental Issues')).not.toBeInTheDocument()
      })
    })

    it('should filter exercises by difficulty level', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Filter by B1 difficulty
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1'))

      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
        expect(screen.queryByText('Business Innovation')).not.toBeInTheDocument()
        expect(screen.queryByText('Environmental Issues')).not.toBeInTheDocument()
      })
    })

    it('should filter exercises by language', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Filter by Chinese language
      const languageSelect = screen.getByRole('combobox', { name: /language/i })
      await user.click(languageSelect)
      await user.click(screen.getByText('中文'))

      await waitFor(() => {
        expect(screen.getByText('Environmental Issues')).toBeInTheDocument()
        expect(screen.queryByText('Technology Trends')).not.toBeInTheDocument()
        expect(screen.queryByText('Business Innovation')).not.toBeInTheDocument()
      })
    })

    it('should filter exercises by specialized mode', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Filter by specialized practice
      const focusAreaSelect = screen.getAllByRole('combobox').find(select => 
        select.getAttribute('aria-label')?.includes('focus') || 
        select.textContent?.includes('focus')
      )
      
      if (focusAreaSelect) {
        await user.click(focusAreaSelect)
        const specializedOption = screen.getByText(/specialized.*practice/i)
        await user.click(specializedOption)

        await waitFor(() => {
          expect(screen.getByText('Technology Trends')).toBeInTheDocument()
          expect(screen.getByText('Environmental Issues')).toBeInTheDocument()
          expect(screen.queryByText('Business Innovation')).not.toBeInTheDocument()
        })
      }
    })

    it('should sort exercises correctly', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Sort by oldest first
      const sortSelect = screen.getByRole('combobox', { name: /sort/i })
      await user.click(sortSelect)
      await user.click(screen.getByText(/oldest/i))

      await waitFor(() => {
        const exerciseCards = screen.getAllByText(/Technology Trends|Business Innovation|Environmental Issues/)
        // Environmental Issues should be first (oldest)
        expect(exerciseCards[0]).toHaveTextContent('Environmental Issues')
      })
    })
  })

  describe('Note Management Integration', () => {
    it('should display and edit practice notes', async () => {
      const { getPracticeNote, savePracticeNote } = require('../../../lib/storage')
      getPracticeNote.mockReturnValue('Existing note for exercise 1')

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Find and click edit note button for first exercise
      const editNoteButtons = screen.getAllByRole('button', { name: /edit.*note/i })
      await user.click(editNoteButtons[0])

      // Note dialog should open
      expect(screen.getByText(/edit.*note/i)).toBeInTheDocument()

      // Existing note should be loaded
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('Existing note for exercise 1')

      // Edit the note
      await user.clear(textarea)
      await user.type(textarea, 'Updated note content')

      // Save the note
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(savePracticeNote).toHaveBeenCalledWith('exercise-1', 'Updated note content')
    })

    it('should handle note deletion', async () => {
      const { deletePracticeNote } = require('../../../lib/storage')
      const { toast } = require('../../../hooks/use-toast')()

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Open note dialog
      const editNoteButtons = screen.getAllByRole('button', { name: /edit.*note/i })
      await user.click(editNoteButtons[0])

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete.*note/i })
      await user.click(deleteButton)

      expect(deletePracticeNote).toHaveBeenCalledWith('exercise-1')
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/deleted/i),
        })
      )
    })

    it('should filter exercises by note presence', async () => {
      const { getPracticeNote } = require('../../../lib/storage')
      getPracticeNote.mockImplementation((id: string) => {
        return id === 'exercise-1' ? 'Has note' : ''
      })

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Filter by exercises with notes
      const noteFilter = screen.getByRole('combobox', { name: /filter/i })
      await user.click(noteFilter)
      await user.click(screen.getByText(/with.*notes/i))

      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
        expect(screen.queryByText('Business Innovation')).not.toBeInTheDocument()
        expect(screen.queryByText('Environmental Issues')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling and Fallback Scenarios', () => {
    it('should handle storage errors gracefully', async () => {
      const { getHistory } = require('../../../lib/storage')
      getHistory.mockImplementation(() => {
        throw new Error('Storage error')
      })

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Should show empty state when storage fails
      expect(screen.getByText(/no.*records/i)).toBeInTheDocument()
    })

    it('should handle progress metrics loading failure', async () => {
      const { getProgressMetrics } = require('../../../lib/storage')
      getProgressMetrics.mockImplementation(() => {
        throw new Error('Metrics error')
      })

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Should still show exercise list
      expect(screen.getByText('Technology Trends')).toBeInTheDocument()
      
      // Statistics section might not be shown or show fallback
      expect(screen.queryByText(/statistics.*overview/i)).toBeInTheDocument()
    })

    it('should handle corrupted exercise data', async () => {
      const corruptedExercises = [
        {
          id: 'corrupted-1',
          topic: '', // Empty topic
          difficulty: 'INVALID' as any, // Invalid difficulty
          results: null as any, // Null results
          createdAt: 'invalid-date', // Invalid date
        }
      ]

      const { getHistory } = require('../../../lib/storage')
      getHistory.mockReturnValue(corruptedExercises)

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Should not crash and should handle gracefully
      expect(screen.getByText(/practice.*history/i)).toBeInTheDocument()
    })

    it('should handle note storage failures', async () => {
      const { savePracticeNote } = require('../../../lib/storage')
      const { toast } = require('../../../hooks/use-toast')()
      savePracticeNote.mockReturnValue(false)

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Open note dialog and try to save
      const editNoteButtons = screen.getAllByRole('button', { name: /edit.*note/i })
      await user.click(editNoteButtons[0])

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'New note')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Should show error toast
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/failed/i),
          variant: 'destructive',
        })
      )
    })
  })

  describe('User Interaction and Navigation', () => {
    it('should handle back navigation', async () => {
      const onBack = vi.fn()

      renderWithProviders(<HistoryPanel {...mockProps} onBack={onBack} />)

      // Find and click back button
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('should handle exercise restoration', async () => {
      const onRestore = vi.fn()

      renderWithProviders(<HistoryPanel {...mockProps} onRestore={onRestore} />)

      // Find and click view details button for first exercise
      const viewButtons = screen.getAllByRole('button', { name: /view.*details/i })
      await user.click(viewButtons[0])

      expect(onRestore).toHaveBeenCalledWith(mockExercises[0])
    })

    it('should handle history clearing', async () => {
      const { clearHistory } = require('../../../lib/storage')
      
      // Mock window.confirm
      const originalConfirm = window.confirm
      window.confirm = vi.fn(() => true)

      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Find and click clear history button
      const clearButton = screen.getByRole('button', { name: /clear.*history/i })
      await user.click(clearButton)

      expect(window.confirm).toHaveBeenCalled()
      expect(clearHistory).toHaveBeenCalledTimes(1)

      // Restore original confirm
      window.confirm = originalConfirm
    })

    it('should handle focus area display for specialized exercises', async () => {
      renderWithProviders(<HistoryPanel {...mockProps} />)

      // Check for focus area badges in specialized exercises
      expect(screen.getByText(/main.*idea/i)).toBeInTheDocument()
      expect(screen.getByText(/detail.*comprehension/i)).toBeInTheDocument()
      expect(screen.getByText(/inference/i)).toBeInTheDocument()
      expect(screen.getByText(/vocabulary/i)).toBeInTheDocument()

      // Check for specialized practice badges
      const specializedBadges = screen.getAllByText(/specialized.*practice/i)
      expect(specializedBadges.length).toBe(2)
    })
  })
})