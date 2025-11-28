import path from 'path'
import fs from 'fs'

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// 日志条目接口
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: Error
  requestId?: string
  userId?: string
  duration?: number
  metadata?: Record<string, unknown>
}

export class Logger {
  private static instance: Logger
  private logs: LogEntry[] = []
  private readonly maxLogs = 1000

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    requestId?: string,
    userId?: string,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      requestId,
      userId,
      duration,
      metadata: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    }
  }

  private log(entry: LogEntry): void {
    this.logs.push(entry)

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    if (process.env.NODE_ENV === 'development') {
      const color = this.getLogColor(entry.level)
      console.log(
        `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${'\x1b[0m'}`
      )

      if (entry.context) {
        console.log('Context:', entry.context)
      }

      if (entry.error) {
        console.error('Error:', entry.error)
      }
    }

    if (process.env.NODE_ENV === 'production' && entry.level === LogLevel.ERROR) {
      this.sendToExternalLogging(entry)
    }
  }

  private getLogColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m',
      [LogLevel.INFO]: '\x1b[32m',
      [LogLevel.WARN]: '\x1b[33m',
      [LogLevel.ERROR]: '\x1b[31m',
      [LogLevel.FATAL]: '\x1b[35m'
    }
    return colors[level] || '\x1b[0m'
  }

  // 预留外部日志集成
  private async sendToExternalLogging(_entry: LogEntry): Promise<void> {
    return Promise.resolve()
  }

  debug(message: string, context?: Record<string, unknown>, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.DEBUG, message, context, undefined, requestId))
  }

  info(message: string, context?: Record<string, unknown>, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.INFO, message, context, undefined, requestId))
  }

  warn(message: string, context?: Record<string, unknown>, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.WARN, message, context, undefined, requestId))
  }

  error(message: string, error?: Error, context?: Record<string, unknown>, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.ERROR, message, context, error, requestId))
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>, requestId?: string): void {
    this.log(this.createLogEntry(LogLevel.FATAL, message, context, error, requestId))
  }

  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId: string,
    userId?: string,
    requestBody?: Record<string, unknown>,
    responseSize?: number
  ): void {
    this.info('API Request', {
      method,
      url,
      statusCode,
      duration,
      userId,
      requestBody: process.env.NODE_ENV === 'development' ? requestBody : '[REDACTED]',
      responseSize
    }, requestId)
  }

  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    recordsAffected?: number,
    requestId?: string
  ): void {
    this.debug('Database Operation', {
      operation,
      table,
      duration,
      recordsAffected
    }, requestId)
  }

  getLogs(level?: LogLevel, limit: number = 100): LogEntry[] {
    let filtered = this.logs

    if (level) {
      filtered = this.logs.filter(log => log.level === level)
    }

    return filtered.slice(-limit)
  }

  searchLogs(query: string, limit: number = 100): LogEntry[] {
    const lowercaseQuery = query.toLowerCase()

    return this.logs
      .filter(log =>
        log.message.toLowerCase().includes(lowercaseQuery) ||
        (log.context && JSON.stringify(log.context).toLowerCase().includes(lowercaseQuery))
      )
      .slice(-limit)
  }

  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {
        [LogLevel.DEBUG]: this.logs.filter(log => log.level === LogLevel.DEBUG).length,
        [LogLevel.INFO]: this.logs.filter(log => log.level === LogLevel.INFO).length,
        [LogLevel.WARN]: this.logs.filter(log => log.level === LogLevel.WARN).length,
        [LogLevel.ERROR]: this.logs.filter(log => log.level === LogLevel.ERROR).length,
        [LogLevel.FATAL]: this.logs.filter(log => log.level === LogLevel.FATAL).length,
      },
      lastLogTime: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
    }
    return stats
  }

  logError(error: Error, context?: Record<string, unknown>): void {
    this.error(error.message, error, context)
  }

  rotateLog(filename: string): void {
    const logDir = process.env.LOG_DIR || './logs'
    const filepath = path.join(logDir, filename)

    if (!fs.existsSync(filepath)) {
      this.warn(`Log file not found: ${filename}`)
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `${filename}.${timestamp}`
    const backupPath = path.join(logDir, backupName)

    try {
      fs.renameSync(filepath, backupPath)
      this.info(`Log rotated: ${filename} -> ${backupName}`)
    } catch (error) {
      this.error(`Failed to rotate log file: ${filename}`, error as Error)
    }
  }
}
