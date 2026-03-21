#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

function normalizeSqliteUrl(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('file:')) {
    return rawUrl
  }

  const filePath = rawUrl.slice('file:'.length)
  if (!filePath) {
    return rawUrl
  }

  if (path.isAbsolute(filePath)) {
    return `file:${filePath}`
  }

  return `file:${path.resolve(process.cwd(), filePath)}`
}

function ensureSqliteFile(sqliteUrl) {
  if (!sqliteUrl || !sqliteUrl.startsWith('file:')) {
    return
  }

  const filePath = sqliteUrl.slice('file:'.length)
  if (!filePath) {
    return
  }

  const directory = path.dirname(filePath)
  fs.mkdirSync(directory, { recursive: true })

  if (!fs.existsSync(filePath)) {
    fs.closeSync(fs.openSync(filePath, 'a'))
  }
}

function runPrismaDbPush(databaseUrl) {
  const result = spawnSync(
    'npx',
    ['prisma', 'db', 'push', '--accept-data-loss'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    },
  )

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }

  if (result.signal) {
    process.kill(process.pid, result.signal)
  }
}

try {
  const rawDatabaseUrl = process.env.DATABASE_URL || 'file:/app/prisma/data/app.db'
  const databaseUrl = normalizeSqliteUrl(rawDatabaseUrl)

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  process.env.DATABASE_URL = databaseUrl
  ensureSqliteFile(databaseUrl)
  runPrismaDbPush(databaseUrl)
} catch (error) {
  console.error('[sync-db] Failed to synchronize database schema:', error)
  process.exit(1)
}
