import pLimit from 'p-limit'

export interface ConcurrencyConfig {
  maxConcurrent: number
  retryAttempts: number
  retryDelay: number
  timeout?: number
}

export interface QueueStatus {
  pending: number
  active: number
  completed: number
  failed: number
  total: number
}

export interface BatchResult<T, TInput = unknown> {
  success: T[]
  failed: Array<{ item: TInput; error: string }>
  status: QueueStatus
}

export class ConcurrencyService {
  private limit: ReturnType<typeof pLimit>
  private config: ConcurrencyConfig
  private status: QueueStatus = {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    total: 0
  }
  private statusCallbacks: Array<(status: QueueStatus) => void> = []

  constructor(config: ConcurrencyConfig) {
    this.config = config
    this.limit = pLimit(config.maxConcurrent)
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(callback: (status: QueueStatus) => void): () => void {
    this.statusCallbacks.push(callback)
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index > -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Update status and notify subscribers
   */
  private updateStatus(updates: Partial<QueueStatus>) {
    this.status = { ...this.status, ...updates }
    this.statusCallbacks.forEach(callback => callback({ ...this.status }))
  }

  /**
   * Reset status counters
   */
  private resetStatus(total: number) {
    this.status = {
      pending: total,
      active: 0,
      completed: 0,
      failed: 0,
      total
    }
    this.updateStatus({})
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeWithRetry<T>(
    task: () => Promise<T>,
    _item: unknown,
    retryCount = 0
  ): Promise<T> {
    try {
      // Update active count
      this.updateStatus({
        pending: this.status.pending - 1,
        active: this.status.active + 1
      })

      let result: T
      
      if (this.config.timeout) {
        // Execute with timeout
        result = await Promise.race([
          task(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), this.config.timeout)
          )
        ])
      } else {
        result = await task()
      }

      // Update completed count
      this.updateStatus({
        active: this.status.active - 1,
        completed: this.status.completed + 1
      })

      return result
    } catch (error) {
      // Update active count
      this.updateStatus({
        active: this.status.active - 1
      })

      if (retryCount < this.config.retryAttempts) {
        // Wait before retry with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // Retry with incremented count
        return this.executeWithRetry(task, _item, retryCount + 1)
      } else {
        // Update failed count
        this.updateStatus({
          failed: this.status.failed + 1
        })
        throw error
      }
    }
  }

  /**
   * Process items in batches with concurrency control
   */
  async processBatch<TInput, TOutput>(
    items: TInput[],
    processor: (item: TInput) => Promise<TOutput>
  ): Promise<BatchResult<TOutput>> {
    if (items.length === 0) {
      return {
        success: [],
        failed: [],
        status: { pending: 0, active: 0, completed: 0, failed: 0, total: 0 }
      }
    }

    // Reset status for new batch
    this.resetStatus(items.length)

    const results: TOutput[] = []
    const failures: Array<{ item: TInput; error: string }> = []

    // Create limited tasks
    const tasks = items.map(item =>
      this.limit(() => this.executeWithRetry(() => processor(item), item))
    )

    // Execute all tasks and collect results
    const settledResults = await Promise.allSettled(tasks)

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        failures.push({
          item: items[index],
          error: result.reason?.message || 'Unknown error'
        })
      }
    })

    return {
      success: results,
      failed: failures,
      status: { ...this.status }
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): QueueStatus {
    return { ...this.status }
  }

  /**
   * Check if processing is active
   */
  isProcessing(): boolean {
    return this.status.active > 0 || this.status.pending > 0
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgress(): number {
    if (this.status.total === 0) return 0
    return Math.round(((this.status.completed + this.status.failed) / this.status.total) * 100)
  }

  /**
   * Clear the queue (for emergency stop)
   */
  clear(): void {
    this.limit.clearQueue()
    this.resetStatus(0)
  }
}

// Default configurations for different use cases
export const ConcurrencyConfigs = {
  // For AI analysis requests - conservative to avoid rate limiting
  AI_ANALYSIS: {
    maxConcurrent: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000 // 30 seconds
  } as ConcurrencyConfig,

  // For batch processing - more aggressive
  BATCH_PROCESSING: {
    maxConcurrent: 20,
    retryAttempts: 2,
    retryDelay: 500,
    timeout: 15000 // 15 seconds
  } as ConcurrencyConfig,

  // For high-volume operations
  HIGH_VOLUME: {
    maxConcurrent: 50,
    retryAttempts: 1,
    retryDelay: 200,
    timeout: 10000 // 10 seconds
  } as ConcurrencyConfig
}

// Singleton instance for AI analysis
export const aiAnalysisConcurrency = new ConcurrencyService(ConcurrencyConfigs.AI_ANALYSIS)

// Backwards compatibility helper used by legacy tests/utilities
export async function processConcurrently<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => Promise<TOutput>,
  config: ConcurrencyConfig = ConcurrencyConfigs.AI_ANALYSIS
): Promise<BatchResult<TOutput>> {
  const service = new ConcurrencyService(config)
  return service.processBatch(items, processor)
}
