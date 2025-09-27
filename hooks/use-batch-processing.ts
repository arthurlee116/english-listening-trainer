import { useState, useCallback, useRef } from 'react'
import { ConcurrencyService, QueueStatus, BatchResult } from '@/lib/concurrency-service'

export interface BatchProcessingState {
  isProcessing: boolean
  progress: number
  status: QueueStatus
  results: BatchResult<any> | null
  error: string | null
}

export interface BatchProcessingOptions {
  onProgress?: (status: QueueStatus) => void
  onComplete?: (results: BatchResult<any>) => void
  onError?: (error: string) => void
}

export function useBatchProcessing(concurrencyService: ConcurrencyService) {
  const [state, setState] = useState<BatchProcessingState>({
    isProcessing: false,
    progress: 0,
    status: {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0
    },
    results: null,
    error: null
  })

  const optionsRef = useRef<BatchProcessingOptions>({})
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const updateState = useCallback((updates: Partial<BatchProcessingState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const processBatch = useCallback(async <TInput, TOutput>(
    items: TInput[],
    processor: (item: TInput) => Promise<TOutput>,
    options: BatchProcessingOptions = {}
  ): Promise<BatchResult<TOutput>> => {
    // Store options for callbacks
    optionsRef.current = options

    try {
      // Reset state
      updateState({
        isProcessing: true,
        progress: 0,
        results: null,
        error: null,
        status: {
          pending: items.length,
          active: 0,
          completed: 0,
          failed: 0,
          total: items.length
        }
      })

      // Subscribe to status updates
      unsubscribeRef.current = concurrencyService.onStatusUpdate((status) => {
        const progress = concurrencyService.getProgress()
        
        updateState({
          status,
          progress
        })

        // Call progress callback
        if (options.onProgress) {
          options.onProgress(status)
        }
      })

      // Process the batch
      const results = await concurrencyService.processBatch(items, processor)

      // Update final state
      updateState({
        isProcessing: false,
        results,
        progress: 100
      })

      // Call completion callback
      if (options.onComplete) {
        options.onComplete(results)
      }

      return results

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      updateState({
        isProcessing: false,
        error: errorMessage,
        progress: 0
      })

      // Call error callback
      if (options.onError) {
        options.onError(errorMessage)
      }

      throw error

    } finally {
      // Cleanup subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [concurrencyService, updateState])

  const cancelProcessing = useCallback(() => {
    concurrencyService.clear()
    
    updateState({
      isProcessing: false,
      progress: 0,
      error: 'Processing cancelled by user'
    })

    // Cleanup subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }, [concurrencyService, updateState])

  const resetState = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      status: {
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0
      },
      results: null,
      error: null
    })
  }, [])

  return {
    state,
    processBatch,
    cancelProcessing,
    resetState,
    isProcessing: state.isProcessing,
    progress: state.progress,
    status: state.status,
    results: state.results,
    error: state.error
  }
}