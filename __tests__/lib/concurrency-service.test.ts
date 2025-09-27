import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConcurrencyService, ConcurrencyConfigs } from '@/lib/concurrency-service'

describe('ConcurrencyService', () => {
  let service: ConcurrencyService

  beforeEach(() => {
    service = new ConcurrencyService(ConcurrencyConfigs.AI_ANALYSIS)
  })

  it('should process items with concurrency limit', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const processor = vi.fn().mockImplementation(async (item: number) => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return item * 2
    })

    const result = await service.processBatch(items, processor)

    expect(result.success).toHaveLength(20)
    expect(result.failed).toHaveLength(0)
    expect(result.success).toEqual(items.map(i => i * 2))
    expect(processor).toHaveBeenCalledTimes(20)
  })

  it('should handle failures and retries', async () => {
    const items = [1, 2, 3]
    const callCounts = new Map<number, number>()
    
    const processor = vi.fn().mockImplementation(async (item: number) => {
      const count = (callCounts.get(item) || 0) + 1
      callCounts.set(item, count)
      
      // Make item 2 fail on first attempt only
      if (item === 2 && count === 1) {
        throw new Error('Temporary failure')
      }
      return item * 2
    })

    const result = await service.processBatch(items, processor)

    expect(result.success).toHaveLength(3)
    expect(result.failed).toHaveLength(0)
    // Should be called 4 times: 1 (success), 2 (fail), 2 (retry success), 3 (success)
    expect(processor).toHaveBeenCalledTimes(4)
  })

  it('should track progress correctly', async () => {
    const items = Array.from({ length: 5 }, (_, i) => i)
    const statusUpdates: any[] = []
    
    service.onStatusUpdate((status) => {
      statusUpdates.push({ ...status })
    })

    const processor = vi.fn().mockImplementation(async (item: number) => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return item * 2
    })

    await service.processBatch(items, processor)

    expect(statusUpdates.length).toBeGreaterThan(0)
    expect(statusUpdates[statusUpdates.length - 1].completed).toBe(5)
    expect(statusUpdates[statusUpdates.length - 1].failed).toBe(0)
  })

  it('should handle timeout correctly', async () => {
    const timeoutService = new ConcurrencyService({
      maxConcurrent: 1,
      retryAttempts: 0,
      retryDelay: 100,
      timeout: 50
    })

    const items = [1]
    const processor = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return 'success'
    })

    const result = await timeoutService.processBatch(items, processor)

    expect(result.success).toHaveLength(0)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].error).toContain('timeout')
  })

  it('should provide correct progress percentage', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    let progressValues: number[] = []
    
    service.onStatusUpdate(() => {
      progressValues.push(service.getProgress())
    })

    const processor = vi.fn().mockImplementation(async (item: number) => {
      await new Promise(resolve => setTimeout(resolve, 5))
      return item
    })

    await service.processBatch(items, processor)

    expect(progressValues[progressValues.length - 1]).toBe(100)
  })
})