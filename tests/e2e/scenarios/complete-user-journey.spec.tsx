import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderWithProviders } from '../../helpers/render-utils'
import { setupApiMocks, mockApiEndpoint, resetApiMocks } from '../../helpers/api-mocks'
import { createMockExercise, createMockQuestion } from '../../helpers/mock-utils'
import { MainApp } from '../../../components/main-app'
import type { Question, Exercise, FocusArea } from '../../../lib/types'

// Mock the auth state to simulate authenticated user
vi.mock('../../../hooks/use-auth-state', () => ({
  useAuthState: () => ({
    user: { id: 'test-user', email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
    isLoading: false,
    showAuthDialog: false,
    handleUserAuthenticated: vi.fn(),
    handleLogout: vi.fn()
  })
}))

// Mock legacy migration hook
vi.mock('../../../hooks/use-legacy-migration', () => ({
  useLegacyMigration: () => ({
    migrationStatus: { isComplete: true, hasError: false },
    shouldShowNotification: () => false
  })
}))

describe('Complete User Journey E2E Tests', () => {
  setupApiMocks()
  
  beforeEach(() => {
    resetApiMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Generate → Answer → Results Flow', () => {
    it('should complete full exercise generation and answering flow', async () => {
      const user = userEvent.setup()
      
      // Mock successful API responses for the complete flow
      const mockQuestions: Question[] = [
        {
          id: 0,
          type: 'single',
          question: 'What is the main topic discussed?',
          options: ['Technology', 'Sports', 'Travel', 'Food'],
          answer: 'Technology',
          focus_areas: ['main-idea']
        },
        {
          id: 1,
          type: 'short',
          question: 'What benefits are mentioned?',
          options: null,
          answer: 'Improved efficiency and cost reduction',
          focus_areas: ['detail-comprehension']
        }
      ]

      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Technology Trends', 'Digital Innovation', 'Future of Work']
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: 'In today\'s digital age, technology continues to revolutionize how we work and communicate. Companies are adopting new tools to improve efficiency and reduce costs.'
      })

      mockApiEndpoint('post', '/api/tts', {
        success: true,
        audioUrl: '/test-audio.mp3',
        duration: 45.2
      })

      mockApiEndpoint('post', '/api/ai/questions', {
        success: true,
        questions: mockQuestions,
        focusCoverage: {
          requested: ['main-idea', 'detail-comprehension'],
          provided: ['main-idea', 'detail-comprehension'],
          coverage: 1.0,
          unmatchedTags: []
        }
      })

      mockApiEndpoint('post', '/api/ai/grade', {
        success: true,
        results: [
          {
            type: 'single',
            user_answer: 'Technology',
            correct_answer: 'Technology',
            is_correct: true,
            question_id: 0
          },
          {
            type: 'short',
            user_answer: 'Better efficiency',
            correct_answer: 'Improved efficiency and cost reduction',
            is_correct: false,
            question_id: 1,
            score: 7,
            short_feedback: 'Partially correct, missing cost reduction aspect.'
          }
        ]
      })

      mockApiEndpoint('post', '/api/practice/save', {
        success: true,
        sessionId: 'test-session-123'
      })

      renderWithProviders(<MainApp />)

      // Step 1: Setup - Select difficulty and generate topics
      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Select difficulty level
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Generate topics
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Wait for topics to load and select one
      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Technology Trends'))

      // Generate exercise
      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      // Step 2: Listening - Generate audio and start questions
      await waitFor(() => {
        expect(screen.getByText(/technology continues to revolutionize/i)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Generate audio
      const generateAudioBtn = screen.getByRole('button', { name: /Generate Audio/i })
      await user.click(generateAudioBtn)

      await waitFor(() => {
        expect(screen.getByText(/Audio generated successfully/i)).toBeInTheDocument()
      })

      // Start questions
      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      await user.click(startQuestionsBtn)

      // Step 3: Questions - Answer questions
      await waitFor(() => {
        expect(screen.getByText('What is the main topic discussed?')).toBeInTheDocument()
      })

      // Answer first question (multiple choice)
      const technologyOption = screen.getByLabelText('Technology')
      await user.click(technologyOption)

      // Answer second question (short answer)
      const shortAnswerInput = screen.getByLabelText(/What benefits are mentioned/i)
      await user.type(shortAnswerInput, 'Better efficiency')

      // Submit answers
      const submitBtn = screen.getByRole('button', { name: /Submit Answers/i })
      await user.click(submitBtn)

      // Step 4: Results - Verify results display
      await waitFor(() => {
        expect(screen.getByText(/Exercise Results/i)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify correct answer is shown as correct
      expect(screen.getByText(/✓/)).toBeInTheDocument()
      
      // Verify incorrect answer feedback
      expect(screen.getByText(/Partially correct/i)).toBeInTheDocument()
      
      // Verify score display
      expect(screen.getByText(/Score:/i)).toBeInTheDocument()
    })
  })

  describe('Specialized Practice Flow', () => {
    it('should complete specialized practice with focus area selection and coverage tracking', async () => {
      const user = userEvent.setup()
      
      // Mock focus area statistics and recommendations
      mockApiEndpoint('get', '/api/wrong-answers/list', {
        success: true,
        wrongAnswers: [
          {
            id: 'wrong-1',
            questionData: createMockQuestion({ focus_areas: ['inference'] }),
            userAnswer: 'Wrong answer',
            correctAnswer: 'Correct answer',
            topic: 'Technology',
            difficulty: 'B1',
            createdAt: new Date().toISOString()
          }
        ]
      })

      mockApiEndpoint('get', '/api/practice/history', {
        success: true,
        sessions: []
      })

      // Mock specialized topic generation with focus coverage
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Advanced Technology Concepts', 'Complex Business Strategies'],
        focusCoverage: {
          requested: ['inference', 'detail-comprehension'],
          provided: ['inference', 'detail-comprehension'],
          coverage: 0.9,
          unmatchedTags: []
        }
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: 'The implications of artificial intelligence in modern business are far-reaching. While the benefits are clear, the underlying challenges require careful consideration and strategic planning.'
      })

      mockApiEndpoint('post', '/api/ai/questions', {
        success: true,
        questions: [
          {
            id: 0,
            type: 'single',
            question: 'What can be inferred about AI implementation challenges?',
            options: ['They are minor', 'They require strategic planning', 'They are insurmountable', 'They are unclear'],
            answer: 'They require strategic planning',
            focus_areas: ['inference']
          },
          {
            id: 1,
            type: 'short',
            question: 'What specific aspect of AI benefits is mentioned?',
            options: null,
            answer: 'The benefits are clear',
            focus_areas: ['detail-comprehension']
          }
        ],
        focusCoverage: {
          requested: ['inference', 'detail-comprehension'],
          provided: ['inference', 'detail-comprehension'],
          coverage: 1.0,
          unmatchedTags: []
        },
        focusMatch: [
          {
            questionIndex: 0,
            matchedTags: ['inference'],
            confidence: 'high'
          },
          {
            questionIndex: 1,
            matchedTags: ['detail-comprehension'],
            confidence: 'high'
          }
        ]
      })

      renderWithProviders(<MainApp />)

      // Wait for app to load and focus area data to be computed
      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Enable specialized mode
      const specializedModeToggle = screen.getByRole('switch', { name: /specialized practice/i })
      await user.click(specializedModeToggle)

      // Wait for recommendations to load
      await waitFor(() => {
        expect(screen.getByText(/Recommended Focus Areas/i)).toBeInTheDocument()
      })

      // Select focus areas
      const inferenceCheckbox = screen.getByLabelText(/Inference/i)
      const detailCheckbox = screen.getByLabelText(/Detail Comprehension/i)
      
      await user.click(inferenceCheckbox)
      await user.click(detailCheckbox)

      // Select difficulty
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B2 - Upper Intermediate'))

      // Generate specialized topics
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Verify coverage information is displayed
      await waitFor(() => {
        expect(screen.getByText(/Coverage: 90%/i)).toBeInTheDocument()
      })

      // Select a topic and continue with exercise
      await user.click(screen.getByText('Advanced Technology Concepts'))

      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      // Verify specialized content is generated
      await waitFor(() => {
        expect(screen.getByText(/implications of artificial intelligence/i)).toBeInTheDocument()
      })

      // Continue through the flow to verify focus area tracking
      const generateAudioBtn = screen.getByRole('button', { name: /Generate Audio/i })
      await user.click(generateAudioBtn)

      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      await user.click(startQuestionsBtn)

      // Verify focus-specific questions are generated
      await waitFor(() => {
        expect(screen.getByText(/What can be inferred about AI implementation/i)).toBeInTheDocument()
      })

      // Verify focus area tags are displayed on questions
      expect(screen.getByText(/Inference/i)).toBeInTheDocument()
      expect(screen.getByText(/Detail Comprehension/i)).toBeInTheDocument()
    })
  })

  describe('Achievement System Integration', () => {
    it('should track practice minutes and trigger goal completion achievements', async () => {
      const user = userEvent.setup()
      
      // Mock achievement system responses
      mockApiEndpoint('post', '/api/achievements/practice-completed', {
        success: true,
        newAchievements: [
          {
            id: 'daily-goal-1',
            type: 'daily_goal',
            achievement: {
              id: 'daily-goal-1',
              titleKey: 'achievements.dailyGoal.title',
              descriptionKey: 'achievements.dailyGoal.description',
              iconType: 'target',
              category: 'practice',
              requirement: { type: 'daily_minutes', target: 15 }
            },
            earnedAt: new Date().toISOString(),
            progress: { current: 15, target: 15 }
          }
        ],
        updatedProgress: {
          dailyMinutes: 15,
          weeklyMinutes: 15,
          totalSessions: 1
        }
      })

      // Mock complete exercise flow
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Daily Conversations']
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: 'Good morning! How are you today? I hope you have a wonderful day ahead.'
      })

      mockApiEndpoint('post', '/api/tts', {
        success: true,
        audioUrl: '/test-audio.mp3',
        duration: 30
      })

      mockApiEndpoint('post', '/api/ai/questions', {
        success: true,
        questions: [
          {
            id: 0,
            type: 'single',
            question: 'What greeting is used?',
            options: ['Good morning', 'Good afternoon', 'Good evening', 'Hello'],
            answer: 'Good morning',
            focus_areas: ['basic-comprehension']
          }
        ]
      })

      mockApiEndpoint('post', '/api/ai/grade', {
        success: true,
        results: [
          {
            type: 'single',
            user_answer: 'Good morning',
            correct_answer: 'Good morning',
            is_correct: true,
            question_id: 0
          }
        ]
      })

      mockApiEndpoint('post', '/api/practice/save', {
        success: true,
        sessionId: 'achievement-test-session'
      })

      renderWithProviders(<MainApp />)

      // Complete a full exercise to trigger achievement tracking
      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Set up exercise
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('A1 - Beginner'))

      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      await waitFor(() => {
        expect(screen.getByText('Daily Conversations')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Daily Conversations'))

      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      // Complete listening phase
      await waitFor(() => {
        expect(screen.getByText(/Good morning/i)).toBeInTheDocument()
      })

      const generateAudioBtn = screen.getByRole('button', { name: /Generate Audio/i })
      await user.click(generateAudioBtn)

      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      await user.click(startQuestionsBtn)

      // Answer questions
      await waitFor(() => {
        expect(screen.getByText('What greeting is used?')).toBeInTheDocument()
      })

      const goodMorningOption = screen.getByLabelText('Good morning')
      await user.click(goodMorningOption)

      const submitBtn = screen.getByRole('button', { name: /Submit Answers/i })
      await user.click(submitBtn)

      // Verify achievement notification appears
      await waitFor(() => {
        expect(screen.getByText(/Achievement Earned/i)).toBeInTheDocument()
      }, { timeout: 6000 })

      // Verify achievement details
      expect(screen.getByText(/Daily Goal/i)).toBeInTheDocument()

      // Verify achievement panel can be opened
      const achievementBtn = screen.getByRole('button', { name: /achievements/i })
      await user.click(achievementBtn)

      await waitFor(() => {
        expect(screen.getByText(/Your Achievements/i)).toBeInTheDocument()
      })

      // Verify progress tracking
      expect(screen.getByText(/15 minutes/i)).toBeInTheDocument()
      expect(screen.getByText(/Daily Goal: Complete/i)).toBeInTheDocument()
    })
  })
})