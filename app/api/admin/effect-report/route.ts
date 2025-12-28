import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth'
import type { CefrLevel, EffectReport, EffectReportRow } from '@/lib/admin/effect-report'
import { generateSyntheticEffectReport } from '@/lib/admin/effect-report'

const prisma = getPrismaClient()

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function levelIndex(level: string): number {
  const idx = CEFR_LEVELS.indexOf(level as CefrLevel)
  return idx === -1 ? 0 : idx
}

function levelByIndex(index: number): CefrLevel {
  return CEFR_LEVELS[clamp(index, 0, CEFR_LEVELS.length - 1)]
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function parseSeed(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('seed')
  if (!raw) return 20250101
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : 20250101
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '需要管理员权限' },
        { status: 403 },
      )
    }

    const seed = parseSeed(request)
    const demoMode = process.env.ADMIN_DEMO_DATA === '1'

    if (demoMode) {
      const report = generateSyntheticEffectReport({ seed, userCount: 50, improvedRate: 0.8 })
      return NextResponse.json(report)
    }

    // Best-effort "derived" report from existing sessions.
    // Note: the DB schema does not store explicit pre/post proficiency, so we approximate using difficulty+accuracy.
    const users = await prisma.user.findMany({
      select: {
        id: true,
        practiceSessions: {
          select: {
            difficulty: true,
            accuracy: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    const rows: EffectReportRow[] = users
      .map((user, index) => {
        const sessions = user.practiceSessions
        if (sessions.length < 2) return null

        const first = sessions.slice(0, 3)
        const last = sessions.slice(-3)

        const firstLevelIdx = Math.round(average(first.map(s => levelIndex(s.difficulty))))
        const lastLevelIdx = Math.round(average(last.map(s => levelIndex(s.difficulty))))

        const accuracyBeforeValues = first.map(s => s.accuracy).filter((v): v is number => v !== null)
        const accuracyAfterValues = last.map(s => s.accuracy).filter((v): v is number => v !== null)

        const accuracyBefore = accuracyBeforeValues.length ? average(accuracyBeforeValues) : 0
        const accuracyAfter = accuracyAfterValues.length ? average(accuracyAfterValues) : 0

        const improved =
          lastLevelIdx > firstLevelIdx || (accuracyAfterValues.length && accuracyBeforeValues.length && accuracyAfter - accuracyBefore >= 0.05)

        const errorRateBefore = clamp(1 - accuracyBefore, 0, 1)
        const errorRateAfter = clamp(1 - accuracyAfter, 0, 1)

        const usageDays =
          Math.max(
            1,
            Math.round((sessions[sessions.length - 1].createdAt.getTime() - sessions[0].createdAt.getTime()) / (24 * 60 * 60 * 1000)),
          ) || 1

        return {
          anonymousId: `U${String(index + 1).padStart(3, '0')}`,
          sessionsCount: sessions.length,
          usageDays,
          levelBefore: levelByIndex(firstLevelIdx),
          levelAfter: levelByIndex(lastLevelIdx),
          accuracyBefore,
          accuracyAfter,
          errorRateBefore,
          errorRateAfter,
          improved,
        }
      })
      .filter((r): r is EffectReportRow => r !== null)

    const report: EffectReport = {
      summary: {
        totalUsers: rows.length,
        improvedUsers: rows.filter(r => r.improved).length,
        improvedRate: rows.length ? rows.filter(r => r.improved).length / rows.length : 0,
        averageSessions: average(rows.map(r => r.sessionsCount)),
        averageAccuracyBefore: average(rows.map(r => r.accuracyBefore)),
        averageAccuracyAfter: average(rows.map(r => r.accuracyAfter)),
        averageErrorRateBefore: average(rows.map(r => r.errorRateBefore)),
        averageErrorRateAfter: average(rows.map(r => r.errorRateAfter)),
      },
      rows,
      meta: {
        isSynthetic: false,
        seed,
        note: 'Derived report from practice sessions; level is approximated from CEFR difficulty settings.',
      },
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Get effect report error:', error)
    return NextResponse.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 })
  }
}

