/**
 * 元素选择器优化策略 - 基于设计文档的测试选择器规范
 * 
 * 实施data-testid属性标准、语义化选择器层次，解决元素查找歧义问题
 */

import { screen, within, type ByRoleOptions } from '@testing-library/react'
import type { HTMLElement } from 'jsdom'

/**
 * 选择器优先级枚举
 */
export enum SelectorPriority {
  DATA_TESTID = 1,    // 最高优先级：data-testid
  SEMANTIC_ROLE = 2,  // 语义角色：role + accessible name
  LABEL_TEXT = 3,     // 标签文本：label关联
  TEXT_CONTENT = 4    // 最低优先级：文本内容
}

/**
 * 选择器配置接口
 */
export interface SelectorConfig {
  /** 选择器类型 */
  type: SelectorPriority
  /** 选择器值 */
  value: string
  /** 额外选项 */
  options?: ByRoleOptions | any
  /** 容器限定 */
  container?: HTMLElement
  /** 超时设置 */
  timeout?: number
}

/**
 * 测试ID标准化规范
 */
export class TestIdStandard {
  // 页面级别组件前缀
  static readonly PAGE_PREFIX = 'page'
  // 组件级别前缀
  static readonly COMPONENT_PREFIX = 'component'
  // 元素级别前缀
  static readonly ELEMENT_PREFIX = 'element'
  // 状态相关前缀
  static readonly STATE_PREFIX = 'state'
  // 操作相关前缀
  static readonly ACTION_PREFIX = 'action'

  /**
   * 生成页面级TestID
   */
  static page(name: string): string {
    return `${this.PAGE_PREFIX}-${name}`
  }

  /**
   * 生成组件级TestID
   */
  static component(componentName: string, element?: string): string {
    const base = `${this.COMPONENT_PREFIX}-${componentName}`
    return element ? `${base}-${element}` : base
  }

  /**
   * 生成元素级TestID
   */
  static element(elementName: string, index?: number): string {
    const base = `${this.ELEMENT_PREFIX}-${elementName}`
    return index !== undefined ? `${base}-${index}` : base
  }

  /**
   * 生成状态相关TestID
   */
  static state(stateName: string): string {
    return `${this.STATE_PREFIX}-${stateName}`
  }

  /**
   * 生成操作相关TestID
   */
  static action(actionName: string): string {
    return `${this.ACTION_PREFIX}-${actionName}`
  }

  /**
   * 生成复合TestID
   */
  static compound(parts: string[]): string {
    return parts.join('-')
  }
}

/**
 * 错题本组件专用TestID常量
 */
export const WrongAnswersBookTestIds = {
  // 主容器
  MAIN_CONTAINER: TestIdStandard.component('wrong-answers-book'),
  
  // 状态相关
  LOADING_STATE: TestIdStandard.state('loading'),
  ERROR_STATE: TestIdStandard.state('error'),
  EMPTY_STATE: TestIdStandard.state('empty'),
  
  // 列表相关
  ANSWERS_LIST: TestIdStandard.element('answers-list'),
  QUESTION_ITEM: (index: number) => TestIdStandard.element('question-item', index),
  
  // 搜索和过滤
  SEARCH_INPUT: TestIdStandard.element('search-input'),
  DIFFICULTY_FILTER: TestIdStandard.element('difficulty-filter'),
  LANGUAGE_FILTER: TestIdStandard.element('language-filter'),
  TYPE_FILTER: TestIdStandard.element('type-filter'),
  
  // 操作按钮
  EXPORT_BUTTON: TestIdStandard.action('export'),
  BATCH_ANALYSIS_BUTTON: TestIdStandard.action('batch-analysis'),
  RETRY_BUTTON: TestIdStandard.action('retry'),
  BACK_BUTTON: TestIdStandard.action('back'),
  
  // AI分析相关
  AI_ANALYSIS_CARD: TestIdStandard.component('ai-analysis-card'),
  ANALYSIS_NEEDED_INDICATOR: TestIdStandard.element('analysis-needed'),
  
  // 批量处理相关
  BATCH_PROGRESS: TestIdStandard.element('batch-progress'),
  BATCH_STATUS: TestIdStandard.element('batch-status'),
  
  // 导出相关
  EXPORT_CONTAINER: TestIdStandard.component('export-container'),
  EXPORT_PROGRESS: TestIdStandard.element('export-progress'),
  
  // 答案比较
  YOUR_ANSWER: (index: number) => TestIdStandard.compound(['your-answer', index.toString()]),
  CORRECT_ANSWER: (index: number) => TestIdStandard.compound(['correct-answer', index.toString()]),
  
  // 统计信息
  WRONG_ANSWERS_COUNT: TestIdStandard.element('wrong-answers-count'),
  ANALYSIS_NEEDED_COUNT: TestIdStandard.element('analysis-needed-count')
} as const

/**
 * 增强选择器工具类
 */
export class EnhancedSelector {
  /**
   * 按优先级查找元素
   */
  static findByPriority(configs: SelectorConfig[]): HTMLElement {
    // 按优先级排序
    const sortedConfigs = configs.sort((a, b) => a.type - b.type)
    
    for (const config of sortedConfigs) {
      try {
        const element = this.findBySingleConfig(config)
        if (element) return element
      } catch (error) {
        // 继续尝试下一个选择器
        continue
      }
    }
    
    throw new Error('Element not found with any of the provided selectors')
  }

  /**
   * 根据单个配置查找元素
   */
  private static findBySingleConfig(config: SelectorConfig): HTMLElement {
    const { type, value, options, container } = config
    const searchScope = container ? within(container) : screen
    
    switch (type) {
      case SelectorPriority.DATA_TESTID:
        return searchScope.getByTestId(value)
      
      case SelectorPriority.SEMANTIC_ROLE:
        return searchScope.getByRole(value as any, options as ByRoleOptions)
      
      case SelectorPriority.LABEL_TEXT:
        return searchScope.getByLabelText(value, options)
      
      case SelectorPriority.TEXT_CONTENT:
        return searchScope.getByText(value, options)
      
      default:
        throw new Error(`Unsupported selector type: ${type}`)
    }
  }

  /**
   * 查找错题本组件的导出按钮（解决歧义问题）
   */
  static findExportButton(container?: HTMLElement): HTMLElement {
    return this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.EXPORT_BUTTON,
        container
      },
      {
        type: SelectorPriority.SEMANTIC_ROLE,
        value: 'button',
        options: { name: /export.*txt/i },
        container
      },
      {
        type: SelectorPriority.TEXT_CONTENT,
        value: 'Export as TXT',
        container
      }
    ])
  }

  /**
   * 查找搜索输入框
   */
  static findSearchInput(container?: HTMLElement): HTMLElement {
    return this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.SEARCH_INPUT,
        container
      },
      {
        type: SelectorPriority.LABEL_TEXT,
        value: /search/i,
        container
      },
      {
        type: SelectorPriority.SEMANTIC_ROLE,
        value: 'textbox',
        options: { name: /search/i },
        container
      }
    ])
  }

  /**
   * 查找批量分析按钮
   */
  static findBatchAnalysisButton(container?: HTMLElement): HTMLElement {
    return this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.BATCH_ANALYSIS_BUTTON,
        container
      },
      {
        type: SelectorPriority.SEMANTIC_ROLE,
        value: 'button',
        options: { name: /generate.*all.*analysis/i },
        container
      },
      {
        type: SelectorPriority.TEXT_CONTENT,
        value: /generate.*all.*analysis/i,
        container
      }
    ])
  }

  /**
   * 查找答案比较区域（解决\"Your Answer\"歧义）
   */
  static findAnswerComparison(questionIndex: number, container?: HTMLElement): {
    yourAnswer: HTMLElement
    correctAnswer: HTMLElement
  } {
    const questionContainer = container || this.findQuestionItem(questionIndex)
    
    const yourAnswer = this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.YOUR_ANSWER(questionIndex),
        container: questionContainer
      },
      {
        type: SelectorPriority.TEXT_CONTENT,
        value: 'Your Answer',
        container: questionContainer
      }
    ])
    
    const correctAnswer = this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.CORRECT_ANSWER(questionIndex),
        container: questionContainer
      },
      {
        type: SelectorPriority.TEXT_CONTENT,
        value: 'Correct Answer',
        container: questionContainer
      }
    ])
    
    return { yourAnswer, correctAnswer }
  }

  /**
   * 查找问题项目容器
   */
  static findQuestionItem(index: number, container?: HTMLElement): HTMLElement {
    return this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.QUESTION_ITEM(index),
        container
      }
    ])
  }

  /**
   * 查找状态指示器
   */
  static findStateIndicator(state: 'loading' | 'error' | 'empty', container?: HTMLElement): HTMLElement {
    const testIdMap = {
      loading: WrongAnswersBookTestIds.LOADING_STATE,
      error: WrongAnswersBookTestIds.ERROR_STATE,
      empty: WrongAnswersBookTestIds.EMPTY_STATE
    }
    
    return this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: testIdMap[state],
        container
      }
    ])
  }

  /**
   * 查找AI分析卡片
   */
  static findAIAnalysisCard(container?: HTMLElement): HTMLElement {
    return this.findByPriority([
      {
        type: SelectorPriority.DATA_TESTID,
        value: WrongAnswersBookTestIds.AI_ANALYSIS_CARD,
        container
      },
      {
        type: SelectorPriority.TEXT_CONTENT,
        value: 'AI Analysis',
        container
      }
    ])
  }
}

/**
 * 语义化查询助手
 */
export class SemanticQueryHelper {
  /**
   * 查找所有按钮并按功能分类
   */
  static categorizeButtons(container?: HTMLElement): {
    primary: HTMLElement[]
    secondary: HTMLElement[]
    danger: HTMLElement[]
  } {
    const searchScope = container ? within(container) : screen
    const allButtons = searchScope.getAllByRole('button')
    
    const categorized = {
      primary: [] as HTMLElement[],
      secondary: [] as HTMLElement[],
      danger: [] as HTMLElement[]
    }
    
    allButtons.forEach(button => {
      const text = button.textContent?.toLowerCase() || ''
      const className = button.className.toLowerCase()
      
      if (text.includes('export') || text.includes('generate') || className.includes('primary')) {
        categorized.primary.push(button)
      } else if (text.includes('retry') || text.includes('cancel') || className.includes('danger')) {
        categorized.danger.push(button)
      } else {
        categorized.secondary.push(button)
      }
    })
    
    return categorized
  }

  /**
   * 查找输入控件并按类型分类
   */
  static categorizeInputs(container?: HTMLElement): {
    search: HTMLElement[]
    filter: HTMLElement[]
    form: HTMLElement[]
  } {
    const searchScope = container ? within(container) : screen
    const allInputs = [
      ...searchScope.getAllByRole('textbox'),
      ...searchScope.getAllByRole('combobox'),
      ...searchScope.getAllByRole('searchbox')
    ]
    
    const categorized = {
      search: [] as HTMLElement[],
      filter: [] as HTMLElement[],
      form: [] as HTMLElement[]
    }
    
    allInputs.forEach(input => {
      const placeholder = input.getAttribute('placeholder')?.toLowerCase() || ''
      const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || ''
      
      if (placeholder.includes('search') || ariaLabel.includes('search')) {
        categorized.search.push(input)
      } else if (placeholder.includes('filter') || ariaLabel.includes('filter')) {
        categorized.filter.push(input)
      } else {
        categorized.form.push(input)
      }
    })
    
    return categorized
  }

  /**
   * 智能文本查找（处理多语言和模糊匹配）
   */
  static findTextSmart(text: string, options: {
    exact?: boolean
    ignoreCase?: boolean
    container?: HTMLElement
  } = {}): HTMLElement {
    const { exact = false, ignoreCase = true, container } = options
    const searchScope = container ? within(container) : screen
    
    // 构建查询选项
    const queryOptions: any = {}
    if (!exact) {
      queryOptions.exact = false
    }
    if (ignoreCase) {
      queryOptions.normalizer = (text: string) => text.toLowerCase().trim()
    }
    
    try {
      return searchScope.getByText(text, queryOptions)
    } catch (error) {
      // 如果精确匹配失败，尝试模糊匹配
      if (exact) {
        return searchScope.getByText(new RegExp(text, ignoreCase ? 'i' : ''), queryOptions)
      }
      throw error
    }
  }
}

/**
 * 选择器工具集合导出
 */
export const SelectorUtils = {
  TestIds: WrongAnswersBookTestIds,
  Enhanced: EnhancedSelector,
  Semantic: SemanticQueryHelper,
  Standard: TestIdStandard,
  Priority: SelectorPriority
} as const

// 便捷导出
export { EnhancedSelector as Selector }
export { WrongAnswersBookTestIds as TestIds }
export { SemanticQueryHelper as Semantic }
export { TestIdStandard as Standard }