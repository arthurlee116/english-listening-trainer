import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MockServiceFactory } from '@/__tests__/utils/mock-service-factory'
import { createTestScenario } from '@/__tests__/utils/test-data-factory'
import type { WrongAnswerItem } from '@/lib/types'

// 创建测试组件包含导出功能
const ExportButton = ({ 
  wrongAnswers, 
  onExportComplete, 
  onExportError 
}: {
  wrongAnswers: WrongAnswerItem[]
  onExportComplete?: () => void
  onExportError?: (error: string) => void
}) => {
  const [exporting, setExporting] = React.useState(false)
  
  // 使用模拟的服务
  const { ExportService } = require('@/lib/export-service')
  const { useBilingualText } = require('@/hooks/use-bilingual-text')
  const { t } = useBilingualText()

  const handleExport = async () => {
    try {
      setExporting(true)
      
      const exportContent = await ExportService.exportToTXT(wrongAnswers, {
        includeTranscript: true,
        includeTimestamps: true,
        format: 'detailed'
      })
      
      ExportService.downloadFile(exportContent)
      onExportComplete?.()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed'
      onExportError?.(errorMessage)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div data-testid="export-container">
      <button 
        data-testid="export-button"
        onClick={handleExport}
        disabled={exporting || wrongAnswers.length === 0}
        className="export-button"
      >
        {exporting ? t('components.wrongAnswersBook.export.exporting') : t('components.wrongAnswersBook.export.exportAsTxt')}
      </button>
      {exporting && (
        <div data-testid="export-progress">
          正在导出...
        </div>
      )}
    </div>
  )
}

describe('Export Functionality Enhanced Tests', () => {
  const mockOnExportComplete = vi.fn()
  const mockOnExportError = vi.fn()
  let mockServiceFactory: MockServiceFactory

  beforeEach(() => {
    mockServiceFactory = MockServiceFactory.getInstance()
    mockServiceFactory.resetAllMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('导出按钮状态管理', () => {
    it('should render export button with correct text', async () => {
      // 配置标准化Mock环境
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'mock export content',
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      expect(screen.getByTestId('export-button')).toBeInTheDocument()
      expect(screen.getByText('Export as TXT')).toBeInTheDocument()
    })

    it('should disable button when no wrong answers', async () => {
      mockServiceFactory.createWrongAnswersBookTestEnv()
      
      render(
        <ExportButton
          wrongAnswers={[]}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      expect(button).toBeDisabled()
    })

    it('should show exporting state when processing', async () => {
      const user = userEvent.setup()
      
      // 配置慢速导出
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'delayed content',
        delay: 100,
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      expect(screen.getByText('Exporting...')).toBeInTheDocument()
      expect(screen.getByTestId('export-progress')).toBeInTheDocument()
      expect(button).toBeDisabled()
      
      // 等待导出完成
      await waitFor(() => {
        expect(screen.getByText('Export as TXT')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('导出流程测试', () => {
    it('should call ExportService.exportToTXT with correct parameters', async () => {
      const user = userEvent.setup()
      
      // 配置Mock服务
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'mock export content',
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      // 验证服务调用
      await waitFor(() => {
        const { ExportService } = require('@/lib/export-service')
        expect(ExportService.exportToTXT).toHaveBeenCalledWith(
          testData,
          {
            includeTranscript: true,
            includeTimestamps: true,
            format: 'detailed'
          }
        )
        expect(ExportService.downloadFile).toHaveBeenCalledWith('mock export content')
        expect(mockOnExportComplete).toHaveBeenCalled()
      })
    })

    it('should handle export success with callback', async () => {
      const user = userEvent.setup()
      
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'successful export content',
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      await waitFor(() => {
        expect(mockOnExportComplete).toHaveBeenCalledTimes(1)
        expect(mockOnExportError).not.toHaveBeenCalled()
      })
    })

    it('should handle export failure with error callback', async () => {
      const user = userEvent.setup()
      
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        shouldFail: true,
        delay: 0
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      await waitFor(() => {
        expect(mockOnExportError).toHaveBeenCalledWith('Export failed')
        expect(mockOnExportComplete).not.toHaveBeenCalled()
      })
    })
  })

  describe('文件下载验证', () => {
    it('should verify download file operation', async () => {
      const user = userEvent.setup()
      
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'download test content',
        filename: 'test-export.txt',
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      await waitFor(() => {
        const { ExportService } = require('@/lib/export-service')
        expect(ExportService.downloadFile).toHaveBeenCalledWith('download test content')
      })
    })

    it('should handle different export formats', async () => {
      const user = userEvent.setup()
      
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'formatted content',
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      await waitFor(() => {
        const { ExportService } = require('@/lib/export-service')
        expect(ExportService.exportToTXT).toHaveBeenCalledWith(
          testData,
          expect.objectContaining({
            includeTranscript: true,
            includeTimestamps: true,
            format: 'detailed'
          })
        )
      })
    })
  })

  describe('异步操作处理', () => {
    it('should handle concurrent export attempts', async () => {
      const user = userEvent.setup()
      
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        exportContent: 'concurrent test',
        delay: 100,
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      
      // 第一次点击
      await user.click(button)
      expect(button).toBeDisabled()
      
      // 尝试第二次点击（应该被禁用）
      await user.click(button)
      
      // 验证只有一次导出调用
      await waitFor(() => {
        const { ExportService } = require('@/lib/export-service')
        expect(ExportService.exportToTXT).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle export timeout scenarios', async () => {
      const user = userEvent.setup()
      
      mockServiceFactory.createWrongAnswersBookTestEnv()
      const serviceProvider = mockServiceFactory.getServiceMockProvider()
      serviceProvider.configureExportService({
        delay: 1000, // 长时间延迟
        shouldFail: false
      })
      
      const testData = createTestScenario.createExportScenario()
      
      render(
        <ExportButton
          wrongAnswers={testData}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByTestId('export-button')
      await user.click(button)

      // 验证加载状态
      expect(screen.getByText('Exporting...')).toBeInTheDocument()
      expect(screen.getByTestId('export-progress')).toBeInTheDocument()
      
      // 等待完成
      await waitFor(() => {
        expect(screen.getByText('Export as TXT')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })
})
      })
    })

    it('should handle unknown errors', async () => {
      const user = userEvent.setup()
      vi.mocked(ExportService.exportToTXT).mockRejectedValue('Unknown error')

      render(
        <ExportButton
          wrongAnswers={[mockWrongAnswerWithAnalysis]}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      await user.click(button)

      await waitFor(() => {
        expect(mockOnExportError).toHaveBeenCalledWith('Export failed')
      })
    })

    it('should reset button state after error', async () => {
      const user = userEvent.setup()
      vi.mocked(ExportService.exportToTXT).mockRejectedValue(new Error('Failed'))

      render(
        <ExportButton
          wrongAnswers={[mockWrongAnswerWithAnalysis]}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export as TXT')).toBeInTheDocument()
        expect(screen.getByText('Export as TXT')).not.toBeDisabled()
      })
    })
  })

  describe('Export Content Validation', () => {
    it('should export items with AI analysis', async () => {
      const user = userEvent.setup()
      vi.mocked(ExportService.exportToTXT).mockResolvedValue('content')

      render(
        <ExportButton
          wrongAnswers={[mockWrongAnswerWithAnalysis]}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      await user.click(button)

      await waitFor(() => {
        const [wrongAnswers, options] = vi.mocked(ExportService.exportToTXT).mock.calls[0]
        expect(wrongAnswers[0].answer.aiAnalysis).toBeDefined()
        expect(options).toEqual({
          includeTranscript: true,
          includeTimestamps: true,
          format: 'detailed'
        })
      })
    })

    it('should export items without AI analysis', async () => {
      const user = userEvent.setup()
      vi.mocked(ExportService.exportToTXT).mockResolvedValue('content')

      render(
        <ExportButton
          wrongAnswers={[mockWrongAnswerWithoutAnalysis]}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      await user.click(button)

      await waitFor(() => {
        const [wrongAnswers] = vi.mocked(ExportService.exportToTXT).mock.calls[0]
        expect(wrongAnswers[0].answer.aiAnalysis).toBeUndefined()
      })
    })

    it('should export mixed items (with and without analysis)', async () => {
      const user = userEvent.setup()
      const mixedAnswers = [mockWrongAnswerWithAnalysis, mockWrongAnswerWithoutAnalysis]
      vi.mocked(ExportService.exportToTXT).mockResolvedValue('content')

      render(
        <ExportButton
          wrongAnswers={mixedAnswers}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      await user.click(button)

      await waitFor(() => {
        const [wrongAnswers] = vi.mocked(ExportService.exportToTXT).mock.calls[0]
        expect(wrongAnswers).toHaveLength(2)
        expect(wrongAnswers[0].answer.aiAnalysis).toBeDefined()
        expect(wrongAnswers[1].answer.aiAnalysis).toBeUndefined()
      })
    })
  })

  describe('Export Options', () => {
    it('should use default export options', async () => {
      const user = userEvent.setup()
      vi.mocked(ExportService.exportToTXT).mockResolvedValue('content')

      render(
        <ExportButton
          wrongAnswers={[mockWrongAnswerWithAnalysis]}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      await user.click(button)

      await waitFor(() => {
        const [, options] = vi.mocked(ExportService.exportToTXT).mock.calls[0]
        expect(options).toEqual({
          includeTranscript: true,
          includeTimestamps: true,
          format: 'detailed'
        })
      })
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const user = userEvent.setup()
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        ...mockWrongAnswerWithAnalysis,
        answerId: `answer-${i}`
      }))
      
      vi.mocked(ExportService.exportToTXT).mockResolvedValue('large content')

      render(
        <ExportButton
          wrongAnswers={largeDataset}
          onExportComplete={mockOnExportComplete}
          onExportError={mockOnExportError}
        />
      )

      const button = screen.getByText('Export as TXT')
      const startTime = Date.now()
      
      await user.click(button)

      await waitFor(() => {
        expect(ExportService.exportToTXT).toHaveBeenCalledWith(
          largeDataset,
          expect.any(Object)
        )
      })

      const endTime = Date.now()
      // Should complete within reasonable time (less than 1 second for mocked operation)
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should not block UI during export', async () => {
      const user = userEvent.setup()
      
      // Mock a slow export that resolves after a delay
      vi.mocked(ExportService.exportToTXT).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('content'), 50))
      )

      render(
        <div>
          <ExportButton
            wrongAnswers={[mockWrongAnswerWithAnalysis]}
            onExportComplete={mockOnExportComplete}
            onExportError={mockOnExportError}
          />
          <button>Other Button</button>
        </div>
      )

      const exportButton = screen.getByText('Export as TXT')
      const otherButton = screen.getByText('Other Button')
      
      await user.click(exportButton)
      
      // UI should still be responsive
      expect(screen.getByText('Exporting...')).toBeInTheDocument()
      expect(otherButton).not.toBeDisabled()
      
      await waitFor(() => {
        expect(screen.getByText('Export as TXT')).toBeInTheDocument()
      })
    })
  })
})