import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getRecentSummaries,
  PracticeSummaryPoint,
} from '@/lib/practice/history-summary';

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
    const limit = 3; // Fixed limit as per requirement

    // 3. Fetch summaries
    const summaries: PracticeSummaryPoint[] = await getRecentSummaries({
      userId,
      language: queryLanguage,
      limit,
    });

    // 4. Return success response
    return NextResponse.json({
      data: summaries,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    // 5. Capture exception and return 500
    console.error('Failed to load practice history summary:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
