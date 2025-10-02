/**
 * Integration Test Utilities
 * 
 * Provides enhanced utilities for integration testing with proper mocking
 * and component setup to resolve rendering issues.
 */

import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

// Enhanced mock implementations for better test isolation
export const createEnhancedMocks = () => {
  // Mock i18n with immediate resolution
  const mockT = vi.fn((key: string, options?: any) => {
    // Return simplified translations for testing
    const translations: Record<string, string> = {
      'components.audioPlayer.play': 'Play',
      'components.audioPlayer.pause': 'Pause',
      'components.audioPlayer.skipBackward': 'Skip Backward',
      'components.audioPlayer.skipForward': 'Skip Forward',
      'components.audioPlayer.playbackRateLabel': 'Playback Speed',
      'components.audioPlayer.playbackRateAriaLabel': 'Playback speed',
      'components.resultsDisplay.saveNotes': 'Save',
      'components.questionInterface.submitAnswers': 'Submit Answers',
      'components.questionInterface.focusAreas': 'Focus Areas',
      'components.questionInterface.audioPlayer': 'Audio Player',
      'components.questionInterface.questions': 'Questions',
      'components.questionInterface.emergencyTranscript': 'Emergency Transcript',
      'components.questionInterface.writeAnswer': 'Write your answer here...',
      'components.questionInterface.processingAnswers': 'Processing answers...',
      'common.loading': 'Loading...'
    }
    
    return translations[key] || key
  })

  // Mock bilingual text component
  const MockBilingualText = ({ translationKey, children }: any) => {
    const text = mockT(translationKey)
    return <span>{text || children}</span>
  }

  // Mock audio element with proper event handling
  const createMockAudio = () => {
    const audio = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      currentTime: 0,
      duration: 100,
      paused: true,
      volume: 1,
      playbackRate: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      src: '',
      preload: 'metadata'
    }
    
    // Mock HTMLAudioElement constructor
    global.HTMLAudioElement = vi.fn(() => audio) as any
    global.Audio = vi.fn(() => audio) as any
    
    return audio
  }

  // Mock localStorage with proper implementation
  const createMockStorage = () => {
    const storage = new Map<string, string>()
    
    return {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      length: 0,
      key: vi.fn()
    }
  }

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url')
  global.URL.revokeObjectURL = vi.fn()

  return {
    mockT,
    MockBilingualText,
    createMockAudio,
    createMockStorage
  }
}

// Enhanced render function with proper providers and mocks
export const renderWithEnhancedProviders = (
  ui: React.ReactElement,
  options: RenderOptions & {
    skipI18nInit?: boolean
    mockStorage?: boolean
    mockAudio?: boolean
  } = {}
) => {
  const { mockT, MockBilingualText, createMockAudio, createMockStorage } = createEnhancedMocks()

  // Set up mocks
  if (options.mockAudio !== false) {
    createMockAudio()
  }
  
  if (options.mockStorage !== false) {
    const mockStorage = createMockStorage()
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true
    })
  }

  // Mock the bilingual text component globally
  vi.doMock('@/components/ui/bilingual-text', () => ({
    BilingualText: MockBilingualText,
    default: MockBilingualText
  }))

  // Mock the i18n hook
  vi.doMock('@/lib/i18n', () => ({
    useTranslation: () => ({ t: mockT }),
    t: mockT
  }))

  // Create wrapper with minimal providers
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <div data-testid="test-wrapper">
        {children}
      </div>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    mockT,
    MockBilingualText
  }
}

// Utility to wait for component to finish loading
export const waitForComponentToLoad = async (getByTestId: any, timeout = 5000) => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    try {
      const wrapper = getByTestId('test-wrapper')
      const loadingText = wrapper.textContent
      
      if (!loadingText?.includes('Loading') && !loadingText?.includes('加载中')) {
        return true
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch {
      // Continue waiting
    }
  }
  
  throw new Error('Component did not finish loading within timeout')
}

// Enhanced mock exercise data with all required fields
export const createEnhancedMockExercise = (overrides = {}) => ({
  id: 'test-exercise-1',
  difficulty: 'B1' as const,
  language: 'en-US' as const,
  topic: 'Technology and Innovation',
  transcript: 'This is a sample transcript for testing purposes.',
  questions: [
    {
      id: 'q1',
      type: 'single-choice' as const,
      question: 'What is the main topic discussed in the audio?',
      options: ['Technology', 'Science', 'History', 'Art'],
      correctAnswer: 'Technology',
      focusAreas: ['main-idea']
    },
    {
      id: 'q2', 
      type: 'short-answer' as const,
      question: 'Summarize the key points mentioned.',
      correctAnswer: 'Key points about technology innovation',
      focusAreas: ['detail-comprehension']
    }
  ],
  answers: {},
  results: [],
  createdAt: new Date().toISOString(),
  audioUrl: 'blob:mock-audio-url',
  focusAreas: ['main-idea', 'detail-comprehension'],
  totalDurationSec: 180,
  ...overrides
})

// Mock props generators for common components
export const createMockQuestionInterfaceProps = (overrides = {}) => ({
  questions: createEnhancedMockExercise().questions,
  answers: {},
  onAnswer: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitting: false,
  audioUrl: 'blob:mock-audio-url',
  transcript: 'Sample transcript',
  focusAreas: ['main-idea', 'detail-comprehension'],
  ...overrides
})

export const createMockResultsDisplayProps = (overrides = {}) => ({
  exercise: createEnhancedMockExercise(),
  onRestart: vi.fn(),
  onExport: vi.fn(),
  ...overrides
})

// Accessibility test helpers
export const findButtonByTitle = (container: HTMLElement, titlePattern: RegExp) => {
  const buttons = container.querySelectorAll('button')
  return Array.from(buttons).find(button => 
    button.title && titlePattern.test(button.title)
  )
}

export const findElementByAriaLabel = (container: HTMLElement, labelPattern: RegExp) => {
  const elements = container.querySelectorAll('[aria-label]')
  return Array.from(elements).find(element => 
    element.getAttribute('aria-label') && 
    labelPattern.test(element.getAttribute('aria-label')!)
  )
}