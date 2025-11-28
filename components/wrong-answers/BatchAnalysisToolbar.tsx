"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Loader2, Zap, AlertTriangle, X, Download } from "lucide-react"
import type { QueueStatus, BatchResult } from "@/lib/concurrency-service"

interface BatchAnalysisToolbarProps {
  itemsNeedingAnalysisCount: number
  batchStatus: QueueStatus
  batchResult: BatchResult<any> | null
  error?: string | null
  isProcessing: boolean
  progress: number
  onStartBatch: () => void
  onCancel: () => void
  onRetryFailed: () => void
  concurrencyLabel: string
  onExport: () => void
  exporting: boolean
  isExportDisabled: boolean
}

export default function BatchAnalysisToolbar({
  itemsNeedingAnalysisCount,
  batchStatus,
  batchResult,
  error,
  isProcessing,
  progress,
  onStartBatch,
  onCancel,
  onRetryFailed,
  concurrencyLabel,
  onExport,
  exporting,
  isExportDisabled,
}: BatchAnalysisToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <BilingualText
            translationKey="components.wrongAnswersBook.batchAnalysis.itemsNeedingAnalysis"
            values={{ count: itemsNeedingAnalysisCount }}
          />
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="w-32" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {batchStatus.completed + batchStatus.failed}/{batchStatus.total}
            </span>
            <div className="text-xs text-gray-500">Active: {batchStatus.active}</div>
          </div>
        )}

        {batchResult && (
          <div className="text-sm">
            <span className="text-green-600 dark:text-green-400">
              <BilingualText
                translationKey="components.wrongAnswersBook.batchAnalysis.successCount"
                values={{ count: batchResult.success.length }}
              />
            </span>
            {batchResult.failed.length > 0 && (
              <span className="text-red-600 dark:text-red-400 ml-2">
                <BilingualText
                  translationKey="components.wrongAnswersBook.batchAnalysis.failedCount"
                  values={{ count: batchResult.failed.length }}
                />
              </span>
            )}
          </div>
        )}

        {error && <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>}
      </div>

      <div className="flex items-center gap-2">
        {itemsNeedingAnalysisCount > 0 && !isProcessing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isProcessing}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.generateAll" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.confirmTitle" />
                  </div>
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      <BilingualText
                        translationKey="components.wrongAnswersBook.batchAnalysis.confirmDescription"
                        values={{ count: itemsNeedingAnalysisCount }}
                      />
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.processingWarning" />
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Concurrency limit: {concurrencyLabel}</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <BilingualText translationKey="common.buttons.cancel" />
                </AlertDialogCancel>
                <AlertDialogAction onClick={onStartBatch}>
                  <Zap className="w-4 h-4 mr-2" />
                  <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.startProcessing" />
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isProcessing && (
          <Button variant="outline" size="sm" onClick={onCancel} className="text-red-600 hover:text-red-700">
            <X className="w-4 h-4 mr-2" />
            Cancel Processing
          </Button>
        )}

        {batchResult && batchResult.failed.length > 0 && (
          <Button variant="outline" size="sm" onClick={onRetryFailed}>
            <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.retryFailed" />
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onExport}
          disabled={exporting || isExportDisabled}
          className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white border-0"
        >
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          <BilingualText translationKey="components.wrongAnswersBook.export.exportAsTxt" />
        </Button>
      </div>
    </div>
  )
}
