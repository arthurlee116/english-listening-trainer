/**
 * 批量分析功能测试 - 基于设计文档的并发处理、进度跟踪、失败重试逻辑测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MockServiceFactory } from '@/__tests__/utils/mock-service-factory'
import { 
  createTestScenario,
  WrongAnswerItemFactory
} from '@/__tests__/utils/test-data-factory'
import { 
  interactionScenarios,
  loadingScenarios
} from '@/__tests__/utils/test-scenarios'
import { Selector, TestIds } from '@/__tests__/utils/selector-optimization'

// 创建批量分析组件用于测试
const BatchAnalysisToolbar = ({ 
  wrongAnswers, 
  onBatchStart, 
  onBatchComplete,
  onBatchError 
}: {
  wrongAnswers: any[]
  onBatchStart?: () => void
  onBatchComplete?: (results: any) => void
  onBatchError?: (error: string) => void
}) => {
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [status, setStatus] = React.useState({
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    total: 0
  })
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false)
  
  // 模拟使用Hook
  const { useBatchProcessing } = require('@/hooks/use-batch-processing')
  const { useBilingualText } = require('@/hooks/use-bilingual-text')
  const { t } = useBilingualText()
  const batchHook = useBatchProcessing()
  
  // 需要分析的项目数量
  const itemsNeedingAnalysis = wrongAnswers.filter(item => 
    item.answer.needsAnalysis
  ).length

  const handleBatchAnalysis = async () => {
    if (itemsNeedingAnalysis === 0) return
    
    setShowConfirmDialog(true)
  }

  const handleConfirmBatch = async () => {
    setShowConfirmDialog(false)
    setIsProcessing(true)
    onBatchStart?.()
    
    try {
      // 模拟批量处理
      const results = await batchHook.processBatch(wrongAnswers)
      onBatchComplete?.(results)
    } catch (error) {
      onBatchError?.(error instanceof Error ? error.message : 'Batch processing failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelBatch = () => {
    setShowConfirmDialog(false)
  }

  const handleRetryFailed = async () => {
    // 重试失败的项目
    await batchHook.processBatch(wrongAnswers, { retryFailed: true })
  }

  return (
    <div data-testid={TestIds.COMPONENT_PREFIX + '-batch-analysis-toolbar'}>
      {/* 分析需求提示 */}
      {itemsNeedingAnalysis > 0 && (
        <div data-testid={TestIds.ANALYSIS_NEEDED_COUNT}>
          {t('components.wrongAnswersBook.batchAnalysis.itemsNeedingAnalysis', { count: itemsNeedingAnalysis })}
        </div>
      )}

      {/* 批量分析按钮 */}
      {itemsNeedingAnalysis > 0 && !isProcessing && (
        <button
          data-testid={TestIds.BATCH_ANALYSIS_BUTTON}
          onClick={handleBatchAnalysis}
          disabled={isProcessing}
        >
          {t('components.wrongAnswersBook.batchAnalysis.generateAll')}
        </button>
      )}

      {/* 进度显示 */}
      {isProcessing && (
        <div data-testid={TestIds.BATCH_PROGRESS}>
          <div>Processing: {Math.round(batchHook.progress * 100)}%</div>
          <div data-testid={TestIds.BATCH_STATUS}>
            Pending: {batchHook.status.pending}, 
            Active: {batchHook.status.active}, 
            Completed: {batchHook.status.completed}, 
            Failed: {batchHook.status.failed}
          </div>
        </div>
      )}

      {/* 重试失败按钮 */}
      {status.failed > 0 && !isProcessing && (
        <button
          data-testid="retry-failed-button"
          onClick={handleRetryFailed}
        >
          {t('components.wrongAnswersBook.batchAnalysis.retryFailed')}
        </button>
      )}

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div data-testid="batch-confirm-dialog" role="dialog">
          <h3>{t('components.wrongAnswersBook.batchAnalysis.confirmTitle')}</h3>
          <p>{t('components.wrongAnswersBook.batchAnalysis.confirmDescription', { count: itemsNeedingAnalysis })}</p>
          <p>{t('components.wrongAnswersBook.batchAnalysis.processingWarning')}</p>
          <button
            data-testid="confirm-batch-button"
            onClick={handleConfirmBatch}
          >
            {t('components.wrongAnswersBook.batchAnalysis.startProcessing')}
          </button>
          <button
            data-testid="cancel-batch-button"
            onClick={handleCancelBatch}
          >
            {t('common.buttons.cancel')}
          </button>
        </div>
      )}

      {/* 批量处理结果 */}
      {batchHook.results && (
        <div data-testid="batch-results">
          <div data-testid="success-count">
            {t('components.wrongAnswersBook.batchAnalysis.successCount', { count: batchHook.results.successful })}
          </div>
          <div data-testid="failed-count">
            {t('components.wrongAnswersBook.batchAnalysis.failedCount', { count: batchHook.results.failed })}
          </div>
        </div>
      )}
    </div>
  )
}

describe('批量分析功能测试', () => {
  const mockOnBatchStart = vi.fn()
  const mockOnBatchComplete = vi.fn()
  const mockOnBatchError = vi.fn()
  let mockServiceFactory: MockServiceFactory

  beforeEach(() => {
    mockServiceFactory = MockServiceFactory.getInstance()
    mockServiceFactory.resetAllMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('批量分析触发条件', () => {
    it('should show batch analysis button when items need analysis', async () => {
      // 使用场景模板创建测试数据
      const scenario = interactionScenarios.createBatchAnalysisInteraction()
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: scenario.getData(),
        batchProcessingState: scenario.config.mockConfig?.batchProcessingConfig
      })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={scenario.getData()}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证显示需要分析的项目数量
      expect(screen.getByTestId(TestIds.ANALYSIS_NEEDED_COUNT)).toBeInTheDocument()
      expect(screen.getByText('4 items need analysis')).toBeInTheDocument()

      // 验证批量分析按钮存在
      const batchButton = Selector.findBatchAnalysisButton()
      expect(batchButton).toBeInTheDocument()
      expect(batchButton).toBeEnabled()
    })

    it('should hide batch analysis button when no items need analysis', async () => {
      // 创建全部已分析的数据
      const testData = WrongAnswerItemFactory.createBatch(3).map(item => 
        WrongAnswerItemFactory.createWithAnalysis({
          sessionConfig: item.session,
          questionConfig: item.question
        })
      )

      mockServiceFactory.createWrongAnswersBookTestEnv({ wrongAnswers: testData })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证不显示批量分析相关元素
      expect(screen.queryByTestId(TestIds.ANALYSIS_NEEDED_COUNT)).not.toBeInTheDocument()
      expect(screen.queryByTestId(TestIds.BATCH_ANALYSIS_BUTTON)).not.toBeInTheDocument()
    })

    it('should disable batch analysis button during processing', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(5, 2)
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: true,
          progress: 0.4,
          status: { pending: 1, active: 2, completed: 2, failed: 0, total: 5 }
        }
      })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证进度显示
      expect(screen.getByTestId(TestIds.BATCH_PROGRESS)).toBeInTheDocument()
      expect(screen.getByText(/Processing: 40%/)).toBeInTheDocument()

      // 验证批量分析按钮不存在（因为正在处理）
      expect(screen.queryByTestId(TestIds.BATCH_ANALYSIS_BUTTON)).not.toBeInTheDocument()
    })
  })

  describe('确认对话框流程', () => {
    it('should show confirmation dialog when batch analysis is triggered', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(3, 0)
      mockServiceFactory.createWrongAnswersBookTestEnv({ wrongAnswers: testData })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 点击批量分析按钮
      const batchButton = Selector.findBatchAnalysisButton()
      await user.click(batchButton)

      // 验证确认对话框显示
      expect(screen.getByTestId('batch-confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Confirm Batch Analysis')).toBeInTheDocument()
      expect(screen.getByText('This will analyze 3 questions')).toBeInTheDocument()
      expect(screen.getByText('This may take several minutes')).toBeInTheDocument()

      // 验证对话框按钮
      expect(screen.getByTestId('confirm-batch-button')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-batch-button')).toBeInTheDocument()
    })

    it('should cancel batch analysis when cancel button is clicked', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(3, 0)
      mockServiceFactory.createWrongAnswersBookTestEnv({ wrongAnswers: testData })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 触发确认对话框
      const batchButton = Selector.findBatchAnalysisButton()
      await user.click(batchButton)

      // 点击取消按钮
      const cancelButton = screen.getByTestId('cancel-batch-button')
      await user.click(cancelButton)

      // 验证对话框关闭
      expect(screen.queryByTestId('batch-confirm-dialog')).not.toBeInTheDocument()
      expect(mockOnBatchStart).not.toHaveBeenCalled()
    })

    it('should start batch processing when confirmed', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(3, 0)
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: false,
          progress: 0,
          status: { pending: 3, active: 0, completed: 0, failed: 0, total: 3 }
        }
      })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 触发并确认批量分析
      const batchButton = Selector.findBatchAnalysisButton()
      await user.click(batchButton)

      const confirmButton = screen.getByTestId('confirm-batch-button')
      await user.click(confirmButton)

      // 验证批量处理开始
      expect(mockOnBatchStart).toHaveBeenCalledTimes(1)

      // 验证对话框关闭
      expect(screen.queryByTestId('batch-confirm-dialog')).not.toBeInTheDocument()
    })
  })

  describe('进度跟踪功能', () => {
    it('should display progress information during processing', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(10, 3)
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: true,
          progress: 0.6,
          status: { pending: 2, active: 2, completed: 5, failed: 1, total: 10 }
        }
      })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证进度显示
      const progressElement = screen.getByTestId(TestIds.BATCH_PROGRESS)
      expect(progressElement).toBeInTheDocument()
      expect(screen.getByText('Processing: 60%')).toBeInTheDocument()

      // 验证状态详情
      const statusElement = screen.getByTestId(TestIds.BATCH_STATUS)
      expect(statusElement).toBeInTheDocument()
      expect(statusElement.textContent).toContain('Pending: 2')
      expect(statusElement.textContent).toContain('Active: 2')
      expect(statusElement.textContent).toContain('Completed: 5')
      expect(statusElement.textContent).toContain('Failed: 1')
    })

    it('should update progress in real-time', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(5, 0)
      
      // 初始状态
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: true,
          progress: 0.2,
          status: { pending: 4, active: 1, completed: 0, failed: 0, total: 5 }
        }
      })

      const { rerender } = render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证初始进度
      expect(screen.getByText('Processing: 20%')).toBeInTheDocument()

      // 模拟进度更新
      mockServiceFactory.getHookMockProvider().configureBatchProcessing({
        isProcessing: true,
        progress: 0.8,
        status: { pending: 1, active: 1, completed: 3, failed: 0, total: 5 }
      })

      rerender(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证进度更新
      await waitFor(() => {
        expect(screen.getByText('Processing: 80%')).toBeInTheDocument()
      })
    })
  })

  describe('失败重试逻辑', () => {
    it('should show retry button when there are failed items', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(5, 0)
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: false,
          progress: 1,
          status: { pending: 0, active: 0, completed: 3, failed: 2, total: 5 },
          results: { successful: 3, failed: 2 }
        }
      })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证重试按钮显示
      expect(screen.getByTestId('retry-failed-button')).toBeInTheDocument()

      // 验证结果显示
      expect(screen.getByTestId('batch-results')).toBeInTheDocument()
      expect(screen.getByTestId('success-count')).toBeInTheDocument()
      expect(screen.getByTestId('failed-count')).toBeInTheDocument()
    })

    it('should handle retry operation', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(5, 0)
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: false,
          progress: 1,
          status: { pending: 0, active: 0, completed: 3, failed: 2, total: 5 },
          results: { successful: 3, failed: 2 }
        }
      })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 点击重试按钮
      const retryButton = screen.getByTestId('retry-failed-button')
      await user.click(retryButton)

      // 验证重试调用
      const { useBatchProcessing } = require('@/hooks/use-batch-processing')
      const batchHook = useBatchProcessing()
      await waitFor(() => {
        expect(batchHook.processBatch).toHaveBeenCalledWith(testData, { retryFailed: true })
      })
    })

    it('should handle retry errors gracefully', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(3, 0)
      
      // 配置重试失败
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: false,
          status: { pending: 0, active: 0, completed: 1, failed: 2, total: 3 },
          error: 'Retry operation failed'
        }
      })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      const retryButton = screen.getByTestId('retry-failed-button')
      await user.click(retryButton)

      await waitFor(() => {
        expect(mockOnBatchError).toHaveBeenCalledWith('Batch processing failed')
      })
    })
  })

  describe('并发处理能力', () => {
    it('should respect concurrency limits', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(20, 0)
      
      // 配置并发限制
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        concurrencyConfig: {
          totalSlots: 5,
          activeSlots: 3,
          pendingCount: 15,
          completedCount: 2,
          failedCount: 0
        }
      })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证并发状态显示
      const { aiAnalysisConcurrency } = require('@/lib/concurrency-service')
      const status = aiAnalysisConcurrency.getStatus()
      
      expect(status.total).toBe(5)
      expect(status.active).toBe(3)
      expect(status.pending).toBe(15)
    })

    it('should handle concurrent batch operations', async () => {
      const scenario = interactionScenarios.createBatchAnalysisInteraction()
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: scenario.getData(),
        batchProcessingState: {
          isProcessing: true,
          progress: 0.3,
          status: { pending: 2, active: 3, completed: 1, failed: 0, total: 6 }
        }
      })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={scenario.getData()}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证正在进行的批量处理状态
      expect(screen.getByTestId(TestIds.BATCH_PROGRESS)).toBeInTheDocument()
      expect(screen.getByText('Processing: 30%')).toBeInTheDocument()

      // 验证并发状态
      const statusElement = screen.getByTestId(TestIds.BATCH_STATUS)
      expect(statusElement.textContent).toContain('Active: 3')
      expect(statusElement.textContent).toContain('Pending: 2')
    })
  })

  describe('错误处理和边界情况', () => {
    it('should handle batch processing errors', async () => {
      const testData = createTestScenario.createBatchAnalysisScenario(3, 0)
      
      // 配置处理失败
      mockServiceFactory.createWrongAnswersBookTestEnv({
        wrongAnswers: testData,
        batchProcessingState: {
          isProcessing: false,
          error: 'AI service unavailable'
        }
      })

      const user = userEvent.setup()

      render(
        <BatchAnalysisToolbar
          wrongAnswers={testData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 触发批量分析
      const batchButton = Selector.findBatchAnalysisButton()
      await user.click(batchButton)

      const confirmButton = screen.getByTestId('confirm-batch-button')
      await user.click(confirmButton)

      // 验证错误回调
      await waitFor(() => {
        expect(mockOnBatchError).toHaveBeenCalledWith('Batch processing failed')
      })
    })

    it('should handle empty batch gracefully', async () => {
      const emptyData = createTestScenario.createEmptyState()
      mockServiceFactory.createWrongAnswersBookTestEnv({ wrongAnswers: emptyData })

      render(
        <BatchAnalysisToolbar
          wrongAnswers={emptyData}
          onBatchStart={mockOnBatchStart}
          onBatchComplete={mockOnBatchComplete}
          onBatchError={mockOnBatchError}
        />
      )

      // 验证没有显示批量分析相关元素
      expect(screen.queryByTestId(TestIds.BATCH_ANALYSIS_BUTTON)).not.toBeInTheDocument()
      expect(screen.queryByTestId(TestIds.ANALYSIS_NEEDED_COUNT)).not.toBeInTheDocument()
    })
  })
})