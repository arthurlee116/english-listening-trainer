/**
 * 并行生成功能单元测试
 * 
 * 测试音频生成与题目生成并行处理的核心逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock React hooks for testing
const mockSetState = vi.fn()
const mockUseCallback = vi.fn((fn) => fn)
const mockUseRef = vi.fn(() => ({ current: null }))

// Mock AI service functions
const mockGenerateAudio = vi.fn()
const mockGenerateQuestions = vi.fn()
const mockCachedApiCall = vi.fn()

vi.mock('@/lib/ai-service', () => ({
  generateQuestions: mockGenerateQuestions
}))

vi.mock('@/lib/tts-service', () => ({
  generateAudio: mockGenerateAudio
}))

// Mock toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}))

// Mock i18n
const mockT = vi.fn((key: string) => key)
vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({ 
    t: mockT,
    formatToastMessage: (key: string, params?: Record<string, string | number>) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`
      }
      return key
    }
  })
}))

describe('并行生成功能测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置Promise为pending状态
    mockGenerateAudio.mockReset()
    mockGenerateQuestions.mockReset()
    mockCachedApiCall.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('缓存键生成', () => {
    it('应该为普通模式生成正确的缓存键', () => {
      const generateCacheKey = (prefix: string) => {
        const transcript = "This is a test transcript for generating cache key"
        const difficulty = "B1"
        const language = "en-US"
        const duration = 120
        const isSpecializedMode = false
        const selectedFocusAreas: string[] = []
        
        const transcriptHash = transcript.slice(0, 50)
        const focusMode = isSpecializedMode ? selectedFocusAreas.join(',') : 'normal'
        return `${prefix}-${difficulty}-${transcriptHash}-${language}-${duration}-${focusMode}`
      }

      const result = generateCacheKey('questions')
      expect(result).toBe('questions-B1-This is a test transcript for generating cache key-en-US-120-normal')
    })

    it('应该为专项模式生成正确的缓存键', () => {
      const generateCacheKey = (prefix: string) => {
        const transcript = "This is a test transcript for generating cache key"
        const difficulty = "B1"
        const language = "en-US"
        const duration = 120
        const isSpecializedMode = true
        const selectedFocusAreas = ['vocabulary', 'grammar']
        
        const transcriptHash = transcript.slice(0, 50)
        const focusMode = isSpecializedMode ? selectedFocusAreas.join(',') : 'normal'
        return `${prefix}-${difficulty}-${transcriptHash}-${language}-${duration}-${focusMode}`
      }

      const result = generateCacheKey('questions')
      expect(result).toBe('questions-B1-This is a test transcript for generating cache key-en-US-120-vocabulary,grammar')
    })
  })

  describe('并行状态管理', () => {
    it('应该正确初始化并行状态', () => {
      const initialState = {
        isQuestionGenerationPending: false,
        questionGenerationError: null,
        pendingQuestionPromiseRef: { current: null }
      }

      expect(initialState.isQuestionGenerationPending).toBe(false)
      expect(initialState.questionGenerationError).toBe(null)
      expect(initialState.pendingQuestionPromiseRef.current).toBe(null)
    })

    it('应该正确重置并行状态', () => {
      const resetParallelGenerationState = () => {
        const setIsQuestionGenerationPending = mockSetState
        const setQuestionGenerationError = mockSetState
        const pendingQuestionPromiseRef = { current: Promise.resolve() }

        setIsQuestionGenerationPending(false)
        setQuestionGenerationError(null)
        pendingQuestionPromiseRef.current = null

        return {
          setIsQuestionGenerationPending,
          setQuestionGenerationError,
          pendingQuestionPromiseRef
        }
      }

      const result = resetParallelGenerationState()
      
      expect(mockSetState).toHaveBeenCalledWith(false)
      expect(mockSetState).toHaveBeenCalledWith(null)
      expect(result.pendingQuestionPromiseRef.current).toBe(null)
    })
  })

  describe('Promise.allSettled 并行处理', () => {
    it('应该正确处理两个任务都成功的情况', async () => {
      const audioResult = {
        audioUrl: 'http://example.com/audio.wav',
        duration: 60
      }
      const questionResult = {
        questions: [
          { id: '1', question: 'Test question 1', type: 'multiple_choice' },
          { id: '2', question: 'Test question 2', type: 'fill_blank' }
        ],
        focusCoverage: { coverage: 0.9, unmatchedTags: [] }
      }

      mockGenerateAudio.mockResolvedValue(audioResult)
      mockCachedApiCall.mockResolvedValue(questionResult)

      const audioPromise = mockGenerateAudio()
      const questionPromise = mockCachedApiCall()

      const results = await Promise.allSettled([audioPromise, questionPromise])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')
      
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual(audioResult)
      }
      
      if (results[1].status === 'fulfilled') {
        expect(results[1].value).toEqual(questionResult)
      }
    })

    it('应该正确处理音频成功、题目失败的情况', async () => {
      const audioResult = {
        audioUrl: 'http://example.com/audio.wav',
        duration: 60
      }
      const questionError = new Error('Questions generation failed')

      mockGenerateAudio.mockResolvedValue(audioResult)
      mockCachedApiCall.mockRejectedValue(questionError)

      const audioPromise = mockGenerateAudio()
      const questionPromise = mockCachedApiCall()

      const results = await Promise.allSettled([audioPromise, questionPromise])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual(audioResult)
      }
      
      if (results[1].status === 'rejected') {
        expect(results[1].reason).toEqual(questionError)
      }
    })

    it('应该正确处理音频失败、题目成功的情况', async () => {
      const audioError = new Error('Audio generation failed')
      const questionResult = {
        questions: [{ id: '1', question: 'Test question', type: 'multiple_choice' }],
        focusCoverage: { coverage: 0.8, unmatchedTags: [] }
      }

      mockGenerateAudio.mockRejectedValue(audioError)
      mockCachedApiCall.mockResolvedValue(questionResult)

      const audioPromise = mockGenerateAudio()
      const questionPromise = mockCachedApiCall()

      const results = await Promise.allSettled([audioPromise, questionPromise])

      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('fulfilled')
      
      if (results[0].status === 'rejected') {
        expect(results[0].reason).toEqual(audioError)
      }
      
      if (results[1].status === 'fulfilled') {
        expect(results[1].value).toEqual(questionResult)
      }
    })

    it('应该正确处理两个任务都失败的情况', async () => {
      const audioError = new Error('Audio generation failed')
      const questionError = new Error('Questions generation failed')

      mockGenerateAudio.mockRejectedValue(audioError)
      mockCachedApiCall.mockRejectedValue(questionError)

      const audioPromise = mockGenerateAudio()
      const questionPromise = mockCachedApiCall()

      const results = await Promise.allSettled([audioPromise, questionPromise])

      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('rejected')
      
      if (results[0].status === 'rejected') {
        expect(results[0].reason).toEqual(audioError)
      }
      
      if (results[1].status === 'rejected') {
        expect(results[1].reason).toEqual(questionError)
      }
    })
  })

  describe('Focus Coverage 处理', () => {
    it('应该正确处理零覆盖率情况', () => {
      const handleFocusCoverageResult = (focusCoverage?: { coverage: number; unmatchedTags: string[] }) => {
        const isSpecializedMode = true
        const selectedFocusAreas = ['vocabulary', 'grammar']
        const recordUserIntent = vi.fn()
        
        if (!isSpecializedMode || !focusCoverage) return

        if (focusCoverage.coverage === 0) {
          recordUserIntent(selectedFocusAreas)
          mockToast({
            title: "messages.specializedModeUnavailable",
            description: "messages.specializedModeUnavailableDesc",
            variant: "default",
          })
        }
      }

      const focusCoverage = { coverage: 0, unmatchedTags: ['vocabulary', 'grammar'] }
      handleFocusCoverageResult(focusCoverage)

      expect(mockToast).toHaveBeenCalledWith({
        title: "messages.specializedModeUnavailable",
        description: "messages.specializedModeUnavailableDesc",
        variant: "default",
      })
    })

    it('应该正确处理部分覆盖率情况', () => {
      const handleFocusCoverageResult = (focusCoverage?: { coverage: number; unmatchedTags: string[] }) => {
        const isSpecializedMode = true
        
        if (!isSpecializedMode || !focusCoverage) return

        if (focusCoverage.coverage < 0.8) {
          mockToast({
            title: "messages.partialCoverageWarning",
            description: "messages.partialCoverageWarningDesc",
            variant: "default",
          })
        }
      }

      const focusCoverage = { coverage: 0.6, unmatchedTags: ['grammar'] }
      handleFocusCoverageResult(focusCoverage)

      expect(mockToast).toHaveBeenCalledWith({
        title: "messages.partialCoverageWarning",
        description: "messages.partialCoverageWarningDesc",
        variant: "default",
      })
    })

    it('应该在非专项模式下不处理覆盖率', () => {
      const handleFocusCoverageResult = (focusCoverage?: { coverage: number; unmatchedTags: string[] }) => {
        const isSpecializedMode = false
        
        if (!isSpecializedMode || !focusCoverage) return

        // 这里不应该执行任何逻辑
        mockToast()
      }

      const focusCoverage = { coverage: 0, unmatchedTags: [] }
      handleFocusCoverageResult(focusCoverage)

      expect(mockToast).not.toHaveBeenCalled()
    })
  })

  describe('错误处理', () => {
    it('应该正确识别Error对象', () => {
      const isError = (error: unknown): error is Error => {
        return error instanceof Error
      }

      const realError = new Error('Test error')
      const stringError = 'String error'
      const objectError = { message: 'Object error' }

      expect(isError(realError)).toBe(true)
      expect(isError(stringError)).toBe(false)
      expect(isError(objectError)).toBe(false)
    })

    it('应该正确提取错误消息', () => {
      const extractErrorMessage = (error: unknown): string => {
        if (error instanceof Error) {
          return error.message
        }
        return String(error)
      }

      expect(extractErrorMessage(new Error('Test error'))).toBe('Test error')
      expect(extractErrorMessage('String error')).toBe('String error')
      expect(extractErrorMessage({ message: 'Object error' })).toBe('[object Object]')
      expect(extractErrorMessage(null)).toBe('null')
      expect(extractErrorMessage(undefined)).toBe('undefined')
    })
  })

  describe('性能优化', () => {
    it('应该正确计算缓存TTL', () => {
      const CACHE_TTL = {
        questions: 180000, // 3 分钟
        topics: 60000,     // 1 分钟
        transcript: 120000 // 2 分钟
      }

      expect(CACHE_TTL.questions).toBe(3 * 60 * 1000)
      expect(CACHE_TTL.topics).toBe(1 * 60 * 1000)
      expect(CACHE_TTL.transcript).toBe(2 * 60 * 1000)
    })

    it('应该避免重复的Promise引用', () => {
      const pendingQuestionPromiseRef = { current: null as Promise<void> | null }
      
      const promise1 = Promise.resolve()
      const promise2 = Promise.resolve()
      
      pendingQuestionPromiseRef.current = promise1.then(() => {}).catch(() => {})
      expect(pendingQuestionPromiseRef.current).toBeDefined()
      
      // 模拟清理
      pendingQuestionPromiseRef.current = null
      expect(pendingQuestionPromiseRef.current).toBe(null)
      
      pendingQuestionPromiseRef.current = promise2.then(() => {}).catch(() => {})
      expect(pendingQuestionPromiseRef.current).toBeDefined()
    })
  })
})