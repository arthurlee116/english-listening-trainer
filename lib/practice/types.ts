import type { DifficultyLevel } from '@/lib/types';

/**
 * Strategy history entry representing a single strategy recommendation
 * with its outcome (actual score if available)
 */
export type StrategyHistoryEntry = {
  /** Unique identifier for this strategy recommendation */
  id: string;
  /** Timestamp when this strategy was generated */
  generatedAt: string;
  /** Type of strategy that was recommended */
  strategyType: 'ai-recommended' | 'progressive';
  /** Summary of the strategy recommendation */
  summary: string;
  /** Suggested difficulty level */
  suggestedDifficulty: DifficultyLevel;
  /** Suggested topic */
  suggestedTopic: string;
  /** Suggested session duration in minutes */
  suggestedDurationMin: number;
  /** Confidence level of the recommendation */
  confidence: 'low' | 'medium' | 'high';
  /** Optional progression hint for progressive strategies */
  progressionHint?: string;
  /** Optional actual score achieved when following this recommendation */
  actualScore?: number;
  /** Deviation between suggested and actual performance (-100 to 100) */
  actualScoreDelta?: number;
};

/**
 * Metadata for strategy history API responses
 */
export type StrategyHistoryMeta = {
  /** Total number of entries available */
  count: number;
  /** Strategy type that was queried */
  strategyType: 'ai-recommended' | 'progressive' | 'all';
  /** Whether scores were included in the response */
  includeScores: boolean;
};

/**
 * API response structure for strategy history endpoint
 */
export type StrategyHistoryResponse = {
  data: StrategyHistoryEntry[];
  meta: StrategyHistoryMeta;
};

/**
 * Strategy recommendation with actual score tracking
 * Extends the base PracticeStrategyRecommendation to include outcome data
 */
export type PracticeStrategyRecommendationWithOutcome = {
  summary: string;
  suggestedDifficulty: DifficultyLevel;
  suggestedTopic: string;
  suggestedDurationMin: number;
  confidence: 'low' | 'medium' | 'high';
  progressionHint?: string;
  /** Optional actual score from practice session following this recommendation */
  actualScore?: number;
  /** Deviation from expected performance */
  actualScoreDelta?: number;
};
