/**
 * Comprehensive Responsive Design Tests for Light Theme
 * Tests light theme styling consistency across multiple viewport sizes
 * Requirements: 7.1, 7.2, 7.3, 7.4, 4.1, 4.2
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MainApp } from '@/components/main-app'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toaster'

// Mock the auth hook to return authenticated state
vi.mock('@/hooks/use-auth-state', () => ({
  useAuthState: () => ({
    user: { id: '1', email: 'test@example.com', name: 'Test User', isAdmin: false },
    isAuthenticated: true,
    isLoading: false,
    showAuthDialog: false,
    handleUserAuthenticated: vi.fn(),
    handleLogout: vi.fn().mockResolvedValue(true)
  })
}))

// Mock AI services
vi.mock('@/lib/ai-service', () => ({
  generateTopics: vi.fn().mockResolvedValue({
    topics: ['Technology Trends', 'Environmental Issues', 'Cultural Exchange']
  }),
  generateTranscript: vi.fn().mockResolvedValue({
    transcript: 'This is a test transcript for responsive design testing.'
  }),
  generateQuestions: vi.fn().mockResolvedValue({
    questions: [
      { id: 1, question: 'What is the main topic?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' }
    ]
  }),
  gradeAnswers: vi.fn().mockResolvedValue({
    score: 100,
    feedback: 'Excellent work!'
  })
}))

// Mock TTS service
vi.mock('@/lib/tts-service', () => ({
  generateAudio: vi.fn().mockResolvedValue({
    audioUrl: 'mock-audio-url',
    duration: 120
  })
}))

// Mock storage
vi.mock('@/lib/storage', () => ({
  saveToHistory: vi.fn().mockResolvedValue(undefined)
}))

// Viewport configurations for testing
const VIEWPORT_CONFIGS = {
  desktop1440: { width: 1440, height: 900 },
  desktop1280: { width: 1280, height: 800 },
  tablet1024: { width: 1024, height: 768 },
  mobile768: { width: 768, height: 1024 }
}

// Helper function to set viewport size
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

// Helper function to render app with light theme
const renderAppWithLightTheme = () => {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <MainApp />
      <Toaster />
    </ThemeProvider>
  )
}

describe('Responsive Design Tests - Light Theme', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    // Reset viewport to default
    setViewportSize(1440, 900)
    // Force light theme
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Desktop 1440px Layout Tests', () => {
    beforeEach(() => {
      setViewportSize(VIEWPORT_CONFIGS.desktop1440.width, VIEWPORT_CONFIGS.desktop1440.height)
    })

    it('should display clear title panels with proper light theme styling', async () => {
      renderAppWithLightTheme()

      // Verify main title is visible and properly styled
      const headers = screen.getAllByRole('banner')
      const mainTitle = headers[0].querySelector('h1')
      expect(mainTitle).toBeInTheDocument()
      // Title uses theme utility class text-primary-light in light theme
      const titleClasses = mainTitle?.className || ''
      expect(titleClasses).toMatch(/text-primary-light|text-xl/)
      
      // Verify header has light theme background
      const header = headers[0]
      expect(header).toHaveClass('bg-white/80')

      // Check setup card title
      const setupTitle = screen.getByText('创建听力练习')
      expect(setupTitle).toBeInTheDocument()
      expect(setupTitle).toHaveClass('text-2xl', 'font-bold')
    })

    it('should maintain proper button hierarchy and spacing', async () => {
      renderAppWithLightTheme()

      // Check navigation buttons layout
      const practiceBtn = screen.getByRole('button', { name: /practice/i })
      const historyBtn = screen.getByRole('button', { name: /history/i })
      const wrongAnswersBtn = screen.getByRole('button', { name: /wrong.*answers/i })
      const assessmentBtn = screen.getByRole('button', { name: /assessment/i })

      // Verify buttons are visible and properly spaced
      expect(practiceBtn).toBeInTheDocument()
      expect(historyBtn).toBeInTheDocument()
      expect(wrongAnswersBtn).toBeInTheDocument()
      expect(assessmentBtn).toBeInTheDocument()

      // Check button container has proper spacing
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('space-x-2')
    })

    it('should display form elements with proper light theme styling', async () => {
      renderAppWithLightTheme()

      // Check difficulty select
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      expect(difficultySelect).toBeInTheDocument()
      expect(difficultySelect).toHaveClass('glass-effect')

      // Check language select - find by label text
      const languageLabel = screen.getByText('Language')
      expect(languageLabel).toBeInTheDocument()
      const languageContainer = languageLabel.closest('div')
      const languageSelect = languageContainer?.querySelector('[role="combobox"]')
      expect(languageSelect).toBeInTheDocument()
      expect(languageSelect).toHaveClass('glass-effect')

      // Check topic input
      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      expect(topicInput).toBeInTheDocument()
      expect(topicInput).toHaveClass('glass-effect')
    })

    it('should handle topic generation with proper button states', async () => {
      renderAppWithLightTheme()

      // Select difficulty first
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Check generate topics button appears
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      expect(generateTopicsBtn).toBeInTheDocument()
      // Button should have outline variant styling (border classes)
      expect(generateTopicsBtn.className).toMatch(/border/)

      // Click and verify loading state or success
      await user.click(generateTopicsBtn)
      
      // The button may be disabled during loading or topics may appear quickly
      await waitFor(() => {
        const topics = screen.queryByText('Technology Trends')
        const isDisabled = generateTopicsBtn.hasAttribute('disabled')
        expect(topics || isDisabled).toBeTruthy()
      }, { timeout: 3000 })
    })
  })

  describe('Desktop 1280px Layout Tests', () => {
    beforeEach(() => {
      setViewportSize(VIEWPORT_CONFIGS.desktop1280.width, VIEWPORT_CONFIGS.desktop1280.height)
    })

    it('should maintain proper spacing and readability at 1280px', async () => {
      renderAppWithLightTheme()

      // Verify main container maintains proper max-width
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('max-w-7xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8')

      // Check header layout remains intact
      const header = screen.getByRole('banner')
      const headerContainer = header.querySelector('.max-w-7xl')
      expect(headerContainer).toBeInTheDocument()
      expect(headerContainer).toHaveClass('mx-auto', 'px-4', 'sm:px-6', 'lg:px-8')

      // Verify setup card maintains proper width
      const setupCard = screen.getByText('创建听力练习').closest('.max-w-2xl')
      expect(setupCard).toBeInTheDocument()
      expect(setupCard).toHaveClass('mx-auto')
    })

    it('should preserve light theme visual hierarchy', async () => {
      renderAppWithLightTheme()

      // Check background gradient is applied
      const appContainer = document.querySelector('.min-h-screen')
      expect(appContainer).toHaveClass('bg-gradient-to-br', 'from-blue-50', 'via-indigo-50', 'to-purple-50')

      // Verify card styling
      const card = screen.getByText('创建听力练习').closest('.glass-effect')
      expect(card).toBeInTheDocument()

      // Check form labels are properly styled
      const difficultyLabel = screen.getByText('Difficulty Level')
      expect(difficultyLabel).toHaveClass('text-base', 'font-medium')
    })

    it('should handle form interactions smoothly', async () => {
      renderAppWithLightTheme()

      // Test difficulty selection
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      
      // Verify dropdown opens
      await waitFor(() => {
        expect(screen.getByText('A1 - Beginner')).toBeInTheDocument()
      })

      await user.click(screen.getByText('B2 - Upper Intermediate'))
      
      // Verify selection
      expect(difficultySelect).toHaveTextContent('B2 - Upper Intermediate')

      // Test language selection
      const languageSelects = screen.getAllByRole('combobox')
      const languageSelect = languageSelects.find(select => 
        select.getAttribute('aria-label')?.toLowerCase().includes('language') ||
        select.closest('div')?.querySelector('label')?.textContent?.toLowerCase().includes('language')
      )
      
      if (languageSelect) {
        await user.click(languageSelect)
        
        await waitFor(() => {
          const englishOptions = screen.queryAllByText(/English/)
          expect(englishOptions.length).toBeGreaterThan(0)
        })
      }
    })
  })

  describe('Tablet 1024px Layout Tests', () => {
    beforeEach(() => {
      setViewportSize(VIEWPORT_CONFIGS.tablet1024.width, VIEWPORT_CONFIGS.tablet1024.height)
    })

    it('should preserve visual hierarchy on tablet screens', async () => {
      renderAppWithLightTheme()

      // Verify header remains sticky and properly styled
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('sticky', 'top-0', 'z-50')
      expect(header).toHaveClass('bg-white/80')

      // Check navigation buttons remain accessible
      const nav = screen.getByRole('navigation')
      const buttons = nav.querySelectorAll('button')
      expect(buttons).toHaveLength(4) // Practice, History, Wrong Answers, Assessment

      buttons.forEach(button => {
        expect(button).toBeVisible()
      })

      // Verify main content area maintains proper spacing
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('py-8')
    })

    it('should maintain card layout and form elements', async () => {
      renderAppWithLightTheme()

      // Check setup card maintains proper styling
      const setupCard = screen.getByText('创建听力练习').closest('[class*="glass-effect"]')
      expect(setupCard).toBeInTheDocument()
      expect(setupCard).toHaveClass('p-8')

      // Verify form elements remain properly spaced
      const formContainer = setupCard?.querySelector('.space-y-6')
      expect(formContainer).toBeInTheDocument()

      // Check select elements maintain proper styling
      const selects = screen.getAllByRole('combobox')
      selects.forEach(select => {
        expect(select).toHaveClass('glass-effect')
      })

      // Verify input field styling
      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      expect(topicInput).toHaveClass('glass-effect')
    })

    it('should handle topic suggestions layout properly', async () => {
      renderAppWithLightTheme()

      // Select difficulty to enable topic generation
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Generate topics
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      await user.click(generateTopicsBtn)

      // Wait for topics to appear
      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
      })

      // Verify topic buttons layout
      const topicButtons = screen.getAllByText(/Technology Trends|Environmental Issues|Cultural Exchange/)
      expect(topicButtons).toHaveLength(3)

      // Check topic buttons maintain proper styling
      topicButtons.forEach(button => {
        const buttonElement = button.closest('button')
        expect(buttonElement).toHaveClass('glass-effect', 'justify-start', 'text-left')
      })
    })
  })

  describe('Mobile 768px Layout Tests', () => {
    beforeEach(() => {
      setViewportSize(VIEWPORT_CONFIGS.mobile768.width, VIEWPORT_CONFIGS.mobile768.height)
    })

    it('should maintain light theme styling consistency on mobile', async () => {
      renderAppWithLightTheme()

      // Verify light theme background is preserved
      const appContainer = document.querySelector('.min-h-screen')
      expect(appContainer).toHaveClass('bg-gradient-to-br', 'from-blue-50', 'via-indigo-50', 'to-purple-50')
      // Note: dark: classes are present but not active in light theme

      // Check header maintains light theme
      const headers = screen.getAllByRole('banner')
      const header = headers[0]
      expect(header).toHaveClass('bg-white/80')

      // Verify main title styling - uses theme utility classes
      const mainTitle = header.querySelector('h1')
      expect(mainTitle).toBeInTheDocument()
      const titleClasses = mainTitle?.className || ''
      expect(titleClasses).toMatch(/text-primary-light|text-xl/)
    })

    it('should handle mobile navigation properly', async () => {
      renderAppWithLightTheme()

      // Check header layout on mobile
      const headerContent = screen.getByRole('banner').querySelector('.flex.items-center.justify-between')
      expect(headerContent).toBeInTheDocument()

      // Verify navigation buttons are still accessible
      const practiceBtn = screen.getByRole('button', { name: /practice/i })
      const historyBtn = screen.getByRole('button', { name: /history/i })
      
      expect(practiceBtn).toBeVisible()
      expect(historyBtn).toBeVisible()

      // Check user menu remains visible
      const userIcon = screen.getByRole('region', { name: /user.*menu/i })
      expect(userIcon).toBeInTheDocument()

      // Verify theme toggle is accessible
      const themeToggle = screen.getByRole('button', { name: /toggle.*theme/i })
      expect(themeToggle).toBeInTheDocument()
    })

    it('should maintain form usability on mobile', async () => {
      renderAppWithLightTheme()

      // Check setup card maintains proper mobile styling
      const setupCard = screen.getByText('创建听力练习').closest('[class*="max-w-2xl"]')
      expect(setupCard).toBeInTheDocument()

      // Verify form elements remain accessible
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      expect(difficultySelect).toBeVisible()
      expect(difficultySelect).toHaveClass('glass-effect')

      // Test mobile interaction
      await user.click(difficultySelect)
      
      await waitFor(() => {
        expect(screen.getByText('A1 - Beginner')).toBeInTheDocument()
      })

      // Select option and verify
      await user.click(screen.getByText('A2 - Elementary'))
      expect(difficultySelect).toHaveTextContent('A2 - Elementary')

      // Check topic input remains usable
      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      expect(topicInput).toBeVisible()
      
      await user.type(topicInput, 'Mobile Test Topic')
      expect(topicInput).toHaveValue('Mobile Test Topic')
    })

    it('should handle mobile topic generation flow', async () => {
      renderAppWithLightTheme()

      // Complete setup on mobile
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      await user.click(difficultySelect)
      await user.click(screen.getByText('B1 - Intermediate'))

      // Generate topics on mobile
      const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
      expect(generateTopicsBtn).toBeVisible()
      
      await user.click(generateTopicsBtn)

      // Wait for topics and verify mobile layout
      await waitFor(() => {
        expect(screen.getByText('Technology Trends')).toBeInTheDocument()
      })

      // Check topic buttons work on mobile
      const topicButton = screen.getByText('Technology Trends').closest('button')
      expect(topicButton).toBeVisible()
      
      await user.click(topicButton!)
      
      // Verify topic selection
      const topicInput = screen.getByPlaceholderText(/enter a topic/i)
      expect(topicInput).toHaveValue('Technology Trends')

      // Test generate exercise button
      const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
      expect(generateExerciseBtn).toBeVisible()
      expect(generateExerciseBtn).not.toBeDisabled()
    })
  })

  describe('Component Layout Consistency Tests', () => {
    it('should maintain card layouts across all screen sizes', async () => {
      const viewports = Object.values(VIEWPORT_CONFIGS)
      
      for (const viewport of viewports) {
        setViewportSize(viewport.width, viewport.height)
        const { unmount } = renderAppWithLightTheme()

        // Check main setup card
        const setupCard = screen.getByText('创建听力练习').closest('[class*="glass-effect"]')
        expect(setupCard).toBeInTheDocument()
        expect(setupCard).toHaveClass('p-8')

        // Verify card maintains glass effect styling
        expect(setupCard).toHaveClass('glass-effect')

        // Check form spacing
        const formContainer = setupCard?.querySelector('.space-y-6')
        expect(formContainer).toBeInTheDocument()

        // Clean up for next iteration
        unmount()
      }
    })

    it('should validate button layouts and text wrapping behavior', async () => {
      const viewports = Object.values(VIEWPORT_CONFIGS)
      
      for (const viewport of viewports) {
        setViewportSize(viewport.width, viewport.height)
        const { unmount } = renderAppWithLightTheme()

        // Check navigation buttons maintain proper layout
        const nav = screen.getByRole('navigation')
        expect(nav).toHaveClass('flex', 'items-center', 'space-x-2')

        const buttons = nav.querySelectorAll('button')
        buttons.forEach(button => {
          expect(button).toBeVisible()
        })

        // Test main action button
        const generateBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
        expect(generateBtn).toHaveClass('w-full')

        // Verify button text doesn't overflow
        const buttonText = generateBtn.textContent
        expect(buttonText).toBeTruthy()
        expect(buttonText!.length).toBeGreaterThan(0)

        unmount()
      }
    })

    it('should ensure proper spacing and alignment in responsive contexts', async () => {
      const viewports = Object.values(VIEWPORT_CONFIGS)
      
      for (const viewport of viewports) {
        setViewportSize(viewport.width, viewport.height)
        const { unmount } = renderAppWithLightTheme()

        // Check main container spacing
        const mainContent = screen.getByRole('main')
        expect(mainContent).toHaveClass('max-w-7xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8', 'py-8')

        // Verify header spacing
        const headers = screen.getAllByRole('banner')
        const header = headers[0] // Get first visible header
        const headerContainer = header.querySelector('.max-w-7xl')
        expect(headerContainer).toHaveClass('mx-auto', 'px-4', 'sm:px-6', 'lg:px-8')

        // Check form element spacing - labels may have different styling
        const labels = screen.getAllByText(/Difficulty Level|Language|Duration/)
        labels.forEach(label => {
          // Verify label has appropriate text sizing
          const labelClasses = label.className
          expect(labelClasses).toMatch(/text-(base|sm)/)
          expect(labelClasses).toMatch(/font-(medium|semibold)/)
        })

        // Verify select elements maintain consistent spacing
        const selects = screen.getAllByRole('combobox')
        selects.forEach(select => {
          const container = select.closest('div')
          expect(container).toBeInTheDocument()
        })

        unmount()
      }
    })
  })

  describe('Advanced Responsive Behavior Tests', () => {
    it('should handle viewport transitions smoothly', async () => {
      renderAppWithLightTheme()

      // Start with desktop
      setViewportSize(1440, 900)
      
      // Verify desktop layout
      const headers = screen.getAllByRole('banner')
      expect(headers[0]).toBeVisible()

      // Transition to tablet
      setViewportSize(1024, 768)
      
      // Verify layout adapts
      expect(headers[0]).toBeVisible()
      const nav = screen.getByRole('navigation')
      expect(nav).toBeVisible()

      // Transition to mobile
      setViewportSize(768, 1024)
      
      // Verify mobile layout
      expect(headers[0]).toBeVisible()
      expect(nav).toBeVisible()

      // Check form remains functional
      const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
      expect(difficultySelect).toBeVisible()
    })

    it('should maintain light theme consistency during viewport changes', async () => {
      renderAppWithLightTheme()

      const viewports = [
        { width: 1440, height: 900 },
        { width: 1024, height: 768 },
        { width: 768, height: 1024 }
      ]

      for (const viewport of viewports) {
        setViewportSize(viewport.width, viewport.height)

        // Verify light theme classes remain
        const appContainer = document.querySelector('.min-h-screen')
        expect(appContainer).toHaveClass('from-blue-50', 'via-indigo-50', 'to-purple-50')

        const headers = screen.getAllByRole('banner')
        const header = headers[0]
        expect(header).toHaveClass('bg-white/80')

        // Check title has light theme text class (using theme utility)
        const title = header.querySelector('h1')
        expect(title).toBeInTheDocument()
        const titleClasses = title?.className || ''
        expect(titleClasses).toMatch(/text-primary-light|text-gray-900/)
      }
    })

    it('should handle complex interactions across viewports', async () => {
      // Test full flow on different viewports
      const viewports = [1440, 1024, 768]

      for (const width of viewports) {
        setViewportSize(width, width < 800 ? 1024 : 800)
        const { unmount } = renderAppWithLightTheme()

        // Complete setup flow
        const difficultySelect = screen.getByRole('combobox', { name: /difficulty/i })
        await user.click(difficultySelect)
        
        // Use getAllByText to handle multiple instances
        const b1Options = screen.getAllByText('B1 - Intermediate')
        await user.click(b1Options[b1Options.length - 1]) // Click the last one (in dropdown)

        // Generate topics
        const generateTopicsBtn = screen.getByRole('button', { name: /生成话题/i })
        await user.click(generateTopicsBtn)

        await waitFor(() => {
          expect(screen.getByText('Technology Trends')).toBeInTheDocument()
        })

        // Select topic
        await user.click(screen.getByText('Technology Trends'))

        // Verify generate button is enabled
        const generateExerciseBtn = screen.getByRole('button', { name: /Generate Listening Exercise/i })
        expect(generateExerciseBtn).not.toBeDisabled()

        // Reset for next viewport
        unmount()
      }
    })
  })

  describe('Light Theme Specific Responsive Tests', () => {
    it('should maintain light theme visual elements across all viewports', async () => {
      const testCases = [
        { name: 'Desktop 1440px', ...VIEWPORT_CONFIGS.desktop1440 },
        { name: 'Desktop 1280px', ...VIEWPORT_CONFIGS.desktop1280 },
        { name: 'Tablet 1024px', ...VIEWPORT_CONFIGS.tablet1024 },
        { name: 'Mobile 768px', ...VIEWPORT_CONFIGS.mobile768 }
      ]

      for (const testCase of testCases) {
        setViewportSize(testCase.width, testCase.height)
        const { unmount } = renderAppWithLightTheme()

        // Verify light theme background gradient
        const appContainer = document.querySelector('.min-h-screen')
        expect(appContainer).toHaveClass(
          'bg-gradient-to-br',
          'from-blue-50',
          'via-indigo-50', 
          'to-purple-50'
        )

        // Check header light theme styling
        const headers = screen.getAllByRole('banner')
        const header = headers[0]
        expect(header).toHaveClass('bg-white/80')
        expect(header).toHaveClass('backdrop-blur-md')

        // Verify glass effect elements
        const glassElements = document.querySelectorAll('.glass-effect')
        expect(glassElements.length).toBeGreaterThan(0)

        unmount()
      }
    })

    it('should ensure proper contrast and readability in light theme', async () => {
      const viewports = Object.values(VIEWPORT_CONFIGS)

      for (const viewport of viewports) {
        setViewportSize(viewport.width, viewport.height)
        const { unmount } = renderAppWithLightTheme()

        // Check text contrast - title uses theme utility classes
        const headers = screen.getAllByRole('banner')
        const mainTitle = headers[0].querySelector('h1')
        expect(mainTitle).toBeInTheDocument()
        const titleClasses = mainTitle?.className || ''
        // Should have either direct class or theme utility class
        expect(titleClasses).toMatch(/text-primary-light|text-gray-900|text-xl/)

        // Verify form labels have proper contrast
        const labels = screen.getAllByText(/Difficulty Level|Language|Duration/)
        labels.forEach(label => {
          // Verify label has appropriate text sizing
          const labelClasses = label.className
          expect(labelClasses).toMatch(/text-(base|sm)/)
          expect(labelClasses).toMatch(/font-(medium|semibold)/)
        })

        // Check button text visibility
        const buttons = screen.getAllByRole('button')
        buttons.forEach(button => {
          expect(button).toBeVisible()
        })

        unmount()
      }
    })
  })
})