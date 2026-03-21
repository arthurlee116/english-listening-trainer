/**
 * Database utilities for Prisma + Postgres/Neon on Vercel.
 * The runtime uses a pooled URL when available, while Prisma CLI uses the
 * direct URL configured in prisma.config.ts for schema operations.
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const PLACEHOLDER_DATABASE_URL =
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable'

function getRuntimeDatabaseUrl(): string {
  return (
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    PLACEHOLDER_DATABASE_URL
  )
}

type GlobalWithPrisma = typeof globalThis & { __eltPrisma?: PrismaClient }

const globalForPrisma = globalThis as GlobalWithPrisma

function initPrisma(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: getRuntimeDatabaseUrl(),
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    errorFormat: 'pretty',
  })
}

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
    const rows = await client.$queryRawUnsafe<Array<{ exists?: boolean }>>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS "exists"
      `,
      table,
      column,
    )

    const exists = Boolean(rows[0]?.exists)
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

    if (
      message.includes('already exists') ||
      message.includes('duplicate column') ||
      message.includes('42701')
    ) {
      schemaColumnCache.set(`${table}.${column}`, true)
      return true
    }

    console.error('Failed to add missing table column:', { table, column, error })
    return false
  }
}

export async function withDatabase<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  operationName: string = 'database operation'
): Promise<T> {
  const client = getPrismaClient()
  let attempts = 0
  const maxRetries = 3
  const retryDelay = 1000

  while (attempts < maxRetries) {
    try {
      return await operation(client)
    } catch (error) {
      attempts++
      console.error(`${operationName} failed (attempt ${attempts}/${maxRetries}):`, error)

      if (attempts < maxRetries && isRetriableError(error)) {
        console.log(`Retrying ${operationName} in ${retryDelay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        continue
      }

      throw formatDatabaseError(error, operationName)
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts`)
}

function isRetriableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const retriableErrors = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'server closed the connection unexpectedly',
    'too many connections',
    'connection terminated unexpectedly',
  ]

  return retriableErrors.some((retriableError) =>
    error.message.toLowerCase().includes(retriableError.toLowerCase())
  )
}

function formatDatabaseError(error: unknown, operationName: string): Error {
  if (!(error instanceof Error)) {
    return new Error(`${operationName} failed with unknown error`)
  }

  if (error.message.includes('Unique constraint failed') || error.message.includes('unique constraint')) {
    return new Error('该记录已存在，请检查重复数据')
  }

  if (error.message.includes('Record to delete does not exist')) {
    return new Error('要删除的记录不存在')
  }

  if (error.message.includes('Record to update not found')) {
    return new Error('要更新的记录不存在')
  }

  if (error.message.includes('Foreign key constraint failed') || error.message.includes('foreign key')) {
    return new Error('数据关联错误，无法执行该操作')
  }

  if (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('connection')
  ) {
    return new Error('数据库连接失败，请检查网络连接')
  }

  return new Error(`${operationName} failed: ${error.message}`)
}

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
      const batchResults = await Promise.allSettled(batch.map((op) => op()))

      results.push(
        ...batchResults.map((result) => {
          if (result.status === 'fulfilled') {
            return result.value
          }
          if (result.reason instanceof Error) {
            return result.reason
          }
          return new Error(String(result.reason))
        }),
      )
    }

    return results
  }
}

export async function cleanupDatabase(): Promise<void> {
  await withDatabase(async (prisma) => {
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

process.on('beforeExit', async () => {
  const prisma = globalForPrisma.__eltPrisma
  if (prisma) {
    await prisma.$disconnect()
  }
})

if (!(globalThis as Record<string, unknown>).__dbSignalHandlersRegistered) {
  (globalThis as Record<string, unknown>).__dbSignalHandlersRegistered = true
  process.on('SIGINT', async () => {
    const prisma = globalForPrisma.__eltPrisma
    if (prisma) await prisma.$disconnect()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    const prisma = globalForPrisma.__eltPrisma
    if (prisma) await prisma.$disconnect()
    process.exit(0)
  })
}
