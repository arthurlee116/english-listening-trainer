import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

describe('database health (real sqlite)', () => {
  let tempDir = ''
  let dbPath = ''
  let repoRoot = ''
  let previousDatabaseUrl: string | undefined
  let createdUserId: string | null = null

  beforeAll(async () => {
    previousDatabaseUrl = process.env.DATABASE_URL
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elt-db-'))
    dbPath = path.join(tempDir, 'test.db')
    process.env.DATABASE_URL = `file:${dbPath}`
    repoRoot = path.resolve(__dirname, '../..')

    execSync('npx prisma migrate deploy', {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe'
    })

    delete (globalThis as Record<string, unknown>).__eltPrisma
    vi.resetModules()
  })

  afterAll(async () => {
    try {
      const { getPrismaClient } = await import('@/lib/database')
      const prisma = getPrismaClient()
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } })
      }
      await prisma.$disconnect()
    } catch {
      // Ignore cleanup errors for temp DB.
    }

    delete (globalThis as Record<string, unknown>).__eltPrisma

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('connects and executes a health check query', async () => {
    const { checkDatabaseHealth } = await import('@/lib/database')
    const result = await checkDatabaseHealth()
    expect(result.healthy).toBe(true)
  })

  it('writes and reads related practice data', async () => {
    const { getPrismaClient } = await import('@/lib/database')
    const prisma = getPrismaClient()
    const timestamp = Date.now()

    const user = await prisma.user.create({
      data: {
        email: `integration-${timestamp}@example.test`,
        password: 'hashed-placeholder',
        name: 'Integration User'
      }
    })
    createdUserId = user.id

    const session = await prisma.practiceSession.create({
      data: {
        userId: user.id,
        difficulty: 'B1',
        language: 'en-US',
        topic: 'integration test',
        transcript: 'hello world'
      }
    })

    const question = await prisma.practiceQuestion.create({
      data: {
        sessionId: session.id,
        index: 0,
        type: 'multiple_choice',
        question: 'What is the greeting?',
        options: JSON.stringify(['hello world', 'goodbye']),
        correctAnswer: 'hello world'
      }
    })

    const answer = await prisma.practiceAnswer.create({
      data: {
        questionId: question.id,
        userAnswer: 'hello world',
        isCorrect: true,
        tags: JSON.stringify(['integration'])
      }
    })

    const fetched = await prisma.practiceSession.findUnique({
      where: { id: session.id },
      include: {
        questions: {
          include: {
            answers: true
          }
        }
      }
    })

    expect(fetched).not.toBeNull()
    expect(fetched?.questions).toHaveLength(1)
    expect(fetched?.questions[0]?.id).toBe(question.id)
    expect(fetched?.questions[0]?.answers).toHaveLength(1)
    expect(fetched?.questions[0]?.answers[0]?.id).toBe(answer.id)
  })
})
