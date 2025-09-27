/**
 * 测试场景模板库 - 基于设计文档的测试场景管理
 * 
 * 提供标准化的测试场景模板，包括基础场景、交互场景、错误处理场景
 */

import type { MockedFunction } from 'vitest'
import { MockServiceFactory } from './mock-service-factory'
import { WrongAnswerItemFactory, createTestScenario } from './test-data-factory'
import type { WrongAnswerItem } from '@/lib/types'

/**
 * 场景配置接口
 */
export interface ScenarioConfig {
  /** 场景名称 */
  name: string
  /** 场景描述 */
  description: string
  /** 数据配置 */
  data?: WrongAnswerItem[]
  /** Mock配置 */
  mockConfig?: {
    apiDelay?: number
    apiError?: string
    exportConfig?: any
    batchProcessingConfig?: any
  }
  /** 预期结果 */
  expectedResults?: {
    elementsVisible?: string[]
    elementsHidden?: string[]
    buttonStates?: Record<string, 'enabled' | 'disabled'>
  }
}

/**
 * 基础场景模板类
 */
export class BaseScenarioTemplate {
  protected mockServiceFactory: MockServiceFactory
  
  constructor() {
    this.mockServiceFactory = MockServiceFactory.getInstance()
  }

  /**
   * 设置场景环境
   */
  protected setupEnvironment(config: ScenarioConfig) {
    this.mockServiceFactory.resetAllMocks()
    
    if (config.mockConfig) {
      const { apiDelay, apiError, exportConfig, batchProcessingConfig } = config.mockConfig
      
      // 配置API Mock
      const apiProvider = this.mockServiceFactory.getApiMockProvider()
      if (apiError) {
        apiProvider.configureWrongAnswersApi({ error: apiError })
      } else {
        apiProvider.configureWrongAnswersApi({ 
          wrongAnswers: config.data || [],
          delay: apiDelay || 0
        })
      }
      
      // 配置服务Mock
      if (exportConfig) {
        const serviceProvider = this.mockServiceFactory.getServiceMockProvider()
        serviceProvider.configureExportService(exportConfig)
      }
      
      // 配置Hook Mock
      if (batchProcessingConfig) {
        const hookProvider = this.mockServiceFactory.getHookMockProvider()
        hookProvider.configureBatchProcessing(batchProcessingConfig)
      }
    }
  }

  /**
   * 创建场景
   */
  create(config: ScenarioConfig): ScenarioInstance {
    this.setupEnvironment(config)
    return new ScenarioInstance(config, this.mockServiceFactory)
  }
}

/**
 * 场景实例类
 */
export class ScenarioInstance {
  constructor(
    public config: ScenarioConfig,
    public mockServiceFactory: MockServiceFactory
  ) {}

  /**
   * 获取场景数据
   */
  getData(): WrongAnswerItem[] {
    return this.config.data || []
  }

  /**
   * 获取预期结果
   */
  getExpectedResults() {
    return this.config.expectedResults || {}
  }

  /**
   * 验证场景结果
   */
  validate(actualResults: any): boolean {
    // 这里可以添加自动验证逻辑
    return true
  }
}

/**
 * 加载状态场景模板
 */
export class LoadingScenarioTemplate extends BaseScenarioTemplate {
  /**
   * 创建初始加载场景
   */
  createInitialLoading(): ScenarioInstance {
    return this.create({
      name: 'initial-loading',
      description: '初始加载状态场景',
      data: [],
      mockConfig: {
        apiDelay: 999999 // 永不完成的加载
      },
      expectedResults: {
        elementsVisible: ['Loading...', 'Loading wrong answers...'],
        elementsHidden: ['Export as TXT']
      }
    })
  }

  /**
   * 创建快速加载场景
   */
  createQuickLoading(): ScenarioInstance {
    const testData = createTestScenario.createStandardDisplayScenario()
    return this.create({
      name: 'quick-loading',
      description: '快速加载完成场景',
      data: testData,
      mockConfig: {
        apiDelay: 100
      },
      expectedResults: {
        elementsVisible: ['3 wrong answers', 'Export as TXT']
      }
    })
  }

  /**
   * 创建慢速加载场景
   */
  createSlowLoading(): ScenarioInstance {
    const testData = createTestScenario.createStandardDisplayScenario()
    return this.create({
      name: 'slow-loading',
      description: '慢速加载场景',
      data: testData,
      mockConfig: {
        apiDelay: 2000
      }
    })
  }
}

/**
 * 错误处理场景模板
 */
export class ErrorScenarioTemplate extends BaseScenarioTemplate {
  /**
   * 创建网络错误场景
   */
  createNetworkError(): ScenarioInstance {
    return this.create({
      name: 'network-error',
      description: '网络连接错误场景',
      mockConfig: {
        apiError: 'Network connection failed'
      },
      expectedResults: {
        elementsVisible: ['Error', 'Network connection failed', 'Retry'],
        elementsHidden: ['Export as TXT']
      }
    })
  }

  /**
   * 创建服务器错误场景
   */
  createServerError(): ScenarioInstance {
    return this.create({
      name: 'server-error',
      description: '服务器错误场景',
      mockConfig: {
        apiError: 'Internal server error'
      },
      expectedResults: {
        elementsVisible: ['Error', 'Internal server error', 'Retry']
      }
    })
  }

  /**
   * 创建权限错误场景
   */
  createAuthError(): ScenarioInstance {
    return this.create({
      name: 'auth-error',
      description: '认证权限错误场景',
      mockConfig: {
        apiError: 'Authentication required'
      },
      expectedResults: {
        elementsVisible: ['Error', 'Authentication required']
      }
    })
  }

  /**
   * 创建导出失败场景
   */
  createExportError(): ScenarioInstance {
    const testData = createTestScenario.createExportScenario()
    return this.create({
      name: 'export-error',
      description: '导出功能失败场景',
      data: testData,
      mockConfig: {
        exportConfig: {
          shouldFail: true,
          delay: 100
        }
      }
    })
  }
}

/**
 * 数据展示场景模板
 */
export class DataDisplayScenarioTemplate extends BaseScenarioTemplate {
  /**
   * 创建空数据场景
   */
  createEmptyData(): ScenarioInstance {
    return this.create({
      name: 'empty-data',
      description: '空数据状态场景',
      data: [],
      expectedResults: {
        elementsVisible: ['No Wrong Answers', 'Great job! No wrong answers found.'],
        elementsHidden: ['Export as TXT', 'Generate All Analysis']
      }
    })
  }

  /**
   * 创建单条数据场景
   */
  createSingleItem(): ScenarioInstance {
    const testData = [WrongAnswerItemFactory.createWithAnalysis()]
    return this.create({
      name: 'single-item',
      description: '单条错题数据场景',
      data: testData,
      expectedResults: {
        elementsVisible: ['1 wrong answers', 'AI Analysis', 'Export as TXT']
      }
    })
  }

  /**
   * 创建多条数据场景
   */
  createMultipleItems(): ScenarioInstance {
    const testData = createTestScenario.createStandardDisplayScenario()
    return this.create({
      name: 'multiple-items',
      description: '多条错题数据场景',
      data: testData,
      expectedResults: {
        elementsVisible: ['3 wrong answers', 'Export as TXT']
      }
    })
  }

  /**
   * 创建大量数据场景
   */
  createLargeDataset(): ScenarioInstance {
    const testData = WrongAnswerItemFactory.createBatch(50)
    return this.create({
      name: 'large-dataset',
      description: '大量数据场景',
      data: testData,
      expectedResults: {
        elementsVisible: ['50 wrong answers', 'Export as TXT']
      }
    })
  }

  /**
   * 创建混合分析状态场景
   */
  createMixedAnalysisStatus(): ScenarioInstance {
    const testData = createTestScenario.createBatchAnalysisScenario(10, 4)
    return this.create({
      name: 'mixed-analysis',
      description: '混合AI分析状态场景',
      data: testData,
      expectedResults: {
        elementsVisible: ['10 wrong answers', '6 items need analysis', 'Generate All Analysis']
      }
    })
  }
}

/**
 * 交互场景模板
 */
export class InteractionScenarioTemplate extends BaseScenarioTemplate {
  /**
   * 创建搜索过滤场景
   */
  createSearchFilter(): ScenarioInstance {
    const testData = [
      WrongAnswerItemFactory.create({
        sessionConfig: { topic: 'Daily Conversation', difficulty: 'A2' }
      }),
      WrongAnswerItemFactory.create({
        sessionConfig: { topic: 'Business Meeting', difficulty: 'B1' }
      }),
      WrongAnswerItemFactory.create({
        sessionConfig: { topic: 'Travel Guide', difficulty: 'A2' }
      })
    ]
    
    return this.create({
      name: 'search-filter',
      description: '搜索过滤交互场景',
      data: testData,
      expectedResults: {
        elementsVisible: ['3 wrong answers', 'Search questions...']
      }
    })
  }

  /**
   * 创建难度过滤场景
   */
  createDifficultyFilter(): ScenarioInstance {
    const testData = WrongAnswerItemFactory.createDifficultyVariants('Test Topic')
    return this.create({
      name: 'difficulty-filter',
      description: '难度级别过滤场景',
      data: testData,
      expectedResults: {
        elementsVisible: ['6 wrong answers', 'All Difficulties']
      }
    })
  }

  /**
   * 创建批量分析交互场景
   */
  createBatchAnalysisInteraction(): ScenarioInstance {
    const testData = createTestScenario.createBatchAnalysisScenario(5, 1)
    return this.create({
      name: 'batch-analysis-interaction',
      description: '批量分析交互场景',
      data: testData,
      mockConfig: {
        batchProcessingConfig: {
          isProcessing: false,
          progress: 0,
          status: { pending: 4, active: 0, completed: 0, failed: 0, total: 4 }
        }
      },
      expectedResults: {
        elementsVisible: ['4 items need analysis', 'Generate All Analysis']
      }
    })
  }

  /**
   * 创建导出交互场景
   */
  createExportInteraction(): ScenarioInstance {
    const testData = createTestScenario.createExportScenario()
    return this.create({
      name: 'export-interaction',
      description: '导出功能交互场景',
      data: testData,
      mockConfig: {
        exportConfig: {
          exportContent: 'export test content',
          shouldFail: false,
          delay: 500
        }
      },
      expectedResults: {
        elementsVisible: ['Export as TXT']
      }
    })
  }
}

/**
 * 性能测试场景模板
 */
export class PerformanceScenarioTemplate extends BaseScenarioTemplate {
  /**
   * 创建大数据量场景
   */
  createLargeDataPerformance(): ScenarioInstance {
    const testData = WrongAnswerItemFactory.createBatch(1000)
    return this.create({
      name: 'large-data-performance',
      description: '大数据量性能测试场景',
      data: testData,
      mockConfig: {
        apiDelay: 1000
      }
    })
  }

  /**
   * 创建频繁交互场景
   */
  createFrequentInteraction(): ScenarioInstance {
    const testData = createTestScenario.createStandardDisplayScenario()
    return this.create({
      name: 'frequent-interaction',
      description: '频繁用户交互场景',
      data: testData,
      mockConfig: {
        apiDelay: 50 // 快速响应
      }
    })
  }

  /**
   * 创建并发操作场景
   */
  createConcurrentOperations(): ScenarioInstance {
    const testData = createTestScenario.createBatchAnalysisScenario(20, 5)
    return this.create({
      name: 'concurrent-operations',
      description: '并发操作性能场景',
      data: testData,
      mockConfig: {
        batchProcessingConfig: {
          isProcessing: true,
          progress: 0.3,
          status: { pending: 10, active: 3, completed: 5, failed: 2, total: 20 }
        }
      }
    })
  }
}

/**
 * 场景模板工厂
 */
export class ScenarioTemplateFactory {
  private static instance: ScenarioTemplateFactory
  
  private loadingTemplate: LoadingScenarioTemplate
  private errorTemplate: ErrorScenarioTemplate
  private dataDisplayTemplate: DataDisplayScenarioTemplate
  private interactionTemplate: InteractionScenarioTemplate
  private performanceTemplate: PerformanceScenarioTemplate

  private constructor() {
    this.loadingTemplate = new LoadingScenarioTemplate()
    this.errorTemplate = new ErrorScenarioTemplate()
    this.dataDisplayTemplate = new DataDisplayScenarioTemplate()
    this.interactionTemplate = new InteractionScenarioTemplate()
    this.performanceTemplate = new PerformanceScenarioTemplate()
  }

  static getInstance(): ScenarioTemplateFactory {
    if (!this.instance) {
      this.instance = new ScenarioTemplateFactory()
    }
    return this.instance
  }

  /**
   * 获取加载场景模板
   */
  getLoadingTemplate(): LoadingScenarioTemplate {
    return this.loadingTemplate
  }

  /**
   * 获取错误场景模板
   */
  getErrorTemplate(): ErrorScenarioTemplate {
    return this.errorTemplate
  }

  /**
   * 获取数据展示场景模板
   */
  getDataDisplayTemplate(): DataDisplayScenarioTemplate {
    return this.dataDisplayTemplate
  }

  /**
   * 获取交互场景模板
   */
  getInteractionTemplate(): InteractionScenarioTemplate {
    return this.interactionTemplate
  }

  /**
   * 获取性能场景模板
   */
  getPerformanceTemplate(): PerformanceScenarioTemplate {
    return this.performanceTemplate
  }

  /**
   * 根据名称获取场景
   */
  getScenarioByName(name: string): ScenarioInstance | null {
    const scenarios = this.getAllScenarios()
    return scenarios.find(s => s.config.name === name) || null
  }

  /**
   * 获取所有可用场景
   */
  getAllScenarios(): ScenarioInstance[] {
    return [
      // 加载场景
      this.loadingTemplate.createInitialLoading(),
      this.loadingTemplate.createQuickLoading(),
      this.loadingTemplate.createSlowLoading(),
      
      // 错误场景
      this.errorTemplate.createNetworkError(),
      this.errorTemplate.createServerError(),
      this.errorTemplate.createAuthError(),
      this.errorTemplate.createExportError(),
      
      // 数据展示场景
      this.dataDisplayTemplate.createEmptyData(),
      this.dataDisplayTemplate.createSingleItem(),
      this.dataDisplayTemplate.createMultipleItems(),
      this.dataDisplayTemplate.createLargeDataset(),
      this.dataDisplayTemplate.createMixedAnalysisStatus(),
      
      // 交互场景
      this.interactionTemplate.createSearchFilter(),
      this.interactionTemplate.createDifficultyFilter(),
      this.interactionTemplate.createBatchAnalysisInteraction(),
      this.interactionTemplate.createExportInteraction(),
      
      // 性能场景
      this.performanceTemplate.createLargeDataPerformance(),
      this.performanceTemplate.createFrequentInteraction(),
      this.performanceTemplate.createConcurrentOperations()
    ]
  }
}

// 导出便捷访问实例
export const scenarioTemplateFactory = ScenarioTemplateFactory.getInstance()
export const loadingScenarios = scenarioTemplateFactory.getLoadingTemplate()
export const errorScenarios = scenarioTemplateFactory.getErrorTemplate()
export const dataDisplayScenarios = scenarioTemplateFactory.getDataDisplayTemplate()
export const interactionScenarios = scenarioTemplateFactory.getInteractionTemplate()
export const performanceScenarios = scenarioTemplateFactory.getPerformanceTemplate()