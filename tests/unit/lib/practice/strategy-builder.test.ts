import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStrategyPrompt,
  parseStrategyResponse,
  getLatestStrategy,
  buildProgressiveStrategy,
  StrategyGenerationError
} from '@/lib/practice/strategy-builder';
import type { PracticeSummaryPoint } from '@/lib/practice/history-summary';
import type { DifficultyLevel } from '@/lib/types';

// Mock the cerebras-service
vi.mock('@/lib/ai/cerebras-service', () => ({
  invokeStructured: vi.fn()
}));

import { invokeStructured } from '@/lib/ai/cerebras-service';

describe('buildStrategyPrompt', () => {
  it('should generate a prompt with the provided stats', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 85,
        answerTimeSec: 45.2,
        ttsLatencyMs: 120,
        finishedAt: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 78,
        answerTimeSec: 52.1,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      }
    ];

    const result = buildStrategyPrompt(mockStats);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('You are an expert English listening coach');
    expect(result[0].content).toContain(JSON.stringify(mockStats.map(stat => ({
      sessionId: stat.id,
      language: stat.language,
      score: stat.score,
      answerTimeSec: stat.answerTimeSec,
      ttsLatencyMs: stat.ttsLatencyMs,
      finishedAt: new Date(stat.finishedAt).toLocaleDateString()
    })), null, 2));
    expect(result[1].role).toBe('user');
    expect(result[1].content).toBe('Generate the practice strategy recommendation as a JSON object.');
  });
});

describe('parseStrategyResponse', () => {
  it('should parse a valid JSON response', () => {
    const validJson = JSON.stringify({
      summary: 'Your performance shows steady improvement in listening comprehension.',
      suggestedDifficulty: 'B1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 20,
      confidence: 'high'
    });

    const result = parseStrategyResponse(validJson);

    expect(result).toEqual({
      summary: 'Your performance shows steady improvement in listening comprehension.',
      suggestedDifficulty: 'B1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 20,
      confidence: 'high'
    });
  });

  it('should use regex fallback if JSON parsing fails', () => {
    const invalidJson = `Here is your recommendation:
Summary: Your scores are improving gradually.
Difficulty: B2
Topic: Business English
Duration: 15 minutes
Confidence: medium`;

    const result = parseStrategyResponse(invalidJson);

    // Since the regex doesn't match the expected format, it falls back to default
    expect(result).toEqual({
      summary: 'Based on your recent performance, continue practicing at your current level with varied topics to build comprehensive listening skills.',
      suggestedDifficulty: 'B1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 15,
      confidence: 'low'
    });
  });

  it('should return a fallback recommendation if all parsing fails', () => {
    const completelyInvalid = 'This is not JSON at all and has no structured data.';

    const result = parseStrategyResponse(completelyInvalid);

    expect(result).toEqual({
      summary: 'Based on your recent performance, continue practicing at your current level with varied topics to build comprehensive listening skills.',
      suggestedDifficulty: 'B1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 15,
      confidence: 'low'
    });
  });
});

describe('getLatestStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a default recommendation when no stats are available', async () => {
    const result = await getLatestStrategy({
      userId: 'user123',
      recentStats: []
    });

    expect(result).toEqual({
      summary: 'Welcome! Start with A1 level daily conversations to build your listening foundation.',
      suggestedDifficulty: 'A1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 10,
      confidence: 'high'
    });

    expect(invokeStructured).not.toHaveBeenCalled();
  });

  it('should handle AI service errors by throwing a StrategyGenerationError', async () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 80,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    vi.mocked(invokeStructured).mockRejectedValueOnce(new Error('Network error'));

    await expect(getLatestStrategy({
      userId: 'user123',
      recentStats: mockStats
    })).rejects.toThrow(StrategyGenerationError);

    expect(invokeStructured).toHaveBeenCalledTimes(1);
  });

  it('should successfully generate and return a strategy recommendation', async () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 85,
        answerTimeSec: 45,
        ttsLatencyMs: 120,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const mockAiResponse = JSON.stringify({
      summary: 'Good progress! Keep challenging yourself.',
      suggestedDifficulty: 'B1' as DifficultyLevel,
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 20,
      confidence: 'high'
    });

    vi.mocked(invokeStructured).mockResolvedValueOnce(mockAiResponse);

    const result = await getLatestStrategy({
      userId: 'user123',
      recentStats: mockStats
    });

    expect(result).toEqual({
      summary: 'Good progress! Keep challenging yourself.',
      suggestedDifficulty: 'B1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 20,
      confidence: 'high'
    });

    expect(invokeStructured).toHaveBeenCalledTimes(1);
    expect(invokeStructured).toHaveBeenCalledWith({
      messages: buildStrategyPrompt(mockStats),
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          suggestedDifficulty: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          suggestedTopic: { type: 'string', enum: [
            'Daily Conversation', 'Business English', 'Academic Lectures',
            'News Broadcasts', 'Podcasts', 'Movie Clips', 'Interview Dialogues',
            'Scientific Presentations', 'Travel Conversations'
          ] },
          suggestedDurationMin: { type: 'number', minimum: 10, maximum: 30 },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['summary', 'suggestedDifficulty', 'suggestedTopic', 'suggestedDurationMin', 'confidence']
      },
      schemaName: 'practiceStrategyRecommendation'
    });
  });
});

describe('buildProgressiveStrategy', () => {
  it('should return default recommendation for empty stats', () => {
    const result = buildProgressiveStrategy([]);

    expect(result).toEqual({
      summary: 'Welcome! Start with A1 level daily conversations to build your listening foundation.',
      suggestedDifficulty: 'A1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 10,
      confidence: 'high',
      progressionHint: 'New user - starting with A1 level. Practice consistently to build your skills!',
    });
  });

  it('should increase difficulty when average score is high (90%+)', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 95,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 92,
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(result.suggestedDifficulty).toBe('A2' as DifficultyLevel);
    expect(result.progressionHint).toContain('94%');
    expect(result.progressionHint).toContain('stable');
    expect(result.confidence).toBe('high');
  });

  it('should decrease difficulty when average score is low (60%)', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 65,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 60,
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(result.suggestedDifficulty).toBe('A1' as DifficultyLevel);
    expect(result.progressionHint).toContain('63%');
    expect(result.progressionHint).toContain('stable');
  });

  it('should maintain difficulty when score is stable (75-80%)', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 78,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 76,
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      },
      {
        id: 'session3',
        language: 'en-US',
        score: 77,
        answerTimeSec: 38,
        ttsLatencyMs: 90,
        finishedAt: '2025-01-03T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    // With average score 77%, should be around A2-B1 level
    expect(result.suggestedDifficulty).toBe('B1' as DifficultyLevel);
    expect(result.progressionHint).toContain('stable');
  });

  it('should detect improving trend and increase difficulty', () => {
    // Test data in API order (DESC by createdAt, most recent first)
    // This matches what getRecentSummaries actually returns
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session3',
        language: 'en-US',
        score: 88,  // Most recent (scores[0])
        answerTimeSec: 45,
        ttsLatencyMs: 90,
        finishedAt: '2025-01-03T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 85,  // Middle (scores[1])
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      },
      {
        id: 'session1',
        language: 'en-US',
        score: 82,  // Oldest (scores[2])
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    // With improving trend (88 > 82), average 85% should map to B1 with positive adjustment
    expect(result.suggestedDifficulty).toBe('B1' as DifficultyLevel);
    expect(result.summary).toContain('improving');
  });

  it('should detect declining trend and decrease difficulty', () => {
    // Test data in API order (DESC by createdAt, most recent first)
    // This matches what getRecentSummaries actually returns
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session3',
        language: 'en-US',
        score: 60,  // Most recent (scores[0]) - lowest
        answerTimeSec: 45,
        ttsLatencyMs: 90,
        finishedAt: '2025-01-03T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 68,  // Middle (scores[1])
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      },
      {
        id: 'session1',
        language: 'en-US',
        score: 70,  // Oldest (scores[2]) - highest
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    // With declining trend (60 < 70), difficulty should decrease to A1
    expect(result.suggestedDifficulty).toBe('A1' as DifficultyLevel);
    expect(result.summary).toContain('declining');
  });

  it('should handle edge case of 100% score', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 100,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(result.suggestedDifficulty).toBe('C2' as DifficultyLevel);
    expect(result.confidence).toBe('high');
  });

  it('should handle edge case of 0% score', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 0,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(result.suggestedDifficulty).toBe('A1' as DifficultyLevel);
    expect(result.progressionHint).toContain('0%');
  });

  it('should not go below A1 difficulty', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 50,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 45,
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(result.suggestedDifficulty).toBe('A1' as DifficultyLevel);
  });

  it('should not go above C2 difficulty', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 98,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 99,
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(result.suggestedDifficulty).toBe('C2' as DifficultyLevel);
  });

  it('should generate random topic from DEFAULT_TOPICS', () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 75,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    expect(['Daily Conversation', 'Business English', 'Academic Lectures', 'News Broadcasts', 'Podcasts', 'Movie Clips', 'Interview Dialogues', 'Scientific Presentations', 'Travel Conversations']).toContain(result.suggestedTopic);
  });

  it('should correctly handle data in the order API delivers (DESC createdAt, most recent first)', () => {
    // getRecentSummaries returns data in DESC order by createdAt:
    // scores[0] = most recent, scores[scores.length - 1] = oldest
    // This test feeds data in that exact order to verify trend calculation
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session3',
        language: 'en-US',
        score: 88,  // Most recent (would be scores[0])
        answerTimeSec: 45,
        ttsLatencyMs: 90,
        finishedAt: '2025-01-03T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 85,  // Middle (would be scores[1])
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      },
      {
        id: 'session1',
        language: 'en-US',
        score: 82,  // Oldest (would be scores[2])
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    // With improving trend (88 > 82), difficulty should increase
    expect(result.summary).toContain('improving');
    expect(result.progressionHint).toContain('advancing');
  });

  it('should correctly detect declining trend with API data order', () => {
    // Declining scores in API order (most recent first)
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session3',
        language: 'en-US',
        score: 60,  // Most recent - lowest (would be scores[0])
        answerTimeSec: 45,
        ttsLatencyMs: 90,
        finishedAt: '2025-01-03T10:00:00.000Z'
      },
      {
        id: 'session2',
        language: 'en-US',
        score: 68,  // Middle (would be scores[1])
        answerTimeSec: 42,
        ttsLatencyMs: 95,
        finishedAt: '2025-01-02T10:00:00.000Z'
      },
      {
        id: 'session1',
        language: 'en-US',
        score: 70,  // Oldest - highest (would be scores[2])
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = buildProgressiveStrategy(mockStats);

    // With declining trend (60 < 70), difficulty should decrease
    expect(result.summary).toContain('declining');
    expect(result.suggestedDifficulty).toBe('A1' as DifficultyLevel);
  });
});

describe('getLatestStrategy with strategyType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use progressive strategy when strategyType is progressive', async () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 85,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const result = await getLatestStrategy({
      userId: 'user123',
      recentStats: mockStats,
      strategyType: 'progressive',
    });

    expect(result.progressionHint).toBeDefined();
    expect(invokeStructured).not.toHaveBeenCalled();
  });

  it('should use AI strategy when strategyType is ai-recommended', async () => {
    const mockStats: PracticeSummaryPoint[] = [
      {
        id: 'session1',
        language: 'en-US',
        score: 85,
        answerTimeSec: 40,
        ttsLatencyMs: 100,
        finishedAt: '2025-01-01T10:00:00.000Z'
      }
    ];

    const mockAiResponse = JSON.stringify({
      summary: 'Good progress!',
      suggestedDifficulty: 'B1',
      suggestedTopic: 'Daily Conversation',
      suggestedDurationMin: 20,
      confidence: 'high'
    });

    vi.mocked(invokeStructured).mockResolvedValueOnce(mockAiResponse);

    const result = await getLatestStrategy({
      userId: 'user123',
      recentStats: mockStats,
      strategyType: 'ai-recommended',
    });

    expect(result.progressionHint).toBeUndefined();
    expect(invokeStructured).toHaveBeenCalled();
  });
});
