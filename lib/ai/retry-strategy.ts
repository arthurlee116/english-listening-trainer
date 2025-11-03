

export interface RetryPolicyOptions {
  baseDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
}

export class RetryPolicy {
  private readonly baseDelayMs: number
  private readonly maxDelayMs: number
  private readonly jitterRatio: number

  constructor(options: RetryPolicyOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 250
    this.maxDelayMs = options.maxDelayMs ?? 8000
    this.jitterRatio = options.jitterRatio ?? 0.25
  }

  getDelay(attempt: number, rng: () => number = Math.random): number {
    const exponent = Math.max(0, attempt - 1)
    const exponential = Math.min(
      this.baseDelayMs * Math.pow(2, exponent),
      this.maxDelayMs
    )
    const jitter = exponential * this.jitterRatio * rng()
    return Math.round(exponential + jitter)
  }
}

export interface CoverageRetryOptions<TData, TEvaluation> {
  basePrompt: string
  maxAttempts: number
  generate: (prompt: string, attempt: number) => Promise<TData | null>
  evaluate: (data: TData) => TEvaluation
  /**
   * Return retry=true to continue, optionally supplying degradation reason once stopping.
   */
  shouldRetry: (
    evaluation: TEvaluation,
    attempt: number
  ) => {
    retry: boolean
    degradationReason?: string
  }
  buildRetryPrompt: (basePrompt: string, data: TData, evaluation: TEvaluation, nextAttempt: number) => string
  score: (evaluation: TEvaluation) => number
  logAttempt?: (details: { attempt: number; evaluation: TEvaluation; data: TData }) => void
}

export interface CoverageRetryResult<TData, TEvaluation> {
  attempts: number
  degradationReason?: string
  best: {
    data: TData
    evaluation: TEvaluation
  } | null
}

export async function executeWithCoverageRetry<TData, TEvaluation>(
  options: CoverageRetryOptions<TData, TEvaluation>
): Promise<CoverageRetryResult<TData, TEvaluation>> {
  const { basePrompt, maxAttempts, generate, evaluate, shouldRetry, buildRetryPrompt, score, logAttempt } = options

  let attempts = 0
  let currentPrompt = basePrompt
  let best: CoverageRetryResult<TData, TEvaluation>['best'] = null
  let degradationReason: string | undefined

  while (attempts < maxAttempts) {
    attempts += 1
    const data = await generate(currentPrompt, attempts)

    if (!data) {
      continue
    }

    const evaluation = evaluate(data)
    logAttempt?.({ attempt: attempts, evaluation, data })

    const attemptScore = score(evaluation)
    const bestScore = best ? score(best.evaluation) : -Infinity

    if (!best || attemptScore > bestScore) {
      best = { data, evaluation }
    }

    const retryDecision = shouldRetry(evaluation, attempts)
    if (!retryDecision.retry || attempts >= maxAttempts) {
      degradationReason = retryDecision.degradationReason
      break
    }

    currentPrompt = buildRetryPrompt(basePrompt, data, evaluation, attempts + 1)
  }

  return {
    attempts,
    degradationReason,
    best
  }
}
