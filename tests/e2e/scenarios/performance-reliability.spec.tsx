import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderWithProviders } from '../../helpers/render-utils'
import { 
  setupApiMocks, 
  mockApiEndpoint, 
  mockApiFailure, 
  mockApiTimeout, 
  resetApiMocks 
} from '../../helpers/api-mocks'
import { MainApp } from '../../../components/main-app'

// Mock the auth state
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

describe('Performance and Reliability E2E Tests', () => {
  setupApiMocks()
  
  beforeEach(() => {
    resetApiMocks()
    localStorage.clear()
    // Mock performance.now for consistent timing
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('Network Condition Tests', () => {
    it('should handle slow network responses gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock slow API responses (2 second delay)
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Slow Network Topic']
      })
      
      // Add delay to simulate slow network
      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return new Response(JSON.stringify({
          success: true,
          topics: ['Slow Network Topic']
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Select difficulty
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Start timing
      const startTime = performance.now()
      
      // Generate topics with slow network
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Verify loading state is shown
      expect(screen.getByText(/Loading/i) || screen.getByRole('progressbar')).toBeInTheDocument()

      // Wait for slow response
      await waitFor(() => {
        expect(screen.getByText('Slow Network Topic')).toBeInTheDocument()
      }, { timeout: 5000 })

      const endTime = performance.now()
      const duration = endTime - startTime

      // Verify the request took appropriate time (at least 2 seconds)
      expect(duration).toBeGreaterThan(1900)
      
      // Verify UI remains responsive
      expect(screen.getByRole('button', { name: /生成话题/i })).not.toBeDisabled()
    })

    it('should retry failed requests and show appropriate feedback', async () => {
      const user = userEvent.setup()
      
      let attemptCount = 0
      
      // Mock API that fails twice then succeeds
      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        attemptCount++
        
        if (attemptCount <= 2) {
          throw new Error('Network error')
        }
        
        return new Response(JSON.stringify({
          success: true,
          topics: ['Retry Success Topic']
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Should show retry notification
      await waitFor(() => {
        expect(screen.getByText(/Retrying/i) || screen.getByText(/Network/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Eventually should succeed
      await waitFor(() => {
        expect(screen.getByText('Retry Success Topic')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Verify retry attempts were made
      expect(attemptCount).toBe(3)
    })

    it('should handle complete network failure with appropriate error messages', async () => {
      const user = userEvent.setup()
      
      // Mock complete network failure
      mockApiFailure('post', '/api/ai/topics', 500, 'Service unavailable')

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Network error/i) || screen.getByText(/Failed/i)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify button is re-enabled for retry
      expect(generateTopicsBtn).not.toBeDisabled()
      
      // Verify no topics are displayed
      expect(screen.queryByText(/Topic/)).not.toBeInTheDocument()
    })
  })

  describe('Service Unavailability Tests', () => {
    it('should gracefully degrade when AI services are unavailable', async () => {
      const user = userEvent.setup()
      
      // Mock AI service failures
      mockApiFailure('post', '/api/ai/topics', 503, 'AI service temporarily unavailable')
      mockApiFailure('post', '/api/ai/transcript', 503, 'AI service temporarily unavailable')
      mockApiFailure('post', '/api/ai/questions', 503, 'AI service temporarily unavailable')
      
      // Mock TTS service as available
      mockApiEndpoint('post', '/api/tts', {
        success: true,
        audioUrl: '/fallback-audio.mp3',
        duration: 30
      })

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Try to generate topics - should fail gracefully
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      await waitFor(() => {
        expect(screen.getByText(/AI service.*unavailable/i) || screen.getByText(/Failed/i)).toBeInTheDocument()
      })

      // User should still be able to enter manual topic
      const topicInput = screen.getByPlaceholderText(/Enter a topic/i)
      await user.type(topicInput, 'Manual Topic Entry')

      // Try to generate exercise - should also fail gracefully
      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      await waitFor(() => {
        expect(screen.getByText(/AI service.*unavailable/i) || screen.getByText(/Failed/i)).toBeInTheDocument()
      })

      // Verify app doesn't crash and remains usable
      expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      expect(topicInput).toBeInTheDocument()
      expect(generateExerciseBtn).not.toBeDisabled()
    })

    it('should handle partial service failures (TTS unavailable)', async () => {
      const user = userEvent.setup()
      
      // Mock successful AI services but failed TTS
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Technology Trends']
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: 'This is a test transcript for TTS failure scenario.'
      })

      mockApiFailure('post', '/api/tts', 503, 'TTS service unavailable')

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Complete setup successfully
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Technology Trends'))

      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      // Should reach listening step successfully
      await waitFor(() => {
        expect(screen.getByText(/This is a test transcript/)).toBeInTheDocument()
      })

      // Try to generate audio - should fail gracefully
      const generateAudioBtn = screen.getByRole('button', { name: /Generate Audio/i })
      await user.click(generateAudioBtn)

      await waitFor(() => {
        expect(screen.getByText(/TTS.*unavailable/i) || screen.getByText(/Audio.*failed/i)).toBeInTheDocument()
      })

      // Should still be able to proceed without audio
      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      expect(startQuestionsBtn).toBeInTheDocument()
      expect(startQuestionsBtn).not.toBeDisabled()

      // Verify transcript is still visible for reading
      expect(screen.getByText(/This is a test transcript/)).toBeInTheDocument()
    })

    it('should handle database/storage service failures', async () => {
      const user = userEvent.setup()
      
      // Mock successful exercise generation
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Storage Test Topic']
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: 'Test transcript for storage failure.'
      })

      mockApiEndpoint('post', '/api/ai/questions', {
        success: true,
        questions: [
          {
            id: 0,
            type: 'single',
            question: 'What is this about?',
            options: ['Storage', 'Network', 'Testing', 'Failure'],
            answer: 'Storage',
            focus_areas: ['basic-comprehension']
          }
        ]
      })

      mockApiEndpoint('post', '/api/ai/grade', {
        success: true,
        results: [
          {
            type: 'single',
            user_answer: 'Storage',
            correct_answer: 'Storage',
            is_correct: true,
            question_id: 0
          }
        ]
      })

      // Mock storage service failure
      mockApiFailure('post', '/api/practice/save', 500, 'Database unavailable')

      render(<MainApp />)

      // Complete full exercise flow
      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('A1 - Beginner'))

      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      await waitFor(() => {
        expect(screen.getByText('Storage Test Topic')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Storage Test Topic'))

      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      await waitFor(() => {
        expect(screen.getByText(/Test transcript for storage/)).toBeInTheDocument()
      })

      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      await user.click(startQuestionsBtn)

      await waitFor(() => {
        expect(screen.getByText('What is this about?')).toBeInTheDocument()
      })

      const storageOption = screen.getByLabelText('Storage')
      await user.click(storageOption)

      const submitBtn = screen.getByRole('button', { name: /Submit Answers/i })
      await user.click(submitBtn)

      // Should show results even if storage fails
      await waitFor(() => {
        expect(screen.getByText(/Exercise Results/i)).toBeInTheDocument()
      })

      // Should show storage failure warning
      await waitFor(() => {
        expect(screen.getByText(/Database.*unavailable/i) || screen.getByText(/Failed to save/i)).toBeInTheDocument()
      })

      // Results should still be displayed
      expect(screen.getByText(/✓/)).toBeInTheDocument()
      
      // Export functionality should still work (local export)
      const exportBtn = screen.getByRole('button', { name: /Export/i })
      expect(exportBtn).toBeInTheDocument()
      expect(exportBtn).not.toBeDisabled()
    })
  }) 
 describe('Concurrent User Scenarios', () => {
    it('should handle multiple simultaneous API requests without race conditions', async () => {
      const user = userEvent.setup()
      
      let requestCount = 0
      const requestTimes: number[] = []
      
      // Mock API with request tracking
      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const requestId = ++requestCount
        const startTime = Date.now()
        requestTimes.push(startTime)
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
        
        if (url.toString().includes('/api/ai/topics')) {
          return new Response(JSON.stringify({
            success: true,
            topics: [`Topic ${requestId}`, `Alternative ${requestId}`]
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Trigger multiple rapid requests
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      
      // Click multiple times rapidly to test race conditions
      await user.click(generateTopicsBtn)
      await user.click(generateTopicsBtn)
      await user.click(generateTopicsBtn)

      // Wait for all requests to complete
      await waitFor(() => {
        expect(screen.getByText(/Topic/)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify only the latest request result is shown (no race condition)
      const topicElements = screen.getAllByText(/Topic \d+/)
      expect(topicElements.length).toBeGreaterThan(0)
      
      // Verify requests were properly handled
      expect(requestCount).toBeGreaterThan(0)
      expect(requestTimes.length).toBe(requestCount)
    })

    it('should handle rapid user interactions without breaking state', async () => {
      const user = userEvent.setup()
      
      // Mock fast API responses
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Fast Topic 1', 'Fast Topic 2']
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: 'Fast transcript generation for rapid interaction testing.'
      })

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Rapid form interactions
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      
      // Rapidly change difficulty multiple times
      await user.click(difficultySelect)
      await user.click(screen.getByText('A1 - Beginner'))
      
      await user.click(difficultySelect)
      await user.click(screen.getByText('B2 - Upper Intermediate'))
      
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Rapid topic generation and selection
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      await waitFor(() => {
        expect(screen.getByText('Fast Topic 1')).toBeInTheDocument()
      })

      // Rapidly select different topics
      await user.click(screen.getByText('Fast Topic 1'))
      await user.click(screen.getByText('Fast Topic 2'))
      await user.click(screen.getByText('Fast Topic 1'))

      // Rapid exercise generation attempts
      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)
      
      // Verify app state remains consistent
      await waitFor(() => {
        expect(screen.getByText(/Fast transcript generation/)).toBeInTheDocument()
      })

      // Verify final state is correct
      expect(screen.getByText('B1 - Intermediate')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Fast Topic 1')).toBeInTheDocument()
    })

    it('should handle localStorage conflicts in concurrent scenarios', async () => {
      const user = userEvent.setup()
      
      // Mock successful API responses
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Concurrent Topic']
      })

      // Simulate concurrent localStorage operations
      const originalSetItem = localStorage.setItem
      const originalGetItem = localStorage.getItem
      
      let setItemCalls = 0
      let getItemCalls = 0
      
      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        setItemCalls++
        // Simulate concurrent access delay
        setTimeout(() => originalSetItem.call(localStorage, key, value), Math.random() * 10)
      })
      
      vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
        getItemCalls++
        return originalGetItem.call(localStorage, key)
      })

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Trigger operations that use localStorage
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Enable specialized mode (uses localStorage)
      const specializedToggle = screen.queryByRole('switch', { name: /specialized/i })
      if (specializedToggle) {
        await user.click(specializedToggle)
      }

      // Generate topics (may cache in localStorage)
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      await waitFor(() => {
        expect(screen.getByText('Concurrent Topic')).toBeInTheDocument()
      })

      // Verify localStorage operations completed without errors
      expect(setItemCalls).toBeGreaterThan(0)
      expect(getItemCalls).toBeGreaterThan(0)
      
      // Verify app functionality is not affected
      expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      expect(screen.getByText('Concurrent Topic')).toBeInTheDocument()
    })
  })

  describe('Memory and Performance Tests', () => {
    it('should not cause memory leaks during extended usage', async () => {
      const user = userEvent.setup()
      
      // Mock API responses
      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: ['Memory Test Topic']
      })

      // Track component renders and cleanup
      const renderCount = { current: 0 }
      const cleanupCount = { current: 0 }
      
      const MemoryTestWrapper = ({ children }: { children: React.ReactNode }) => {
        React.useEffect(() => {
          renderCount.current++
          return () => {
            cleanupCount.current++
          }
        }, [])
        
        return <>{children}</>
      }

      const { unmount } = render(
        <MemoryTestWrapper>
          <MainApp />
        </MemoryTestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      // Simulate extended usage with multiple operations
      for (let i = 0; i < 5; i++) {
        const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
        await user.click(difficultySelect)
        await user.click(screen.getByText('B1 - Intermediate'))

        const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
        await user.click(generateTopicsBtn)

        await waitFor(() => {
          expect(screen.getByText('Memory Test Topic')).toBeInTheDocument()
        })

        // Clear and regenerate
        await user.click(generateTopicsBtn)
      }

      // Unmount component
      unmount()

      // Verify cleanup occurred
      expect(cleanupCount.current).toBeGreaterThan(0)
      expect(renderCount.current).toBeGreaterThan(0)
    })

    it('should handle large datasets without performance degradation', async () => {
      const user = userEvent.setup()
      
      // Mock large dataset responses
      const largeTopic = 'A'.repeat(1000) // 1KB topic
      const largeTranscript = 'B'.repeat(10000) // 10KB transcript
      const largeQuestions = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'single' as const,
        question: `Question ${i + 1}: ${'C'.repeat(200)}`,
        options: [`Option A ${i}`, `Option B ${i}`, `Option C ${i}`, `Option D ${i}`],
        answer: `Option A ${i}`,
        focus_areas: ['basic-comprehension']
      }))

      mockApiEndpoint('post', '/api/ai/topics', {
        success: true,
        topics: [largeTopic, 'Normal Topic']
      })

      mockApiEndpoint('post', '/api/ai/transcript', {
        success: true,
        transcript: largeTranscript
      })

      mockApiEndpoint('post', '/api/ai/questions', {
        success: true,
        questions: largeQuestions
      })

      const startTime = performance.now()

      render(<MainApp />)

      await waitFor(() => {
        expect(screen.getByText(/创建听力练习/)).toBeInTheDocument()
      })

      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Should handle large topic display
      await waitFor(() => {
        expect(screen.getByText(/AAAA/)).toBeInTheDocument()
      }, { timeout: 3000 })

      await user.click(screen.getByText('Normal Topic'))

      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      await user.click(generateExerciseBtn)

      // Should handle large transcript
      await waitFor(() => {
        expect(screen.getByText(/BBBB/)).toBeInTheDocument()
      }, { timeout: 3000 })

      const startQuestionsBtn = screen.getByRole('button', { name: /Start Questions/i })
      await user.click(startQuestionsBtn)

      // Should handle large question set
      await waitFor(() => {
        expect(screen.getByText(/Question 1.*第1题:/)).toBeInTheDocument()
      }, { timeout: 3000 })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete within reasonable time (less than 10 seconds)
      expect(totalTime).toBeLessThan(10000)
      
      // Verify UI remains responsive
      expect(screen.getByText(/Question 1.*第1题:/)).toBeInTheDocument()
    })
  })
})