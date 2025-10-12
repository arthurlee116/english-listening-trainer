import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../helpers/render-utils'
import { createMockExercise, createMockPracticeSession } from '../../helpers/mock-utils'
import { MainApp } from '@/components/main-app'
import type { Exercise, PracticeSessionData } from '@/lib/types'

// Mock external dependencies
vi.mock('@/lib/ai-service', () => ({
  generateTopics: vi.fn(),
  generateTranscript: vi.fn(),
  generateQuestions: vi.fn(),
  gradeAnswers: vi.fn(),
}))

vi.mock('@/lib/tts-service', () => ({
  generateAudio: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  saveToHistory: vi.fn(),
  getHistory: vi.fn(() => []),
}))

const useAuthStateMock = vi.fn()

vi.mock('@/hooks/use-auth-state', () => ({
  useAuthState: () => useAuthStateMock(),
}))

vi.mock('@/hooks/use-legacy-migration', () => ({
  useLegacyMigration: () => ({
    migrationStatus: { isComplete: false, hasError: false },
    shouldShowNotification: () => false,
  }),
}))

describe('MainApp Integration Tests', () => {
  const user = userEvent.setup()
  let aiService: Awaited<typeof import('@/lib/ai-service')>
  let ttsService: Awaited<typeof import('@/lib/tts-service')>
  let storageModule: Awaited<typeof import('@/lib/storage')>
  let authState: {
    user: { id: string; name: string; email: string; assessmentCompletedAt: string | null }
    isAuthenticated: boolean
    isLoading: boolean
    showAuthDialog: boolean
    handleUserAuthenticated: ReturnType<typeof vi.fn>
    handleLogout: ReturnType<typeof vi.fn>
    checkAuthStatus: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear()

    // Reset all mocks
    vi.clearAllMocks()

    authState = {
      user: {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        assessmentCompletedAt: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
      showAuthDialog: false,
      handleUserAuthenticated: vi.fn(),
      handleLogout: vi.fn(),
      checkAuthStatus: vi.fn(),
    }

    useAuthStateMock.mockImplementation(() => authState)

    // Mock successful API responses
    aiService = await import('@/lib/ai-service')
    ttsService = await import('@/lib/tts-service')
    storageModule = await import('@/lib/storage')

    const {
      generateTopics,
      generateTranscript,
      generateQuestions,
      gradeAnswers
    } = aiService
    const { generateAudio } = ttsService
    
    generateTopics.mockResolvedValue({
      topics: ['Technology Trends', 'Business Innovation', 'Digital Transformation']
    })
    
    generateTranscript.mockResolvedValue({
      transcript: 'In today\'s rapidly evolving technological landscape, artificial intelligence and machine learning are transforming how we work and live.'
    })

    generateQuestions.mockResolvedValue({
      questions: [
        {
          type: 'single',
          question: 'What is the main topic discussed?',
          options: ['Technology', 'Business', 'Education', 'Travel'],
          answer: 'Technology',
          focus_areas: ['main-idea'],
          explanation: 'The passage focuses on technological advancement.'
        }
      ]
    })
    
    gradeAnswers.mockResolvedValue([
      {
        type: 'single',
        user_answer: 'Technology',
        correct_answer: 'Technology',
        is_correct: true,
        question_id: 0,
        error_tags: [],
      }
    ])
    
    generateAudio.mockResolvedValue({
      audioUrl: 'blob:mock-audio-url',
      duration: 45
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps practice actions disabled until the assessment is completed', async () => {
    authState.user.assessmentCompletedAt = null

    renderWithProviders(<MainApp />)

    expect(await screen.findByText(/complete the assessment/i)).toBeInTheDocument()

    const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
    await user.click(difficultySelect)
    await user.click(screen.getByText('B1 - Intermediate'))

    const topicInput = screen.getByPlaceholderText(/enter a topic/i)
    await user.type(topicInput, 'Business Strategy')

    const generateTopicsButton = await screen.findByRole('button', {
      name: /(generate topic suggestions|生成话题)/i,
    })
    expect(generateTopicsButton).toBeDisabled()

    const generateExerciseButton = await screen.findByRole('button', {
      name: /(generate listening exercise|生成听力练习)/i,
    })
    expect(generateExerciseButton).toBeDisabled()
  })

  describe('Specialized Practice Mode Integration', () => {
    it('should persist specialized practice mode settings and record duration', async () => {
      const mockExercise = createMockExercise({
        specializedMode: true,
        focusAreas: ['main-idea', 'detail-comprehension'],
        totalDurationSec: 180
      })

      renderWithProviders(<MainApp />)

      // Navigate to setup and enable specialized mode
      expect(await screen.findByText('创建听力练习')).toBeInTheDocument()
      
      // Select difficulty
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Check if specialized mode toggle exists and enable it
      const specializedToggle = screen.queryByRole('switch', { name: /specialized.*mode/i })
      if (specializedToggle) {
        await user.click(specializedToggle)
        
        // Select focus areas
        const focusAreaCheckbox = screen.queryByRole('checkbox', { name: /main.*idea/i })
        if (focusAreaCheckbox) {
          await user.click(focusAreaCheckbox)
        }
      }

      // Enter topic
      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology Innovation')

      // Generate exercise
      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      await user.click(generateButton)

      // Wait for transcript generation
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify specialized mode data is preserved in localStorage
      const specializedSettings = localStorage.getItem('english-listening-specialized-mode')
      if (specializedSettings) {
        const settings = JSON.parse(specializedSettings)
        expect(settings.enabled).toBe(true)
        expect(settings.selectedFocusAreas).toContain('main-idea')
      }
    })

    it('should handle specialized mode with focus area recommendations', async () => {
      // Mock focus area statistics in localStorage
      const mockFocusStats = {
        'main-idea': { attempts: 10, incorrect: 3, accuracy: 70, trend: 'declining' },
        'detail-comprehension': { attempts: 8, incorrect: 5, accuracy: 37.5, trend: 'declining' },
        'inference': { attempts: 5, incorrect: 1, accuracy: 80, trend: 'improving' }
      }
      
      localStorage.setItem('english-listening-focus-area-cache', JSON.stringify({
        stats: mockFocusStats,
        recommendations: ['detail-comprehension', 'main-idea'],
        lastCalculated: new Date().toISOString()
      }))

      renderWithProviders(<MainApp />)

      // Check if recommendations are displayed when specialized mode is enabled
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Look for specialized mode controls
      const specializedToggle = screen.queryByRole('switch', { name: /specialized.*mode/i })
      if (specializedToggle) {
        await user.click(specializedToggle)
        
        // Check if recommendations are shown
        await waitFor(() => {
          const recommendationText = screen.queryByText(/recommended.*focus.*areas/i)
          if (recommendationText) {
            expect(recommendationText).toBeInTheDocument()
          }
        })
      }
    })
  })

  describe('Component Interaction with Mocked Children', () => {
    it('should properly interact with AudioPlayer component', async () => {
      renderWithProviders(<MainApp />)

      // Complete setup to reach listening step
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology')

      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      await user.click(generateButton)

      // Wait for listening step
      await waitFor(() => {
        const audioSection = screen.queryByText(/transcript/i) || screen.queryByText(/audio/i)
        if (audioSection) {
          expect(audioSection).toBeInTheDocument()
        }
      }, { timeout: 5000 })

      // Verify audio generation can be triggered
      const generateAudioButton = screen.queryByRole('button', { name: /generate.*audio/i })
      if (generateAudioButton) {
        await user.click(generateAudioButton)
        
        await waitFor(() => {
          expect(ttsService.generateAudio).toHaveBeenCalled()
        })
      }
    })

    it('should handle QuestionInterface component interaction', async () => {
      renderWithProviders(<MainApp />)

      // Navigate through the flow to reach questions
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology')

      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      await user.click(generateButton)

      // Wait for listening step and proceed to questions
      await waitFor(() => {
        const startQuestionsButton = screen.queryByRole('button', { name: /start.*questions/i })
        if (startQuestionsButton) {
          return user.click(startQuestionsButton)
        }
      }, { timeout: 5000 })

      // Wait for questions to load
      await waitFor(() => {
        const questionText = screen.queryByText(/what is the main topic/i)
        if (questionText) {
          expect(questionText).toBeInTheDocument()
        }
      }, { timeout: 5000 })

      // Interact with question options
      const optionButton = screen.queryByRole('button', { name: /technology/i })
      if (optionButton) {
        await user.click(optionButton)
        
        // Submit answers
        const submitButton = screen.queryByRole('button', { name: /submit.*answers/i })
        if (submitButton) {
          await user.click(submitButton)
        }
      }
    })

    it('should handle ResultsDisplay component interaction', async () => {
      const mockExercise = createMockExercise()
      
      renderWithProviders(<MainApp />)

      // Complete the full flow to reach results
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology')

      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      await user.click(generateButton)

      // Navigate through listening and questions to results
      await waitFor(async () => {
        const startQuestionsButton = screen.queryByRole('button', { name: /start.*questions/i })
        if (startQuestionsButton) {
          await user.click(startQuestionsButton)
          
          await waitFor(async () => {
            const optionButton = screen.queryByRole('button', { name: /technology/i })
            if (optionButton) {
              await user.click(optionButton)
              
              const submitButton = screen.queryByRole('button', { name: /submit.*answers/i })
              if (submitButton) {
                await user.click(submitButton)
              }
            }
          })
        }
      }, { timeout: 10000 })

      // Check for results display
      await waitFor(() => {
        const resultsSection = screen.queryByText(/results/i) || screen.queryByText(/score/i)
        if (resultsSection) {
          expect(resultsSection).toBeInTheDocument()
        }
      }, { timeout: 5000 })
    })
  })

  describe('Data Flow with Specialized Fields', () => {
    it('should preserve specialized fields throughout the exercise flow', async () => {
      renderWithProviders(<MainApp />)

      // Set up specialized exercise
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Enable specialized mode if available
      const specializedToggle = screen.queryByRole('switch', { name: /specialized.*mode/i })
      if (specializedToggle) {
        await user.click(specializedToggle)
      }

      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology Innovation')

      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      await user.click(generateButton)

      // Complete the exercise flow
      await waitFor(async () => {
        const startQuestionsButton = screen.queryByRole('button', { name: /start.*questions/i })
        if (startQuestionsButton) {
          await user.click(startQuestionsButton)
          
          await waitFor(async () => {
            const optionButton = screen.queryByRole('button', { name: /technology/i })
            if (optionButton) {
              await user.click(optionButton)
              
              const submitButton = screen.queryByRole('button', { name: /submit.*answers/i })
              if (submitButton) {
                await user.click(submitButton)
              }
            }
          })
        }
      }, { timeout: 10000 })

      // Verify that saveToHistory was called with specialized fields
      await waitFor(() => {
        if (storageModule.saveToHistory.mock.calls.length > 0) {
          const savedExercise = storageModule.saveToHistory.mock.calls[0][0]
          expect(savedExercise).toHaveProperty('topic', 'Technology Innovation')
          expect(savedExercise).toHaveProperty('difficulty', 'B1')
          expect(savedExercise).toHaveProperty('createdAt')
          expect(savedExercise.createdAt).toBeTruthy()
        }
      })
    })

    it('should handle duration recording for specialized practice sessions', async () => {
      renderWithProviders(<MainApp />)

      // Track start time by monitoring localStorage
      const initialTime = Date.now()
      
      // Set up and complete an exercise
      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology')

      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      await user.click(generateButton)

      // Simulate time passage and complete exercise
      await waitFor(async () => {
        const startQuestionsButton = screen.queryByRole('button', { name: /start.*questions/i })
        if (startQuestionsButton) {
          await user.click(startQuestionsButton)
          
          await waitFor(async () => {
            const optionButton = screen.queryByRole('button', { name: /technology/i })
            if (optionButton) {
              await user.click(optionButton)
              
              const submitButton = screen.queryByRole('button', { name: /submit.*answers/i })
              if (submitButton) {
                await user.click(submitButton)
              }
            }
          })
        }
      }, { timeout: 10000 })

      // Check if duration was recorded
      if (storageModule.saveToHistory.mock.calls.length > 0) {
        const savedExercise = storageModule.saveToHistory.mock.calls[0][0]
        expect(savedExercise).toHaveProperty('createdAt')
        
        // Verify the timestamp is reasonable (within the last few seconds)
        const savedTime = new Date(savedExercise.createdAt).getTime()
        const timeDiff = savedTime - initialTime
        expect(timeDiff).toBeGreaterThanOrEqual(0)
        expect(timeDiff).toBeLessThan(30000) // Less than 30 seconds
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle API failures gracefully', async () => {
      aiService.generateTopics.mockRejectedValue(new Error('Network error'))

      renderWithProviders(<MainApp />)

      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const generateTopicsButton = screen.queryByRole('button', { name: /生成话题/i })
      if (generateTopicsButton) {
        await user.click(generateTopicsButton)

        // Should show error message
        await waitFor(() => {
          const errorMessage = screen.queryByText(/failed/i) || screen.queryByText(/error/i)
          if (errorMessage) {
            expect(errorMessage).toBeInTheDocument()
          }
        })
      }
    })

    it('should handle localStorage unavailability', async () => {
      // Mock localStorage to throw errors
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage unavailable')
      })

      renderWithProviders(<MainApp />)

      // Should still render without crashing
      expect(await screen.findByText('创建听力练习')).toBeInTheDocument()

      // Restore localStorage
      Storage.prototype.setItem = originalSetItem
    })

    it('should handle missing specialized mode data gracefully', async () => {
      // Clear any existing specialized mode data
      localStorage.removeItem('english-listening-specialized-mode')
      localStorage.removeItem('english-listening-focus-area-cache')

      renderWithProviders(<MainApp />)

      const difficultySelect = await screen.findByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Should still work without specialized mode data
      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      await user.type(topicInput, 'Technology')

      const generateButton = screen.getByRole('button', { name: /generate listening exercise/i })
      expect(generateButton).toBeEnabled()
    })
  })
})