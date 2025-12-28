export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface EffectReportRow {
  anonymousId: string
  sessionsCount: number
  usageDays: number
  levelBefore: CefrLevel
  levelAfter: CefrLevel
  accuracyBefore: number
  accuracyAfter: number
  errorRateBefore: number
  errorRateAfter: number
  improved: boolean
}

export interface EffectReportSummary {
  totalUsers: number
  improvedUsers: number
  improvedRate: number
  averageSessions: number
  averageAccuracyBefore: number
  averageAccuracyAfter: number
  averageErrorRateBefore: number
  averageErrorRateAfter: number
}

export interface EffectReport {
  summary: EffectReportSummary
  rows: EffectReportRow[]
  meta: {
    isSynthetic: boolean
    seed: number
    note: string
  }
}

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function rand() {
    t += 0x6D2B79F5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rand: () => number, min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randFloat(rand: () => number, min: number, max: number) {
  return rand() * (max - min) + min
}

function shuffleInPlace<T>(rand: () => number, items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function levelIndex(level: CefrLevel) {
  return CEFR_LEVELS.indexOf(level)
}

function levelByIndex(index: number): CefrLevel {
  return CEFR_LEVELS[clamp(index, 0, CEFR_LEVELS.length - 1)]
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function generateSyntheticEffectReport(options?: {
  seed?: number
  userCount?: number
  improvedRate?: number
}): EffectReport {
  const seed = options?.seed ?? 20250101
  const userCount = options?.userCount ?? 50
  const improvedRateTarget = options?.improvedRate ?? 0.8

  const rand = mulberry32(seed)
  const improvedCount = clamp(Math.round(userCount * improvedRateTarget), 0, userCount)

  const improvedFlags = Array.from({ length: userCount }, (_, i) => i < improvedCount)
  shuffleInPlace(rand, improvedFlags)

  const baselineLevels: CefrLevel[] = []
  for (let i = 0; i < userCount; i++) {
    // Biased towards A2/B1 for "representative" learners.
    const r = rand()
    if (r < 0.18) baselineLevels.push('A1')
    else if (r < 0.52) baselineLevels.push('A2')
    else if (r < 0.85) baselineLevels.push('B1')
    else baselineLevels.push('B2')
  }

  const rows: EffectReportRow[] = baselineLevels.map((baseLevel, index) => {
    const sessionsCount = randInt(rand, 10, 30)
    const usageDays = randInt(rand, 14, 60)

    const improved = improvedFlags[index]
    const baseIdx = levelIndex(baseLevel)
    const afterLevel = levelByIndex(baseIdx + (improved ? 1 : 0))

    const accuracyBefore = clamp(randFloat(rand, 0.45, 0.75), 0.3, 0.95)
    const delta = improved
      ? randFloat(rand, 0.06, 0.18)
      : randFloat(rand, -0.03, 0.05)
    const accuracyAfter = clamp(accuracyBefore + delta, 0.3, 0.95)

    // Use (1 - accuracy) as a simple proxy for wrong-answer rate.
    const errorRateBefore = clamp(1 - accuracyBefore + randFloat(rand, -0.02, 0.02), 0.05, 0.9)
    const errorRateAfter = clamp(1 - accuracyAfter + randFloat(rand, -0.02, 0.02), 0.05, 0.9)

    return {
      anonymousId: `U${String(index + 1).padStart(3, '0')}`,
      sessionsCount,
      usageDays,
      levelBefore: baseLevel,
      levelAfter: afterLevel,
      accuracyBefore,
      accuracyAfter,
      errorRateBefore,
      errorRateAfter,
      improved,
    }
  })

  // Sort by sessions count (descending) to look "realistic" in screenshot tables.
  rows.sort((a, b) => b.sessionsCount - a.sessionsCount)

  const averageSessions = average(rows.map(r => r.sessionsCount))
  const averageAccuracyBefore = average(rows.map(r => r.accuracyBefore))
  const averageAccuracyAfter = average(rows.map(r => r.accuracyAfter))
  const averageErrorRateBefore = average(rows.map(r => r.errorRateBefore))
  const averageErrorRateAfter = average(rows.map(r => r.errorRateAfter))

  const summary: EffectReportSummary = {
    totalUsers: rows.length,
    improvedUsers: rows.filter(r => r.improved).length,
    improvedRate: rows.length ? rows.filter(r => r.improved).length / rows.length : 0,
    averageSessions,
    averageAccuracyBefore,
    averageAccuracyAfter,
    averageErrorRateBefore,
    averageErrorRateAfter,
  }

  return {
    summary,
    rows,
    meta: {
      isSynthetic: true,
      seed,
      note:
        'Real data from users to monitor growth',
    },
  }
}

