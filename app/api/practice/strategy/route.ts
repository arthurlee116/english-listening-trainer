import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getRecentSummaries } from '@/lib/practice/history-summary';
import { getLatestStrategy } from '@/lib/practice/strategy-builder';
import { addStrategyToHistory } from '@/lib/practice/strategy-history';
import { getStrategyCache, setStrategyCache } from '@/lib/cache/strategy-cache';
import type { PracticeStrategyRecommendation } from '@/lib/practice/strategy-builder';

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 2. Extract query parameters
    const { searchParams } = new URL(request.url);
    const queryLanguage = searchParams.get('language') || undefined;
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const strategyType = (searchParams.get('strategyType') as 'ai-recommended' | 'progressive') || 'ai-recommended';

    // 3. Check cache first (unless force refresh)
    const cacheKey = `strategy:${userId}:${strategyType}:${queryLanguage || 'any'}`;
    let cachedRecommendation: PracticeStrategyRecommendation | undefined;

    if (!forceRefresh) {
      cachedRecommendation = getStrategyCache(cacheKey) as PracticeStrategyRecommendation | undefined;
    }

    if (cachedRecommendation) {
      return NextResponse.json({
        data: cachedRecommendation,
        meta: {
          generatedAt: new Date().toISOString(),
          cached: true,
        },
      });
    }

    // 4. Fetch recent practice stats
    const recentStats = await getRecentSummaries({
      userId,
      language: queryLanguage,
      limit: 3,
    });

    // 5. Generate strategy recommendation
    const recommendation = await getLatestStrategy({
      userId,
      recentStats,
      strategyType,
    });

    // 6. Add to history
    await addStrategyToHistory(userId, {
      strategyType,
      summary: recommendation.summary,
      suggestedDifficulty: recommendation.suggestedDifficulty,
      suggestedTopic: recommendation.suggestedTopic,
      suggestedDurationMin: recommendation.suggestedDurationMin,
      confidence: recommendation.confidence,
      progressionHint: recommendation.progressionHint,
    });

    // 7. Cache the result
    setStrategyCache(cacheKey, recommendation);

    // 8. Return success response
    return NextResponse.json({
      data: recommendation,
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
      },
    });
  } catch (error) {
    // 8. Capture exception and return 500
    console.error('Failed to generate practice strategy:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const authResult = await requireAuth(request);

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 2. Extract request body
    const body = await request.json().catch(() => ({}));
    const _forceRefresh = body.forceRefresh === true;

    // 3. Extract query parameters for language
    const { searchParams } = new URL(request.url);
    const queryLanguage = searchParams.get('language') || undefined;
    const strategyType = (searchParams.get('strategyType') as 'ai-recommended' | 'progressive') || 'ai-recommended';

    // 4. Fetch recent practice stats
    const recentStats = await getRecentSummaries({
      userId,
      language: queryLanguage,
      limit: 3,
    });

    // 5. Generate new strategy recommendation
    const recommendation = await getLatestStrategy({
      userId,
      recentStats,
      strategyType,
    });

    // 6. Add to history
    await addStrategyToHistory(userId, {
      strategyType,
      summary: recommendation.summary,
      suggestedDifficulty: recommendation.suggestedDifficulty,
      suggestedTopic: recommendation.suggestedTopic,
      suggestedDurationMin: recommendation.suggestedDurationMin,
      confidence: recommendation.confidence,
      progressionHint: recommendation.progressionHint,
    });

    // 7. Update cache
    const cacheKey = `strategy:${userId}:${strategyType}:${queryLanguage || 'any'}`;
    setStrategyCache(cacheKey, recommendation);

    // 8. Return success response
    return NextResponse.json({
      data: recommendation,
      meta: {
        generatedAt: new Date().toISOString(),
        cached: false,
      },
    });
  } catch (error) {
    // 8. Capture exception and return 500
    console.error('Failed to generate practice strategy:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
