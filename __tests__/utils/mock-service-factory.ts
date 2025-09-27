/**
 * Mock服务工厂 - 统一管理所有测试Mock配置
 * 
 * 基于设计文档的MockServiceFactory实现，提供标准化的Mock配置管理
 */

import { vi, type MockedFunction } from 'vitest'
import type { WrongAnswerItem, AIAnalysisResponse } from '@/lib/types'

/**
 * Mock服务接口定义
 */
export interface MockConfig {
  /** 是否自动重置所有Mock */
  autoReset?: boolean
  /** 全局超时配置 */
  timeout?: number
  /** 并发限制 */
  concurrencyLimit?: number
}

/**
 * API Mock提供者
 */
export class ApiMockProvider {
  private static instance: ApiMockProvider
  private mockFetch: MockedFunction<typeof fetch>

  private constructor() {
    this.mockFetch = vi.fn()
    global.fetch = this.mockFetch
  }

  static getInstance(): ApiMockProvider {
    if (!this.instance) {
      this.instance = new ApiMockProvider()
    }
    return this.instance
  }

  /**
   * 配置错题API Mock响应
   */
  configureWrongAnswersApi(data: {
    wrongAnswers?: WrongAnswerItem[]
    error?: string
    delay?: number
  }) {
    const { wrongAnswers = [], error, delay = 0 } = data

    this.mockFetch.mockImplementation((url) => {
      const urlStr = url?.toString() || ''
      
      if (urlStr.includes('/api/wrong-answers/list')) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (error) {
              reject(new Error(error))
            } else {
              resolve({
                ok: true,
                json: () => Promise.resolve({ wrongAnswers })
              } as Response)
            }
          }, delay)
        })
      }
      
      // 默认返回
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)
    })

    return this
  }

  /**
   * 配置AI分析API Mock响应
   */
  configureAiAnalysisApi(data: {
    analysis?: AIAnalysisResponse
    error?: string
    delay?: number
  }) {
    const { analysis, error, delay = 0 } = data

    this.mockFetch.mockImplementation((url, options) => {
      const urlStr = url?.toString() || ''
      
      if (urlStr.includes('/api/ai/analyze')) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (error) {
              reject(new Error(error))
            } else {
              resolve({
                ok: true,
                json: () => Promise.resolve(analysis || {
                  analysis: 'Mock analysis',
                  key_reason: 'Mock reason',
                  ability_tags: ['mock_tag'],
                  signal_words: ['mock'],
                  strategy: 'Mock strategy',
                  related_sentences: [],
                  confidence: 'high' as const
                })
              } as Response)
            }
          }, delay)
        })
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)
    })

    return this
  }

  /**
   * 重置所有API Mock
   */
  reset() {
    this.mockFetch.mockClear()
    return this
  }
}

/**
 * Hook Mock提供者
 */
export class HookMockProvider {
  private static instance: HookMockProvider
  private mockModules: Map<string, any> = new Map()

  private constructor() {}

  static getInstance(): HookMockProvider {
    if (!this.instance) {
      this.instance = new HookMockProvider()
    }
    return this.instance
  }

  /**
   * 配置双语文本Hook Mock
   */
  configureBilingualText(translations: Record<string, string> = {}) {
    const defaultTranslations = {
      'components.wrongAnswersBook.title': 'Wrong Answers Book 错题本',
      'components.wrongAnswersBook.wrongAnswersCount': '{count} wrong answers',
      'components.wrongAnswersBook.reviewTip': 'Review your mistakes to improve',
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.retry': 'Retry',
      'components.wrongAnswersBook.noWrongAnswersTitle': 'No Wrong Answers',
      'components.wrongAnswersBook.noWrongAnswersDescription': 'Great job! No wrong answers found.',
      'components.wrongAnswersBook.searchPlaceholder': 'Search questions...',
      'components.wrongAnswersBook.export.exportAsTxt': 'Export as TXT',
      'components.wrongAnswersBook.export.exporting': 'Exporting...',
      'components.wrongAnswersBook.batchAnalysis.generateAll': 'Generate All Analysis'
    }

    const allTranslations = { ...defaultTranslations, ...translations }

    vi.mock('@/hooks/use-bilingual-text', () => ({
      useBilingualText: () => ({
        t: vi.fn((key: string, options?: any) => {
          let text = allTranslations[key] || key
          if (options && typeof options === 'object') {
            Object.keys(options).forEach(optKey => {
              text = text.replace(`{${optKey}}`, options[optKey])
            })
          }
          return text
        })
      })
    }))

    return this
  }

  /**
   * 配置批量处理Hook Mock
   */
  configureBatchProcessing(state: {
    isProcessing?: boolean
    progress?: number
    status?: {
      pending: number
      active: number
      completed: number
      failed: number
      total: number
    }
    results?: any
    error?: string | null
  } = {}) {
    const defaultState = {
      isProcessing: false,
      progress: 0,
      status: { pending: 0, active: 0, completed: 0, failed: 0, total: 0 },
      results: null,
      error: null
    }

    const mockState = { ...defaultState, ...state }

    vi.mock('@/hooks/use-batch-processing', () => ({
      useBatchProcessing: () => ({
        state: mockState,
        processBatch: vi.fn(),
        cancelProcessing: vi.fn(),
        resetState: vi.fn(),
        ...mockState
      })
    }))

    return this
  }

  /**
   * 配置认证状态Hook Mock
   */
  configureAuthState(authData: {
    isAuthenticated?: boolean
    user?: any
    isLoading?: boolean
    error?: string | null
  } = {}) {
    const defaultAuthState = {
      isAuthenticated: true,
      user: { id: 'test-user', email: 'test@example.com' },
      isLoading: false,
      error: null
    }

    const mockAuthState = { ...defaultAuthState, ...authData }

    vi.mock('@/hooks/use-auth-state', () => ({
      useAuthState: () => mockAuthState
    }))

    return this
  }

  /**
   * 重置所有Hook Mock
   */
  reset() {
    this.mockModules.clear()
    return this
  }
}

/**
 * 服务Mock提供者
 */
export class ServiceMockProvider {
  private static instance: ServiceMockProvider

  private constructor() {}

  static getInstance(): ServiceMockProvider {
    if (!this.instance) {
      this.instance = new ServiceMockProvider()
    }
    return this.instance
  }

  /**
   * 配置导出服务Mock
   */
  configureExportService(config: {
    exportContent?: string
    shouldFail?: boolean
    delay?: number
    filename?: string
  } = {}) {
    const { 
      exportContent = 'Mock export content',
      shouldFail = false,
      delay = 0,
      filename = 'wrong-answers-export.txt'
    } = config

    vi.mock('@/lib/export-service', () => ({
      ExportService: {
        exportToTXT: vi.fn().mockImplementation(() => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              if (shouldFail) {
                reject(new Error('Export failed'))
              } else {
                resolve(exportContent)
              }
            }, delay)
          })
        }),
        downloadFile: vi.fn(),
        generateFilename: vi.fn().mockReturnValue(filename),
        getExportStatistics: vi.fn().mockReturnValue({
          totalItems: 10,
          withAnalysis: 5,
          withoutAnalysis: 5
        })
      }
    }))

    return this
  }

  /**
   * 配置并发服务Mock
   */
  configureConcurrencyService(config: {
    totalSlots?: number
    activeSlots?: number
    pendingCount?: number
    completedCount?: number
    failedCount?: number
  } = {}) {
    const defaultStatus = {
      total: 5,
      active: 0,
      pending: 0,
      completed: 0,
      failed: 0
    }

    const mockStatus = { ...defaultStatus, ...config }

    vi.mock('@/lib/concurrency-service', () => ({
      aiAnalysisConcurrency: {
        getStatus: vi.fn().mockReturnValue(mockStatus),
        addTask: vi.fn(),
        removeTask: vi.fn(),
        clearCompleted: vi.fn()
      }
    }))

    return this
  }

  /**
   * 重置所有服务Mock
   */
  reset() {
    vi.restoreAllMocks()
    return this
  }
}

/**
 * Mock服务工厂主类
 */
export class MockServiceFactory {
  private static instance: MockServiceFactory
  private apiProvider: ApiMockProvider
  private hookProvider: HookMockProvider
  private serviceProvider: ServiceMockProvider
  private config: MockConfig

  private constructor(config: MockConfig = {}) {
    this.config = {
      autoReset: true,
      timeout: 5000,
      concurrencyLimit: 5,
      ...config
    }
    
    this.apiProvider = ApiMockProvider.getInstance()
    this.hookProvider = HookMockProvider.getInstance()
    this.serviceProvider = ServiceMockProvider.getInstance()
  }

  static getInstance(config?: MockConfig): MockServiceFactory {
    if (!this.instance) {
      this.instance = new MockServiceFactory(config)
    }
    return this.instance
  }

  /**
   * 获取API Mock提供者
   */
  getApiMockProvider(): ApiMockProvider {
    return this.apiProvider
  }

  /**
   * 获取Hook Mock提供者
   */
  getHookMockProvider(): HookMockProvider {
    return this.hookProvider
  }

  /**
   * 获取服务Mock提供者
   */
  getServiceMockProvider(): ServiceMockProvider {
    return this.serviceProvider
  }

  /**
   * 创建标准错题本组件测试环境
   */
  createWrongAnswersBookTestEnv(customConfig: {
    wrongAnswers?: WrongAnswerItem[]
    authState?: any
    batchProcessingState?: any
    exportConfig?: any
    concurrencyConfig?: any
  } = {}) {
    // 配置Hook Mocks
    this.hookProvider
      .configureBilingualText()
      .configureBatchProcessing(customConfig.batchProcessingState)
      .configureAuthState(customConfig.authState)

    // 配置Service Mocks
    this.serviceProvider
      .configureExportService(customConfig.exportConfig)
      .configureConcurrencyService(customConfig.concurrencyConfig)

    // 配置API Mocks
    this.apiProvider
      .configureWrongAnswersApi({ wrongAnswers: customConfig.wrongAnswers })

    return this
  }

  /**
   * 重置所有Mock配置
   */
  resetAllMocks() {
    this.apiProvider.reset()
    this.hookProvider.reset()
    this.serviceProvider.reset()
    vi.clearAllMocks()
    return this
  }

  /**
   * 获取配置信息
   */
  getConfig(): MockConfig {
    return { ...this.config }
  }
}

// 导出单例实例
export const mockServiceFactory = MockServiceFactory.getInstance()
export const apiMockProvider = mockServiceFactory.getApiMockProvider()
export const hookMockProvider = mockServiceFactory.getHookMockProvider()
export const serviceMockProvider = mockServiceFactory.getServiceMockProvider()