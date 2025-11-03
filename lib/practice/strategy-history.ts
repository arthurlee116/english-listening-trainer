import { getPrismaClient } from '@/lib/database';
import {
  getStrategyHistoryCache,
  setStrategyHistoryCache,
  addToStrategyHistoryCache,
} from '@/lib/cache/strategy-cache';
import type {
  StrategyHistoryEntry,
  StrategyHistoryResponse,
} from '@/lib/practice/types';
import type { PracticeSummaryPoint } from '@/lib/practice/history-summary';
import type { DifficultyLevel } from '@/lib/types';

/**
 * Calculate the deviation between suggested difficulty and actual performance
 * Returns a value between -100 and 100, where:
 * - Negative values indicate underperformance
 * - Positive values indicate overperformance
 * - Zero indicates perfect match
 * @param suggestedDifficulty The suggested difficulty level
 * @param actualScore The actual score achieved (0-100)
 * @returns Deviation score
 */
export function calculateScoreDeviation(
  suggestedDifficulty: DifficultyLevel,
  actualScore: number
): number {
  // Define expected score ranges for each difficulty level
  const difficultyRanges: Record<DifficultyLevel, { min: number; max: number }> = {
    A1: { min: 50, max: 70 },
    A2: { min: 60, max: 75 },
    B1: { min: 65, max: 80 },
    B2: { min: 70, max: 85 },
    C1: { min: 75, max: 90 },
    C2: { min: 80, max: 95 },
  };

  const range = difficultyRanges[suggestedDifficulty];
  const expectedScore = (range.min + range.max) / 2;

  // Calculate deviation as percentage points
  const deviation = actualScore - expectedScore;

  // Clamp to -100 to 100 range
  return Math.max(-100, Math.min(100, deviation));
}

/**
 * Find matching practice sessions for a strategy recommendation
 * Matches sessions that occurred after the strategy was generated
 * @param sessions Array of practice sessions
 * @param strategyGeneratedAt Timestamp when strategy was generated
 * @param toleranceMinutes Time window to consider (default: 60 minutes)
 * @returns First matching session or undefined
 */
export function findMatchingSession(
  sessions: PracticeSummaryPoint[],
  strategyGeneratedAt: string,
  toleranceMinutes: number = 60
): PracticeSummaryPoint | undefined {
  const strategyTime = new Date(strategyGeneratedAt).getTime();
  const toleranceMs = toleranceMinutes * 60 * 1000;

  // Find the first session that occurred after the strategy was generated
  // within the tolerance window
  return sessions.find(session => {
    const sessionTime = new Date(session.finishedAt).getTime();
    return sessionTime >= strategyTime && sessionTime <= strategyTime + toleranceMs;
  });
}

/**
 * Aggregate strategy history with actual scores from practice sessions
 * @param userId User identifier
 * @param strategyType Type of strategy to fetch (ai-recommended, progressive, or all)
 * @param limit Maximum number of entries to return (default: 7)
 * @param includeScores Whether to include actual scores (default: true)
 * @returns Strategy history with scores
 */
export async function getStrategyHistory({
  userId,
  strategyType,
  limit = 7,
  includeScores = true,
}: {
  userId: string;
  strategyType: 'ai-recommended' | 'progressive' | 'all';
  limit?: number;
  includeScores?: boolean;
}): Promise<StrategyHistoryResponse> {
  const prisma = getPrismaClient();

  try {
    // Try to get from cache first
    let cachedHistory: StrategyHistoryEntry[] | undefined;

    if (strategyType === 'all') {
      // For 'all', we need to merge both types
      const aiHistory = getStrategyHistoryCache(userId, 'ai-recommended') || [];
      const progressiveHistory = getStrategyHistoryCache(userId, 'progressive') || [];
      cachedHistory = [...aiHistory, ...progressiveHistory]
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, limit);
    } else {
      cachedHistory = getStrategyHistoryCache(userId, strategyType);
    }

    // If we have cached data and don't need scores, return it
    if (cachedHistory && !includeScores) {
      return {
        data: cachedHistory.slice(0, limit),
        meta: {
          count: cachedHistory.length,
          strategyType,
          includeScores,
        },
      };
    }

    // If we have cached data with scores, return it
    if (cachedHistory && includeScores) {
      const historyWithScores = cachedHistory.slice(0, limit);
      return {
        data: historyWithScores,
        meta: {
          count: cachedHistory.length,
          strategyType,
          includeScores,
        },
      };
    }

    // Cache miss - need to fetch recent practice sessions for score matching
    let strategyHistory: StrategyHistoryEntry[] = [];

    if (strategyType === 'all') {
      const aiHistory = getStrategyHistoryCache(userId, 'ai-recommended') || [];
      const progressiveHistory = getStrategyHistoryCache(userId, 'progressive') || [];
      strategyHistory = [...aiHistory, ...progressiveHistory];
    } else {
      strategyHistory = getStrategyHistoryCache(userId, strategyType) || [];
    }

    // If we still don't have any history, return empty result
    if (strategyHistory.length === 0) {
      return {
        data: [],
        meta: {
          count: 0,
          strategyType,
          includeScores,
        },
      };
    }

    // If includeScores is true, fetch recent sessions and match them
    if (includeScores) {
      try {
        const recentSessions = await prisma.practiceSession.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20, // Get more sessions to increase match probability
          select: {
            id: true,
            language: true,
            score: true,
            createdAt: true,
            difficulty: true,
          },
        });

        // Transform to PracticeSummaryPoint format
        const sessionPoints: PracticeSummaryPoint[] = recentSessions.map(session => ({
          id: session.id,
          language: session.language,
          score: session.score || 0,
          answerTimeSec: 0,
          ttsLatencyMs: 0,
          finishedAt: session.createdAt.toISOString(),
        }));

        // Match sessions to strategy recommendations
        strategyHistory = strategyHistory.map(entry => {
          const matchingSession = findMatchingSession(
            sessionPoints,
            entry.generatedAt,
            120 // 2 hour tolerance for matching
          );

          if (matchingSession && matchingSession.score > 0) {
            const actualScoreDelta = calculateScoreDeviation(
              entry.suggestedDifficulty,
              matchingSession.score
            );

            return {
              ...entry,
              actualScore: matchingSession.score,
              actualScoreDelta,
            };
          }

          return entry;
        });

        // Update cache with scored data
        if (strategyType === 'all') {
          const aiHistory = strategyHistory.filter(h => h.strategyType === 'ai-recommended');
          const progressiveHistory = strategyHistory.filter(h => h.strategyType === 'progressive');

          if (aiHistory.length > 0) {
            setStrategyHistoryCache(userId, 'ai-recommended', aiHistory);
          }
          if (progressiveHistory.length > 0) {
            setStrategyHistoryCache(userId, 'progressive', progressiveHistory);
          }
        } else {
          setStrategyHistoryCache(userId, strategyType, strategyHistory);
        }
      } catch (error) {
        console.error('Failed to fetch practice sessions for score matching:', error);
        // Continue without scores if session fetch fails
      }
    }

    // Apply limit and return
    const limitedHistory = strategyHistory
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);

    return {
      data: limitedHistory,
      meta: {
        count: strategyHistory.length,
        strategyType,
        includeScores,
      },
    };
  } catch (error) {
    console.error('Error fetching strategy history:', error);
    // Return empty result on error
    return {
      data: [],
      meta: {
        count: 0,
        strategyType,
        includeScores,
      },
    };
  }
}

/**
 * Add a new strategy recommendation to history
 * This should be called whenever a new strategy is generated
 * @param userId User identifier
 * @param recommendation Strategy recommendation to add
 */
export async function addStrategyToHistory(
  userId: string,
  recommendation: {
    strategyType: 'ai-recommended' | 'progressive';
    summary: string;
    suggestedDifficulty: DifficultyLevel;
    suggestedTopic: string;
    suggestedDurationMin: number;
    confidence: 'low' | 'medium' | 'high';
    progressionHint?: string;
  }
): Promise<void> {
  const historyEntry: StrategyHistoryEntry = {
    id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
    strategyType: recommendation.strategyType,
    summary: recommendation.summary,
    suggestedDifficulty: recommendation.suggestedDifficulty,
    suggestedTopic: recommendation.suggestedTopic,
    suggestedDurationMin: recommendation.suggestedDurationMin,
    confidence: recommendation.confidence,
    progressionHint: recommendation.progressionHint,
  };

  // Add to cache
  addToStrategyHistoryCache(userId, recommendation.strategyType, historyEntry);

  console.info('Strategy added to history', {
    userId,
    strategyType: recommendation.strategyType,
    suggestedDifficulty: recommendation.suggestedDifficulty,
    generatedAt: historyEntry.generatedAt,
  });
}
