/**
 * 统一错误处理模块
 * 整合错误处理、日志记录和用户反馈
 */

export enum ErrorCode {
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // 认证错误
  INVALID_INVITATION_CODE = 'INVALID_INVITATION_CODE',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  
  // AI服务错误
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  
  // TTS服务错误
  TTS_SERVICE_ERROR = 'TTS_SERVICE_ERROR',
  TTS_GENERATION_FAILED = 'TTS_GENERATION_FAILED',
  
  // 数据库错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  SAVE_FAILED = 'SAVE_FAILED',
  
  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // 系统错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AppError {
  code: ErrorCode
  message: string
  severity: ErrorSeverity
  userMessage: string
  details?: Record<string, unknown>
  timestamp: Date
  stack?: string
}

export class ErrorHandler {
  private static errorLog: AppError[] = []
  private static maxLogSize = 100

  // 创建应用错误
  static createError(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    userMessage?: string,
    details?: Record<string, unknown>
  ): AppError {
    const error: AppError = {
      code,
      message,
      severity,
      userMessage: userMessage || this.getDefaultUserMessage(code),
      details,
      timestamp: new Date(),
      stack: new Error().stack
    }

    this.logError(error)
    return error
  }

  // 包装原生错误
  static wrapError(
    originalError: Error,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    userMessage?: string
  ): AppError {
    return this.createError(
      code,
      originalError.message,
      severity,
      userMessage,
      { originalError: originalError.message, stack: originalError.stack }
    )
  }

  // 记录错误
  private static logError(error: AppError): void {
    // 添加到内存日志
    this.errorLog.push(error)
    
    // 保持日志大小限制
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize)
    }

    // 根据严重程度决定日志级别
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', error)
        break
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH ERROR:', error)
        break
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM ERROR:', error)
        break
      case ErrorSeverity.LOW:
        console.info('ℹ️ LOW ERROR:', error)
        break
    }

    // 在生产环境中，这里可以发送到错误监控服务
    if (process.env.NODE_ENV === 'production' && error.severity >= ErrorSeverity.HIGH) {
      // 发送到监控服务（例如 Sentry）
      this.reportToMonitoring(error)
    }
  }

  // 获取默认用户消息
  private static getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络设置后重试',
      [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
      [ErrorCode.INVALID_INVITATION_CODE]: '邀请码无效或已过期',
      [ErrorCode.USAGE_LIMIT_EXCEEDED]: '今日使用次数已达上限',
      [ErrorCode.AI_SERVICE_ERROR]: 'AI服务暂时不可用，请稍后重试',
      [ErrorCode.AI_GENERATION_FAILED]: '内容生成失败，请重新尝试',
      [ErrorCode.TTS_SERVICE_ERROR]: '语音合成服务暂时不可用',
      [ErrorCode.TTS_GENERATION_FAILED]: '音频生成失败，请重新尝试',
      [ErrorCode.DATABASE_ERROR]: '数据保存失败，请稍后重试',
      [ErrorCode.SAVE_FAILED]: '保存操作失败',
      [ErrorCode.VALIDATION_ERROR]: '输入数据格式不正确',
      [ErrorCode.MISSING_REQUIRED_FIELD]: '请填写所有必需字段',
      [ErrorCode.UNKNOWN_ERROR]: '发生未知错误，请稍后重试',
      [ErrorCode.INTERNAL_SERVER_ERROR]: '服务器内部错误，请联系技术支持'
    }

    return messages[code] || '操作失败，请重试'
  }

  // 获取错误日志
  static getErrorLog(): AppError[] {
    return [...this.errorLog]
  }

  // 获取最近的错误
  static getRecentErrors(count: number = 10): AppError[] {
    return this.errorLog.slice(-count)
  }

  // 清理错误日志
  static clearErrorLog(): void {
    this.errorLog = []
  }

  // 错误统计
  static getErrorStats(): {
    total: number
    bySeverity: Record<ErrorSeverity, number>
    byCode: Record<ErrorCode, number>
    recentErrorRate: number
  } {
    const total = this.errorLog.length
    const bySeverity = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    }
    const byCode: Record<ErrorCode, number> = {} as Record<ErrorCode, number>

    // 统计
    this.errorLog.forEach(error => {
      bySeverity[error.severity]++
      byCode[error.code] = (byCode[error.code] || 0) + 1
    })

    // 计算最近错误率（最近10分钟内的错误数量）
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const recentErrors = this.errorLog.filter(error => error.timestamp > tenMinutesAgo)
    const recentErrorRate = recentErrors.length

    return {
      total,
      bySeverity,
      byCode,
      recentErrorRate
    }
  }

  // 上报到监控服务
  private static reportToMonitoring(error: AppError): void {
    // 这里可以集成第三方监控服务
    try {
      // 示例：发送到监控API
      if (typeof window !== 'undefined') {
        // 客户端监控
        console.warn('Would report to monitoring service:', error)
      } else {
        // 服务端监控
        console.warn('Would report to server monitoring:', error)
      }
    } catch (reportError) {
      console.error('Failed to report error to monitoring:', reportError)
    }
  }

  // 重试机制
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          throw this.wrapError(
            lastError,
            ErrorCode.UNKNOWN_ERROR,
            ErrorSeverity.HIGH,
            `操作失败，已重试${maxRetries}次`
          )
        }

        // 指数退避延迟
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError // 这行代码实际上不会执行，但TypeScript需要
  }

  // 熔断器模式
  static createCircuitBreaker<T extends unknown[], R>(
    operation: (...args: T) => Promise<R>,
    failureThreshold: number = 5,
    resetTimeout: number = 60000
  ) {
    let failures = 0
    let lastFailureTime = 0
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

    return async (...args: T): Promise<R> => {
      const now = Date.now()

      if (state === 'OPEN') {
        if (now - lastFailureTime > resetTimeout) {
          state = 'HALF_OPEN'
        } else {
          throw this.createError(
            ErrorCode.AI_SERVICE_ERROR,
            'Service circuit breaker is open',
            ErrorSeverity.HIGH,
            '服务暂时不可用，请稍后重试'
          )
        }
      }

      try {
        const result = await operation(...args);
        
        if (state === 'HALF_OPEN') {
          state = 'CLOSED'
          failures = 0
        }
        
        return result
      } catch (error) {
        failures++
        lastFailureTime = now

        if (failures >= failureThreshold) {
          state = 'OPEN'
        }

        throw error
      }
    }
  }
}

// 导出便捷函数
export const createError = ErrorHandler.createError.bind(ErrorHandler)
export const wrapError = ErrorHandler.wrapError.bind(ErrorHandler)
export const withRetry = ErrorHandler.withRetry.bind(ErrorHandler)
export const createCircuitBreaker = ErrorHandler.createCircuitBreaker.bind(ErrorHandler)