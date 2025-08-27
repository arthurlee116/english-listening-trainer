/**
 * 增强的前端操作Hook
 * 提供统一的错误处理、状态管理、操作取消等功能
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

// 操作状态类型
export enum OperationState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

// 操作配置
export interface OperationConfig {
  timeout?: number
  retries?: number
  retryDelay?: number
  showSuccessToast?: boolean
  showErrorToast?: boolean
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
  onCancel?: () => void
}

// 操作结果
export interface OperationResult<T> {
  data?: T
  error?: Error
  state: OperationState
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  isCancelled: boolean
  attempt: number
  totalTime: number
}

// 操作控制器
class OperationController {
  private abortController: AbortController
  private timeoutId: NodeJS.Timeout | null = null
  private startTime: number
  private onCancel?: () => void

  constructor(timeout?: number, onCancel?: () => void) {
    this.abortController = new AbortController()
    this.startTime = Date.now()
    this.onCancel = onCancel

    if (timeout) {
      this.timeoutId = setTimeout(() => {
        this.cancel('timeout')
      }, timeout)
    }
  }

  get signal(): AbortSignal {
    return this.abortController.signal
  }

  get isAborted(): boolean {
    return this.abortController.signal.aborted
  }

  get elapsedTime(): number {
    return Date.now() - this.startTime
  }

  cancel(reason?: string): void {
    if (!this.isAborted) {
      this.abortController.abort(reason)
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
      this.onCancel?.()
    }
  }

  cleanup(): void {
    this.cancel()
  }
}

// 错误类型
export class OperationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly retryable: boolean = true,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'OperationError'
  }
}

// 重试逻辑
async function withRetries<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  controller: OperationController,
  retries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    if (controller.isAborted) {
      throw new OperationError('Operation cancelled', 'CANCELLED', false)
    }

    try {
      const result = await operation(controller.signal, attempt)
      return result
    } catch (error) {
      lastError = error as Error
      
      // 检查是否应该重试
      const shouldRetry = attempt <= retries && 
        !controller.isAborted && 
        isRetryableError(error as Error)

      if (!shouldRetry) {
        break
      }

      // 等待重试延迟
      if (attempt <= retries) {
        const delay = retryDelay * Math.pow(2, attempt - 1) // 指数退避
        await sleep(delay, controller.signal)
      }
    }
  }

  throw lastError || new OperationError('Operation failed')
}

// 判断错误是否可重试
function isRetryableError(error: Error): boolean {
  if (error instanceof OperationError) {
    return error.retryable
  }

  const retryableMessages = [
    'network error',
    'timeout',
    'service unavailable',
    'server error',
    'connection refused',
    'fetch failed'
  ]

  const errorMessage = error.message.toLowerCase()
  return retryableMessages.some(msg => errorMessage.includes(msg))
}

// Sleep 函数，支持取消
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new OperationError('Sleep cancelled', 'CANCELLED', false))
      return
    }

    const timeoutId = setTimeout(resolve, ms)
    
    const abortHandler = () => {
      clearTimeout(timeoutId)
      reject(new OperationError('Sleep cancelled', 'CANCELLED', false))
    }

    signal?.addEventListener('abort', abortHandler, { once: true })
  })
}

// 增强操作Hook
export function useEnhancedOperation<T, TArgs extends any[]>(
  operation: (signal: AbortSignal, attempt: number, ...args: TArgs) => Promise<T>,
  config: OperationConfig = {}
) {
  const [state, setState] = useState<OperationState>(OperationState.IDLE)
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  
  const controllerRef = useRef<OperationController | null>(null)
  const { toast } = useToast()

  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    showSuccessToast = false,
    showErrorToast = true,
    onSuccess,
    onError,
    onCancel
  } = config

  // 清理函数
  const cleanup = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.cleanup()
      controllerRef.current = null
    }
  }, [])

  // 执行操作
  const execute = useCallback(async (...args: TArgs): Promise<T | undefined> => {
    // 取消之前的操作
    cleanup()

    setState(OperationState.LOADING)
    setError(undefined)
    setData(undefined)
    setAttempt(0)
    setTotalTime(0)

    // 创建新的控制器
    controllerRef.current = new OperationController(timeout, onCancel)
    const controller = controllerRef.current

    try {
      // 包装操作以传递参数
      const wrappedOperation = (signal: AbortSignal, attemptNum: number) => {
        setAttempt(attemptNum)
        return operation(signal, attemptNum, ...args)
      }

      const result = await withRetries(
        wrappedOperation,
        controller,
        retries,
        retryDelay
      )

      if (!controller.isAborted) {
        setData(result)
        setState(OperationState.SUCCESS)
        setTotalTime(controller.elapsedTime)

        if (showSuccessToast) {
          toast({
            title: "操作成功",
            description: "操作已成功完成",
          })
        }

        onSuccess?.(result)
        return result
      }
    } catch (err) {
      const operationError = err as Error
      
      if (controller.isAborted) {
        setState(OperationState.CANCELLED)
        setTotalTime(controller.elapsedTime)
        
        if (operationError.message !== 'Operation cancelled') {
          toast({
            title: "操作已取消",
            description: "操作被用户或系统取消",
            variant: "destructive",
          })
        }
      } else {
        setState(OperationState.ERROR)
        setError(operationError)
        setTotalTime(controller.elapsedTime)

        if (showErrorToast) {
          toast({
            title: "操作失败",
            description: getErrorMessage(operationError),
            variant: "destructive",
          })
        }

        onError?.(operationError)
      }
    } finally {
      controllerRef.current = null
    }

    return undefined
  }, [operation, timeout, retries, retryDelay, showSuccessToast, showErrorToast, onSuccess, onError, onCancel, cleanup, toast])

  // 取消操作
  const cancel = useCallback((reason?: string) => {
    if (controllerRef.current) {
      controllerRef.current.cancel(reason)
    }
  }, [])

  // 重置状态
  const reset = useCallback(() => {
    cleanup()
    setState(OperationState.IDLE)
    setData(undefined)
    setError(undefined)
    setAttempt(0)
    setTotalTime(0)
  }, [cleanup])

  // 组件卸载时清理
  useEffect(() => {
    return cleanup
  }, [cleanup])

  const result: OperationResult<T> = {
    data,
    error,
    state,
    isLoading: state === OperationState.LOADING,
    isSuccess: state === OperationState.SUCCESS,
    isError: state === OperationState.ERROR,
    isCancelled: state === OperationState.CANCELLED,
    attempt,
    totalTime
  }

  return {
    ...result,
    execute,
    cancel,
    reset
  }
}

// 获取用户友好的错误消息
function getErrorMessage(error: Error): string {
  if (error instanceof OperationError) {
    switch (error.code) {
      case 'TIMEOUT':
        return '操作超时，请重试'
      case 'NETWORK_ERROR':
        return '网络连接异常，请检查网络后重试'
      case 'SERVICE_UNAVAILABLE':
        return '服务暂时不可用，请稍后重试'
      case 'VALIDATION_ERROR':
        return '输入数据有误，请检查后重试'
      case 'RATE_LIMIT':
        return '操作过于频繁，请稍后重试'
      default:
        return error.message
    }
  }

  const message = error.message.toLowerCase()
  
  if (message.includes('timeout')) {
    return '操作超时，请重试'
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return '网络连接异常，请检查网络后重试'
  }
  
  if (message.includes('not found')) {
    return '资源未找到'
  }
  
  if (message.includes('unauthorized')) {
    return '认证失败，请重新登录'
  }
  
  if (message.includes('forbidden')) {
    return '权限不足'
  }

  return error.message || '未知错误'
}

// 批量操作Hook
export function useBatchOperation<T, R>(
  operation: (item: T, signal: AbortSignal) => Promise<R>,
  config: OperationConfig & {
    batchSize?: number
    concurrency?: number
    onItemSuccess?: (result: R, item: T, index: number) => void
    onItemError?: (error: Error, item: T, index: number) => void
  } = {}
) {
  const [state, setState] = useState<OperationState>(OperationState.IDLE)
  const [results, setResults] = useState<(R | Error)[]>([])
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [currentBatch, setCurrentBatch] = useState(0)
  
  const controllerRef = useRef<OperationController | null>(null)
  const { toast } = useToast()

  const {
    batchSize = 10,
    concurrency = 3,
    onItemSuccess,
    onItemError,
    timeout = 60000,
    showSuccessToast = true,
    showErrorToast = true
  } = config

  const execute = useCallback(async (items: T[]): Promise<(R | Error)[]> => {
    if (items.length === 0) return []

    setState(OperationState.LOADING)
    setResults([])
    setProgress({ completed: 0, total: items.length })
    setCurrentBatch(0)

    controllerRef.current = new OperationController(timeout)
    const controller = controllerRef.current

    const allResults: (R | Error)[] = new Array(items.length)
    let completedItems = 0

    try {
      // 分批处理
      const batches = []
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize))
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (controller.isAborted) break

        setCurrentBatch(batchIndex + 1)
        const batch = batches[batchIndex]
        const batchStartIndex = batchIndex * batchSize

        // 并发处理批次内的项目
        const batchPromises = batch.map(async (item, localIndex) => {
          const globalIndex = batchStartIndex + localIndex
          
          try {
            const result = await operation(item, controller.signal)
            allResults[globalIndex] = result
            onItemSuccess?.(result, item, globalIndex)
          } catch (error) {
            const operationError = error as Error
            allResults[globalIndex] = operationError
            onItemError?.(operationError, item, globalIndex)
          }

          completedItems++
          setProgress({ completed: completedItems, total: items.length })
        })

        // 控制并发数量
        const chunks = []
        for (let i = 0; i < batchPromises.length; i += concurrency) {
          chunks.push(batchPromises.slice(i, i + concurrency))
        }

        for (const chunk of chunks) {
          if (controller.isAborted) break
          await Promise.all(chunk)
        }
      }

      setResults(allResults)
      setState(OperationState.SUCCESS)

      if (showSuccessToast) {
        const successCount = allResults.filter(r => !(r instanceof Error)).length
        const errorCount = allResults.length - successCount
        
        toast({
          title: "批量操作完成",
          description: `成功: ${successCount}, 失败: ${errorCount}`,
        })
      }

      return allResults
    } catch (error) {
      setState(OperationState.ERROR)
      
      if (showErrorToast) {
        toast({
          title: "批量操作失败",
          description: getErrorMessage(error as Error),
          variant: "destructive",
        })
      }

      throw error
    }
  }, [operation, batchSize, concurrency, timeout, onItemSuccess, onItemError, showSuccessToast, showErrorToast, toast])

  const cancel = useCallback(() => {
    controllerRef.current?.cancel()
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.cleanup()
    controllerRef.current = null
    setState(OperationState.IDLE)
    setResults([])
    setProgress({ completed: 0, total: 0 })
    setCurrentBatch(0)
  }, [])

  return {
    state,
    results,
    progress,
    currentBatch,
    isLoading: state === OperationState.LOADING,
    isSuccess: state === OperationState.SUCCESS,
    isError: state === OperationState.ERROR,
    execute,
    cancel,
    reset
  }
}

// 缓存操作Hook
export function useCachedOperation<T>(
  key: string,
  operation: (signal: AbortSignal) => Promise<T>,
  config: OperationConfig & {
    cacheTime?: number
    staleTime?: number
  } = {}
) {
  const [cache, setCache] = useState<Map<string, {
    data: T
    timestamp: number
    isStale: boolean
  }>>(new Map())

  const { cacheTime = 300000, staleTime = 60000 } = config // 5分钟缓存，1分钟过期

  const enhancedOperation = useEnhancedOperation(
    async (signal: AbortSignal) => {
      const cached = cache.get(key)
      const now = Date.now()

      // 如果有有效缓存且未过期，直接返回
      if (cached && (now - cached.timestamp) < cacheTime) {
        // 标记为过期但仍返回缓存数据
        if ((now - cached.timestamp) > staleTime && !cached.isStale) {
          setCache(prev => {
            const newCache = new Map(prev)
            const entry = newCache.get(key)
            if (entry) {
              entry.isStale = true
              newCache.set(key, entry)
            }
            return newCache
          })
        }
        return cached.data
      }

      // 执行操作获取新数据
      const result = await operation(signal)

      // 更新缓存
      setCache(prev => {
        const newCache = new Map(prev)
        newCache.set(key, {
          data: result,
          timestamp: now,
          isStale: false
        })
        return newCache
      })

      return result
    },
    config
  )

  const invalidateCache = useCallback(() => {
    setCache(prev => {
      const newCache = new Map(prev)
      newCache.delete(key)
      return newCache
    })
  }, [key])

  const getCachedData = useCallback(() => {
    return cache.get(key)
  }, [cache, key])

  return {
    ...enhancedOperation,
    invalidateCache,
    getCachedData,
    isCached: cache.has(key),
    isStale: cache.get(key)?.isStale || false
  }
}
