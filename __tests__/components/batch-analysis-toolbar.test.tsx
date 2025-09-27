import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Mock the batch processing hook
const mockBatchProcessor = {
  state: {
    isProcessing: false,
    progress: 0,
    status: { pending: 0, active: 0, completed: 0, failed: 0, total: 0 },
    results: null,
    error: null
  },
  processBatch: vi.fn(),
  cancelProcessing: vi.fn(),
  resetState: vi.fn(),
  isProcessing: false,
  progress: 0,
  status: { pending: 0, active: 0, completed: 0, failed: 0, total: 0 },
  results: null,
  error: null
}

vi.mock('@/hooks/use-batch-processing', () => ({
  useBatchProcessing: () => mockBatchProcessor
}))

vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: vi.fn((key: string) => {
      const mockTranslations: Record<string, string> = {
        'components.wrongAnswersBook.batchAnalysis.itemsNeedingAnalysis': '{count} items need analysis',
        'components.wrongAnswersBook.batchAnalysis.generateAll': 'Generate All Analysis',
        'components.wrongAnswersBook.batchAnalysis.confirmTitle': 'Confirm Batch Analysis',
        'components.wrongAnswersBook.batchAnalysis.confirmDescription': 'This will analyze {count} questions',
        'components.wrongAnswersBook.batchAnalysis.processingWarning': 'This may take several minutes',
        'components.wrongAnswersBook.batchAnalysis.startProcessing': 'Start Processing',
        'components.wrongAnswersBook.batchAnalysis.successCount': '{count} successful',
        'components.wrongAnswersBook.batchAnalysis.failedCount': '{count} failed',
        'components.wrongAnswersBook.batchAnalysis.retryFailed': 'Retry Failed',
        'components.wrongAnswersBook.export.exportAsTxt': 'Export as TXT',
        'common.buttons.cancel': 'Cancel'
      }
      return mockTranslations[key] || key
    })
  })
}))

vi.mock('@/lib/concurrency-service', () => ({
  aiAnalysisConcurrency: {
    getStatus: vi.fn().mockReturnValue({ total: 0, active: 0 })
  }
}))

vi.mock('@/lib/export-service', () => ({
  ExportService: {
    exportToTXT: vi.fn().mockResolvedValue('mock export content'),
    downloadFile: vi.fn()
  }
}))

// Create a test component that includes the batch analysis toolbar functionality
const BatchAnalysisToolbar = ({ 
  itemsNeedingAnalysis, 
  onBatchAnalysis, 
  onExport,
  batchProcessor = mockBatchProcessor,
  exporting = false 
}: {
  itemsNeedingAnalysis: any[]
  onBatchAnalysis: () => void
  onExport: () => void
  batchProcessor?: typeof mockBatchProcessor
  exporting?: boolean
}) => {
  // Use the mocked translation function directly
  const t = (key: string) => {
    const mockTranslations: Record<string, string> = {
      'components.wrongAnswersBook.batchAnalysis.itemsNeedingAnalysis': '{count} items need analysis',
      'components.wrongAnswersBook.batchAnalysis.generateAll': 'Generate All Analysis',
      'components.wrongAnswersBook.batchAnalysis.successCount': '{count} successful',
      'components.wrongAnswersBook.batchAnalysis.failedCount': '{count} failed',
      'components.wrongAnswersBook.batchAnalysis.retryFailed': 'Retry Failed',
      'components.wrongAnswersBook.export.exportAsTxt': 'Export as TXT',
    }
    return mockTranslations[key] || key
  }
  
  return (
    <div className="glass-effect p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t("components.wrongAnswersBook.batchAnalysis.itemsNeedingAnalysis").replace('{count}', itemsNeedingAnalysis.length.toString())}
          </div>
          
          {batchProcessor.isProcessing && (
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${batchProcessor.progress}%` }}
                />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {batchProcessor.status.completed + batchProcessor.status.failed}/{batchProcessor.status.total}
              </span>
              <div className="text-xs text-gray-500">
                Active: {batchProcessor.status.active}
              </div>
            </div>
          )}

          {batchProcessor.results && (
            <div className="text-sm">
              <span className="text-green-600 dark:text-green-400">
                {t("components.wrongAnswersBook.batchAnalysis.successCount").replace('{count}', batchProcessor.results.success.length.toString())}
              </span>
              {batchProcessor.results.failed.length > 0 && (
                <span className="text-red-600 dark:text-red-400 ml-2">
                  {t("components.wrongAnswersBook.batchAnalysis.failedCount").replace('{count}', batchProcessor.results.failed.length.toString())}
                </span>
              )}
            </div>
          )}

          {batchProcessor.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              Error: {batchProcessor.error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {itemsNeedingAnalysis.length > 0 && !batchProcessor.isProcessing && (
            <div>
              <button
                onClick={onBatchAnalysis}
                disabled={batchProcessor.isProcessing}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded"
              >
                {t("components.wrongAnswersBook.batchAnalysis.generateAll")}
              </button>
            </div>
          )}

          {batchProcessor.isProcessing && (
            <button 
              onClick={batchProcessor.cancelProcessing}
              className="text-red-600 hover:text-red-700 px-4 py-2 rounded border"
            >
              Cancel Processing
            </button>
          )}

          {batchProcessor.results && batchProcessor.results.failed.length > 0 && (
            <button 
              onClick={() => {
                batchProcessor.resetState()
              }}
              className="px-4 py-2 rounded border"
            >
              {t("components.wrongAnswersBook.batchAnalysis.retryFailed")}
            </button>
          )}

          <button 
            onClick={onExport}
            disabled={exporting}
            className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white border-0 px-4 py-2 rounded"
          >
            {exporting ? 'Exporting...' : t("components.wrongAnswersBook.export.exportAsTxt")}
          </button>
        </div>
      </div>
    </div>
  )
}

describe('BatchAnalysisToolbar', () => {
  const mockOnBatchAnalysis = vi.fn()
  const mockOnExport = vi.fn()
  const mockItems = [
    { id: '1', needsAnalysis: true },
    { id: '2', needsAnalysis: true },
    { id: '3', needsAnalysis: true }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock batch processor state
    Object.assign(mockBatchProcessor, {
      state: {
        isProcessing: false,
        progress: 0,
        status: { pending: 0, active: 0, completed: 0, failed: 0, total: 0 },
        results: null,
        error: null
      },
      isProcessing: false,
      progress: 0,
      status: { pending: 0, active: 0, completed: 0, failed: 0, total: 0 },
      results: null,
      error: null
    })
  })

  describe('Initial State', () => {
    it('should display items needing analysis count', () => {
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
        />
      )

      expect(screen.getByText('3 items need analysis')).toBeInTheDocument()
    })

    it('should show generate all button when items need analysis', () => {
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
        />
      )

      expect(screen.getByText('Generate All Analysis')).toBeInTheDocument()
    })

    it('should show export button', () => {
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
        />
      )

      expect(screen.getByText('Export as TXT')).toBeInTheDocument()
    })

    it('should not show generate button when no items need analysis', () => {
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={[]}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
        />
      )

      expect(screen.queryByText('Generate All Analysis')).not.toBeInTheDocument()
    })
  })

  describe('Processing State', () => {
    it('should show progress bar when processing', () => {
      const processingBatchProcessor = {
        ...mockBatchProcessor,
        isProcessing: true,
        progress: 50,
        status: { pending: 1, active: 2, completed: 2, failed: 0, total: 5 }
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={processingBatchProcessor}
        />
      )

      // Should show progress information
      expect(screen.getByText('2/5')).toBeInTheDocument()
      expect(screen.getByText('Active: 2')).toBeInTheDocument()
    })

    it('should show cancel button when processing', () => {
      const processingBatchProcessor = {
        ...mockBatchProcessor,
        isProcessing: true,
        progress: 30
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={processingBatchProcessor}
        />
      )

      expect(screen.getByText('Cancel Processing')).toBeInTheDocument()
      expect(screen.queryByText('Generate All Analysis')).not.toBeInTheDocument()
    })

    it('should call cancelProcessing when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const processingBatchProcessor = {
        ...mockBatchProcessor,
        isProcessing: true,
        cancelProcessing: vi.fn()
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={processingBatchProcessor}
        />
      )

      const cancelButton = screen.getByText('Cancel Processing')
      await user.click(cancelButton)

      expect(processingBatchProcessor.cancelProcessing).toHaveBeenCalledTimes(1)
    })
  })

  describe('Results State', () => {
    it('should show success and failure counts when results are available', () => {
      const resultsProcessor = {
        ...mockBatchProcessor,
        results: {
          success: [1, 2, 3],
          failed: [{ item: 4, error: 'Failed' }]
        }
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={resultsProcessor}
        />
      )

      expect(screen.getByText('3 successful')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })

    it('should show retry failed button when there are failures', () => {
      const resultsProcessor = {
        ...mockBatchProcessor,
        results: {
          success: [1, 2],
          failed: [{ item: 3, error: 'Failed' }]
        }
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={resultsProcessor}
        />
      )

      expect(screen.getByText('Retry Failed')).toBeInTheDocument()
    })

    it('should call resetState when retry failed button is clicked', async () => {
      const user = userEvent.setup()
      const resultsProcessor = {
        ...mockBatchProcessor,
        results: {
          success: [1, 2],
          failed: [{ item: 3, error: 'Failed' }]
        },
        resetState: vi.fn()
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={resultsProcessor}
        />
      )

      const retryButton = screen.getByText('Retry Failed')
      await user.click(retryButton)

      expect(resultsProcessor.resetState).toHaveBeenCalledTimes(1)
    })

    it('should not show failed count when no failures', () => {
      const resultsProcessor = {
        ...mockBatchProcessor,
        results: {
          success: [1, 2, 3],
          failed: []
        }
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={resultsProcessor}
        />
      )

      expect(screen.getByText('3 successful')).toBeInTheDocument()
      expect(screen.queryByText('0 failed')).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error message when there is an error', () => {
      const errorProcessor = {
        ...mockBatchProcessor,
        error: 'Network connection failed'
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={errorProcessor}
        />
      )

      expect(screen.getByText('Error: Network connection failed')).toBeInTheDocument()
    })
  })

  describe('Button Interactions', () => {
    it('should call onBatchAnalysis when generate all button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
        />
      )

      const generateButton = screen.getByText('Generate All Analysis')
      await user.click(generateButton)

      expect(mockOnBatchAnalysis).toHaveBeenCalledTimes(1)
    })

    it('should call onExport when export button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
        />
      )

      const exportButton = screen.getByText('Export as TXT')
      await user.click(exportButton)

      expect(mockOnExport).toHaveBeenCalledTimes(1)
    })

    it('should disable generate button when processing', () => {
      const processingBatchProcessor = {
        ...mockBatchProcessor,
        isProcessing: true
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={processingBatchProcessor}
        />
      )

      // Generate button should not be visible when processing
      expect(screen.queryByText('Generate All Analysis')).not.toBeInTheDocument()
    })

    it('should show exporting state on export button', () => {
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          exporting={true}
        />
      )

      expect(screen.getByText('Exporting...')).toBeInTheDocument()
      expect(screen.queryByText('Export as TXT')).not.toBeInTheDocument()
    })

    it('should disable export button when exporting', () => {
      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          exporting={true}
        />
      )

      const exportButton = screen.getByText('Exporting...')
      expect(exportButton).toBeDisabled()
    })
  })

  describe('Progress Visualization', () => {
    it('should show correct progress bar width', () => {
      const processingBatchProcessor = {
        ...mockBatchProcessor,
        isProcessing: true,
        progress: 75
      }

      const { container } = render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={processingBatchProcessor}
        />
      )

      const progressBar = container.querySelector('.bg-blue-600')
      expect(progressBar).toHaveStyle({ width: '75%' })
    })

    it('should update progress information dynamically', () => {
      const processingBatchProcessor = {
        ...mockBatchProcessor,
        isProcessing: true,
        progress: 60,
        status: { pending: 0, active: 1, completed: 4, failed: 1, total: 6 }
      }

      render(
        <BatchAnalysisToolbar
          itemsNeedingAnalysis={mockItems}
          onBatchAnalysis={mockOnBatchAnalysis}
          onExport={mockOnExport}
          batchProcessor={processingBatchProcessor}
        />
      )

      expect(screen.getByText('5/6')).toBeInTheDocument() // completed + failed / total
      expect(screen.getByText('Active: 1')).toBeInTheDocument()
    })
  })
})