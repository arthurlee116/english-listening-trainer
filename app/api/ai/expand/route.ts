import { NextRequest, NextResponse } from 'next/server'
import { expandTranscript } from '@/lib/ai/transcript-expansion'
import { createAiRoute } from '@/lib/ai/route-utils'
import { RateLimitConfigs } from '@/lib/rate-limiter'

async function handleExpansion(request: NextRequest): Promise<NextResponse> {
  const {
    text,
    targetWordCount,
    topic,
    difficulty,
    language = 'en-US',
    maxAttempts = 5,
    minAcceptablePercentage = 0.9
  } = await request.json()

  if (!text || !targetWordCount || !topic || !difficulty) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 })
  }

  const result = await expandTranscript({
    text,
    targetWordCount,
    topic,
    difficulty,
    language,
    maxAttempts,
    minAcceptablePercentage
  })

  return NextResponse.json(result)
}

export const POST = createAiRoute(handleExpansion, {
  label: 'expand',
  rateLimitConfig: RateLimitConfigs.GENERAL_API,
  useCircuitBreaker: true
})
