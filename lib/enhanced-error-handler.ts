/**
 * 增强的错误处理工具集
 * 提供统一的错误处理、重试机制、监控和恢复策略
 */

import { NextResponse } from 'next/server'

// 错误类型定义
export enum ErrorType {
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  TTS_SERVICE = 'tts_service',
  AI_SERVICE = 'ai_service',
  NETWORK = 'network',
  RESOURCE = 'resource',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  SYSTEM = 'system'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  type: ErrorType
  severity: ErrorSeverity
  component?: string
  userId?: string
  operation?: string
  metadata?: Record<string, unknown>
}

export interface ErrorStats {
  errorCounts: Record<string, number>
  circuitBreakers: Record<string, {
    failures: number
    lastFailure: Date
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  }>
  timestamp: string
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryableErrors?: string[]
}

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'SERVICE_UNAVAILABLE'
  ]
}

// 错误监控和统计
class ErrorMonitor {
  private static instance: ErrorMonitor
  private errorCounts: Map<string, number> = new Map()
  private lastErrors: Map<string, Date> = new Map()
  private circuitBreakers: Map<string, {
    failures: number
    lastFailure: Date
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  }> = new Map()

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor()
    }
    return ErrorMonitor.instance
  }

  recordError(context: ErrorContext, error: Error): void {
    const key = `${context.type}:${context.component || 'unknown'}`
    
    // 记录错误次数
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1)
    this.lastErrors.set(key, new Date())

    // 更新熔断器状态
    this.updateCircuitBreaker(key, error)

    // 记录到控制台和日志
    this.logError(context, error)
  }

  private updateCircuitBreaker(key: string, _error: Error): void {
    const breaker = this.circuitBreakers.get(key) || {
      failures: 0,
      lastFailure: new Date(),
      state: 'CLOSED' as const
    }

    breaker.failures++
    breaker.lastFailure = new Date()

    // 如果失败次数超过阈值，打开熔断器
    if (breaker.failures >= 5 && breaker.state === 'CLOSED') {
      breaker.state = 'OPEN'
      console.warn(`🔥 Circuit breaker OPEN for ${key} - too many failures`)
    }

    // 如果是开启状态，检查是否可以半开
    if (breaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime()
      if (timeSinceLastFailure > 60000) { // 1分钟后尝试半开
        breaker.state = 'HALF_OPEN'
        console.info(`🟡 Circuit breaker HALF_OPEN for ${key} - attempting recovery`)
      }
    }

    this.circuitBreakers.set(key, breaker)
  }

  private logError(context: ErrorContext, error: Error): void {
    const logData = {
      timestamp: new Date().toISOString(),
      type: context.type,
      severity: context.severity,
      component: context.component,
      operation: context.operation,
      userId: context.userId,
      message: error.message,
      stack: error.stack,
      metadata: context.metadata
    }

    // 根据严重程度选择日志级别
    switch (context.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', logData)
        break
      case ErrorSeverity.HIGH:
        console.error('🔴 HIGH SEVERITY ERROR:', logData)
        break
      case ErrorSeverity.MEDIUM:
        console.warn('🟡 MEDIUM SEVERITY ERROR:', logData)
        break
      case ErrorSeverity.LOW:
        console.info('🔵 LOW SEVERITY ERROR:', logData)
        break
    }
  }

  isCircuitBreakerOpen(key: string): boolean {
    const breaker = this.circuitBreakers.get(key)
    return breaker?.state === 'OPEN'
  }

  recordSuccess(key: string): void {
    const breaker = this.circuitBreakers.get(key)
    if (breaker && breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED'
      breaker.failures = 0
      console.info(`✅ Circuit breaker CLOSED for ${key} - service recovered`)
    }
  }

  getErrorStats(): ErrorStats {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      timestamp: new Date().toISOString()
    }
  }
}

// 重试装饰器
export function withRetry<P extends unknown[], R>(
  fn: (...args: P) => Promise<R>,
  config: Partial<RetryConfig> = {},
  operationName?: string
): (...args: P) => Promise<R> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return async (...args: P): Promise<R> => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await fn(...args);

        // 成功时重置熔断器
        const monitor = ErrorMonitor.getInstance();
        const opName = operationName || fn.name || 'unknown_operation'
        monitor.recordSuccess(`${opName}:retry`);

        return result;
      } catch (error) {
        lastError = error as Error;

        // 检查是否应该重试
        const shouldRetry =
          attempt < retryConfig.maxAttempts &&
          isRetryableError(lastError, retryConfig.retryableErrors || []);

        if (!shouldRetry) {
          break;
        }

        // 计算延迟时间（指数退避）
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt - 1),
          retryConfig.maxDelay
        );
        const opName = operationName || fn.name || 'unknown_operation'
        console.warn(`🔄 Retry attempt ${attempt}/${retryConfig.maxAttempts} for ${opName} in ${delay}ms`);
        await sleep(delay);
      }
    }

    throw lastError!;
  };
}

// 超时装饰器
export function withTimeout<P extends unknown[], R>(
  fn: (...args: P) => Promise<R>,
  timeoutMs: number
): (...args: P) => Promise<R> {
  return async (...args: P): Promise<R> => {
    return Promise.race([
      fn(...args),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  };
}

// 错误包装器
export class AppError extends Error {
  constructor(
    message: string,
    public readonly context: ErrorContext,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'AppError'
    
    // 记录错误到监控系统
    const monitor = ErrorMonitor.getInstance()
    monitor.recordError(context, this)
  }

  toResponse(): NextResponse {
    const statusCode = this.getStatusCode()
    const userMessage = this.getUserMessage()
    
    return NextResponse.json({
      error: userMessage,
      type: this.context.type,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: this.message,
        stack: this.stack
      })
    }, { status: statusCode })
  }

  private getStatusCode(): number {
    switch (this.context.type) {
      case ErrorType.VALIDATION:
        return 400
      case ErrorType.AUTHENTICATION:
        return 401
      case ErrorType.RATE_LIMIT:
        return 429
      case ErrorType.TTS_SERVICE:
      case ErrorType.AI_SERVICE:
        return 503
      case ErrorType.DATABASE:
      case ErrorType.SYSTEM:
        return 500
      default:
        return 500
    }
  }

  private getUserMessage(): string {
    switch (this.context.type) {
      case ErrorType.VALIDATION:
        return '输入数据有误，请检查后重试'
      case ErrorType.DATABASE:
        return '数据访问失败，请稍后重试'
      case ErrorType.TTS_SERVICE:
        return '语音服务暂时不可用，请稍后重试'
      case ErrorType.AI_SERVICE:
        return 'AI服务暂时不可用，请稍后重试'
      case ErrorType.NETWORK:
        return '网络连接异常，请检查网络后重试'
      case ErrorType.RATE_LIMIT:
        return '操作过于频繁，请稍后重试'
      case ErrorType.RESOURCE:
        return '系统资源不足，请稍后重试'
      default:
        return '系统发生错误，请稍后重试'
    }
  }
}

// 工具函数
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  const errorMessage = error.message.toUpperCase()
  const errorName = error.name.toUpperCase()
  
  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError.toUpperCase()) ||
    errorName.includes(retryableError.toUpperCase())
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 操作取消器
export class OperationCanceller {
  private controllers: Map<string, AbortController> = new Map()

  createOperation(operationId: string): AbortSignal {
    // 取消之前的同类操作
    this.cancelOperation(operationId)
    
    const controller = new AbortController()
    this.controllers.set(operationId, controller)
    
    return controller.signal
  }

  cancelOperation(operationId: string): void {
    const controller = this.controllers.get(operationId)
    if (controller) {
      controller.abort()
      this.controllers.delete(operationId)
    }
  }

  cancelAllOperations(): void {
    for (const [id, controller] of this.controllers) {
      controller.abort()
    }
    this.controllers.clear()
  }

  isOperationCancelled(operationId: string): boolean {
    const controller = this.controllers.get(operationId)
    return controller?.signal.aborted || false
  }
}

// API响应包装器
export function createApiResponse<T>(
  data: T,
  message?: string
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  })
}

export function createErrorResponse(
  error: string | AppError,
  statusCode: number = 500
): NextResponse {
  if (error instanceof AppError) {
    return error.toResponse()
  }

  return NextResponse.json({
    success: false,
    error: typeof error === 'string' ? error : '未知错误',
    timestamp: new Date().toISOString()
  }, { status: statusCode })
}

// 全局错误监控实例
export const errorMonitor = ErrorMonitor.getInstance()

// 导出主要工具
// 所有导出都已在声明时使用export关键字导出