import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getStrategyHistory } from '@/lib/practice/strategy-history';

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

    // 2. Extract and validate query parameters
    const { searchParams } = new URL(request.url);
    const strategyTypeParam = searchParams.get('strategyType');
    const limitParam = searchParams.get('limit');
    const includeScoresParam = searchParams.get('includeScores');

    // Validate strategyType
    let strategyType: 'ai-recommended' | 'progressive' | 'all' = 'ai-recommended';
    if (strategyTypeParam) {
      if (
        strategyTypeParam === 'ai-recommended' ||
        strategyTypeParam === 'progressive' ||
        strategyTypeParam === 'all'
      ) {
        strategyType = strategyTypeParam;
      } else {
        return NextResponse.json(
          { error: 'Invalid strategyType. Must be ai-recommended, progressive, or all' },
          { status: 400 }
        );
      }
    }

    // Validate and parse limit
    let limit = 7; // Default limit
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return NextResponse.json(
          { error: 'Invalid limit. Must be a number between 1 and 50' },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // Parse includeScores (default: true)
    let includeScores = true;
    if (includeScoresParam !== null) {
      includeScores = includeScoresParam === 'true';
    }

    // 3. Fetch strategy history
    const historyResponse = await getStrategyHistory({
      userId,
      strategyType,
      limit,
      includeScores,
    });

    // 4. Return success response
    return NextResponse.json(historyResponse);
  } catch (error) {
    // 5. Handle errors
    console.error('Failed to fetch strategy history:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
