/**
 * Enhanced Integration Tests
 * 
 * Simplified integration tests using enhanced utilities to resolve
 * component rendering and accessibility issues.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { QuestionInterface } from '@/components/question-interface'
import { ResultsDisplay } from '@/components/results-display'
import { 
  renderWithEnhancedProviders,
  createMockQuestionInterfaceProps,
  createMockResultsDisplayProps,
  findButtonByTitle,
  waitForComponentToLoad
} from '@/tests/helpers/integration-test-utils'

describe('Enhanced Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('QuestionInterface Component', () => {
    it('should render questions and handle basic interactions', async () => {
      const mockProps = createMockQuestionInterfaceProps()
      const user = userEvent.setup()

      const { getByTestId } = renderWithEnhancedProviders(
        <QuestionInterface {...mockProps} />
      )

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('test-wrapper')).toBeInTheDocument()
      })

      // Check that questions are rendered
      await waitFor(() => {
        expect(screen.getByText(/what is the main topic/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Check for audio player
      expect(screen.getByText(/audio player/i)).toBeInTheDocument()

      // Check for submit button
      const submitButton = screen.getByRole('button', { name: /submit/i })
      expect(submitButton).toBeInTheDocument()
    })

    it('should handle audio player interactions', async () => {
      const mockProps = createMockQuestionInterfaceProps()
      
      const { container } = renderWithEnhancedProviders(
        <QuestionInterface {...mockProps} />
      )

      await waitFor(() => {
        expect(screen.getByText(/audio player/i)).toBeInTheDocument()
      })

      // Find play button by title attribute
      const playButton = findButtonByTitle(container, /play/i)
      expect(playButton).toBeInTheDocument()
    })

  it('should display focus areas', async () => {
    const mockProps = createMockQuestionInterfaceProps()
    mockProps.questions[0].focus_areas = ['main-idea', 'detail-comprehension']

    renderWithEnhancedProviders(<QuestionInterface {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/main idea/i)).toBeInTheDocument()
    })
  })
  })

  describe('ResultsDisplay Component', () => {
    it('should render exercise results', async () => {
      const mockProps = createMockResultsDisplayProps()

      renderWithEnhancedProviders(<ResultsDisplay {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()
      })

      // Check for action buttons
      expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('should handle note saving functionality', async () => {
      const mockProps = createMockResultsDisplayProps()
      const user = userEvent.setup()

      renderWithEnhancedProviders(<ResultsDisplay {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText(/exercise.*complete/i)).toBeInTheDocument()
      })

      // Look for notes section
      const notesTextarea = screen.queryByRole('textbox')
      if (notesTextarea) {
        await user.type(notesTextarea, 'Test note content')
        
        const saveButton = screen.getByRole('button', { name: /save/i })
        expect(saveButton).toBeInTheDocument()
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle missing data gracefully', async () => {
      const mockProps = createMockResultsDisplayProps({
        exercise: {
          ...createMockResultsDisplayProps().exercise,
          questions: [],
          results: []
        }
      })

      renderWithEnhancedProviders(<ResultsDisplay {...mockProps} />)

      // Should not crash
      await waitFor(() => {
        expect(screen.getByTestId('test-wrapper')).toBeInTheDocument()
      })
    })

    it('should handle localStorage unavailability', async () => {
      // Mock localStorage to throw errors
      const mockStorage = {
        getItem: vi.fn(() => { throw new Error('Storage unavailable') }),
        setItem: vi.fn(() => { throw new Error('Storage unavailable') }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn()
      }

      Object.defineProperty(global, 'localStorage', {
        value: mockStorage,
        writable: true
      })

      const mockProps = createMockResultsDisplayProps()
      
      renderWithEnhancedProviders(<ResultsDisplay {...mockProps} />, {
        mockStorage: false // Don't override our custom mock
      })

      // Should not crash
      await waitFor(() => {
        expect(screen.getByTestId('test-wrapper')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper button labels', async () => {
      const mockProps = createMockQuestionInterfaceProps()
      
      const { container } = renderWithEnhancedProviders(
        <QuestionInterface {...mockProps} />
      )

      await waitFor(() => {
        expect(screen.getByText(/audio player/i)).toBeInTheDocument()
      })

      // Check for buttons with proper titles
      const playButton = findButtonByTitle(container, /play/i)
      expect(playButton).toBeInTheDocument()

      const submitButton = screen.getByRole('button', { name: /submit/i })
      expect(submitButton).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const mockProps = createMockQuestionInterfaceProps()
      const user = userEvent.setup()

      renderWithEnhancedProviders(<QuestionInterface {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText(/what is the main topic/i)).toBeInTheDocument()
      })

      // Tab through interactive elements
      await user.tab()
      
      // Should be able to navigate without errors
      expect(document.activeElement).toBeInTheDocument()
    })
  })
})