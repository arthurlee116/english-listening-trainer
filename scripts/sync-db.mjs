#!/usr/bin/env node

import { spawnSync } from 'child_process'

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
  const databaseUrl =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('POSTGRES_URL_NON_POOLING, DIRECT_URL, or DATABASE_URL is required')
  }

  process.env.POSTGRES_URL_NON_POOLING = process.env.POSTGRES_URL_NON_POOLING || databaseUrl
  process.env.DIRECT_URL = process.env.DIRECT_URL || databaseUrl
  process.env.DATABASE_URL = process.env.DATABASE_URL || databaseUrl
  runPrismaDbPush(databaseUrl)
} catch (error) {
  console.error('[sync-db] Failed to synchronize database schema:', error)
  process.exit(1)
}
