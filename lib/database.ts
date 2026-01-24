/**
 * 数据库连接管理和错误处理工具
 * 提供统一的数据库操作接口和错误处理机制
 */

import fs from 'fs'
import path from 'path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

function normalizeSqliteUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl || !rawUrl.startsWith('file:')) return rawUrl

  const filePath = rawUrl.slice('file:'.length)
  const needsResolve = filePath.startsWith('./') || filePath.startsWith('../')
  const resolvedPath = needsResolve ? path.resolve(process.cwd(), filePath) : filePath

  if (resolvedPath !== filePath) {
    return `file:${resolvedPath}`
  }

  return rawUrl
}

function ensureSqliteDirectory(sqliteUrl: string | undefined): void {
  if (!sqliteUrl || !sqliteUrl.startsWith('file:')) return

  const filePath = sqliteUrl.slice('file:'.length)
  const directory = path.dirname(filePath)

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

const normalizedUrl = normalizeSqliteUrl(process.env.DATABASE_URL)
if (normalizedUrl) {
  process.env.DATABASE_URL = normalizedUrl
  ensureSqliteDirectory(normalizedUrl)
}

type GlobalWithPrisma = typeof globalThis & { __eltPrisma?: PrismaClient }

const globalForPrisma = globalThis as GlobalWithPrisma

// 初始化 Prisma 客户端
function initPrisma(): PrismaClient {
  // 从 DATABASE_URL 获取 SQLite 文件路径
  const dbUrl = process.env.DATABASE_URL || 'file:./data/app.db'
  ensureSqliteDirectory(dbUrl)

  const adapter = new PrismaBetterSqlite3({ url: dbUrl })
  
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    errorFormat: 'pretty',
  })

  // 预热数据库连接并启用更高并发的 WAL 模式
  void client.$connect()
    .then(async () => {
      try {
        await client.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
        await client.$queryRawUnsafe('PRAGMA busy_timeout = 5000;')
      } catch (pragmaError) {
        console.warn('Failed to apply SQLite pragmas:', pragmaError)
      }
    })
    .catch((connectionError) => {
      console.error('Prisma preconnect failed:', connectionError)
    })

  return client
}

// 获取 Prisma 客户端单例
export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__eltPrisma) {
    globalForPrisma.__eltPrisma = initPrisma()
  }
  return globalForPrisma.__eltPrisma
}

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/
const schemaColumnCache = new Map<string, boolean>()

export async function tableHasColumn(
  client: PrismaClient,
  table: string,
  column: string
): Promise<boolean> {
  const cacheKey = `${table}.${column}`
  if (schemaColumnCache.has(cacheKey)) {
    return schemaColumnCache.get(cacheKey) as boolean
  }

  if (!IDENTIFIER_REGEX.test(table) || !IDENTIFIER_REGEX.test(column)) {
    throw new Error('Invalid table or column name')
  }

  try {
    const rows = await client.$queryRawUnsafe<Array<{ name?: string }>>(
      `PRAGMA table_info('${table}')`
    )
    const exists = rows.some(row => row?.name === column)
    schemaColumnCache.set(cacheKey, exists)
    return exists
  } catch (error) {
    console.error('Failed to check table column existence:', { table, column, error })
    schemaColumnCache.set(cacheKey, false)
    return false
  }
}

export async function ensureTableColumn(
  client: PrismaClient,
  table: string,
  column: string,
  definition: string
): Promise<boolean> {
  if (await tableHasColumn(client, table, column)) {
    return true
  }

  const trimmedDefinition = definition.trim()
  if (!trimmedDefinition) {
    throw new Error('Column definition is required when ensuring table column')
  }

  const quotedTable = `"${table}"`
  const quotedColumn = `"${column}"`

  try {
    await client.$executeRawUnsafe(
      `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn} ${trimmedDefinition}`
    )
    schemaColumnCache.set(`${table}.${column}`, true)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('duplicate column name') || message.includes('already exists')) {
      schemaColumnCache.set(`${table}.${column}`, true)
      return true
    }

    console.error('Failed to add missing table column:', { table, column, error })
    return false
  }
}

/**
 * 数据库操作包装器
 * 提供统一的错误处理和重试机制
 */
export async function withDatabase<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  operationName: string = 'database operation'
): Promise<T> {
  const client = getPrismaClient()
  let attempts = 0
  const maxRetries = 3
  const retryDelay = 1000 // 1秒

  while (attempts < maxRetries) {
    try {
      const result = await operation(client)
      return result
    } catch (error) {
      attempts++
      console.error(`${operationName} failed (attempt ${attempts}/${maxRetries}):`, error)

      // 检查是否是可以重试的错误
      if (attempts < maxRetries && isRetriableError(error)) {
        console.log(`Retrying ${operationName} in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }

      // 抛出格式化的错误
      throw formatDatabaseError(error, operationName)
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts`)
}

/**
 * 检查是否是可重试的错误
 */
function isRetriableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const retriableErrors = [
    'ECONNREFUSED',
    'ENOTFOUND', 
    'ETIMEDOUT',
    'ECONNRESET',
    'database is locked'
  ]

  return retriableErrors.some(retriableError => 
    error.message.includes(retriableError)
  )
}

/**
 * 格式化数据库错误消息
 */
function formatDatabaseError(error: unknown, operationName: string): Error {
  if (!(error instanceof Error)) {
    return new Error(`${operationName} failed with unknown error`)
  }

  // Prisma 特定错误处理
  if (error.message.includes('Unique constraint failed')) {
    return new Error('该记录已存在，请检查重复数据')
  }

  if (error.message.includes('Record to delete does not exist')) {
    return new Error('要删除的记录不存在')
  }

  if (error.message.includes('Record to update not found')) {
    return new Error('要更新的记录不存在')
  }

  if (error.message.includes('Foreign key constraint failed')) {
    return new Error('数据关联错误，无法执行该操作')
  }

  if (error.message.includes('database is locked')) {
    return new Error('数据库忙碌，请稍后重试')
  }

  // 连接错误
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    return new Error('数据库连接失败，请检查网络连接')
  }

  // 默认错误消息
  return new Error(`${operationName} failed: ${error.message}`)
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    const client = getPrismaClient()
    await client.$queryRaw`SELECT 1`
    return { healthy: true, message: 'Database connection is healthy' }
  } catch (error) {
    console.error('Database health check failed:', error)
    return { 
      healthy: false, 
      message: error instanceof Error ? error.message : 'Database connection failed' 
    }
  }
}

/**
 * 批量操作工具
 */
export class BatchOperations<T> {
  private operations: Array<() => Promise<T>> = []
  private batchSize = 100

  constructor(batchSize: number = 100) {
    this.batchSize = batchSize
  }

  add(operation: () => Promise<T>): BatchOperations<T> {
    this.operations.push(operation)
    return this
  }

  async execute(): Promise<(T | Error)[]> {
    const results: (T | Error)[] = []
    
    for (let i = 0; i < this.operations.length; i += this.batchSize) {
      const batch = this.operations.slice(i, i + this.batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(op => op())
      )
      
      results.push(...batchResults.map(result => {
        if (result.status === 'fulfilled') {
          return result.value
        }
        // 确保 reason 是一个 Error 对象
        if (result.reason instanceof Error) {
          return result.reason
        }
        return new Error(String(result.reason))
      }))
    }
    
    return results
  }
}

/**
 * 数据库清理工具
 * 清理过期数据和孤儿记录
 */
export async function cleanupDatabase(): Promise<void> {
  await withDatabase(async (prisma) => {
    // 清理超过30天的练习数据（可配置）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const deletedCount = await prisma.practiceSession.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    })
    
    console.log(`Cleaned up ${deletedCount.count} old practice sessions`)
  }, 'cleanup database')
}

/**
 * 优化查询构建器
 */
export class QueryBuilder {
  static getUserPracticeSessions(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit
    
    return {
      where: { userId },
      orderBy: { createdAt: 'desc' as const },
      skip: offset,
      take: limit,
      select: {
        id: true,
        difficulty: true,
        language: true,
        topic: true,
        accuracy: true,
        score: true,
        duration: true,
        createdAt: true,
        exerciseData: true
      }
    }
  }

  static getActiveUsers(daysAgo: number = 7) {
    return {
      where: {
        practiceSessions: {
          some: {
            createdAt: {
              gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    }
  }

  static getDifficultyStats(days: number = 30) {
    return {
      where: {
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        difficulty: true,
        accuracy: true,
        score: true,
        createdAt: true
      }
    }
  }
}

// 优雅关闭处理
process.on('beforeExit', async () => {
  const prisma = getPrismaClient()
  if (prisma) {
    await prisma.$disconnect()
  }
})

if (!(globalThis as Record<string, unknown>).__dbSignalHandlersRegistered) {
  (globalThis as Record<string, unknown>).__dbSignalHandlersRegistered = true
  process.on('SIGINT', async () => {
    const prisma = getPrismaClient()
    if (prisma) await prisma.$disconnect()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    const prisma = getPrismaClient()
    if (prisma) await prisma.$disconnect()
    process.exit(0)
  })
}
