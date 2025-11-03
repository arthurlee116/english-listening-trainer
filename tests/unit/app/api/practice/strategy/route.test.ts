import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/practice/strategy/route';
import type { PracticeStrategyRecommendation } from '@/lib/practice/strategy-builder';
import type { PracticeSummaryPoint } from '@/lib/practice/history-summary';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/practice/history-summary');
vi.mock('@/lib/practice/strategy-builder');
vi.mock('@/lib/cache/strategy-cache');

// Import after mocking
import { requireAuth } from '@/lib/auth';
import { getRecentSummaries } from '@/lib/practice/history-summary';
import { getLatestStrategy } from '@/lib/practice/strategy-builder';
import { getStrategyCache, setStrategyCache } from '@/lib/cache/strategy-cache';

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetRecentSummaries = vi.mocked(getRecentSummaries);
const mockGetLatestStrategy = vi.mocked(getLatestStrategy);
const mockGetStrategyCache = vi.mocked(getStrategyCache);
const mockSetStrategyCache = vi.mocked(setStrategyCache);

// Mock console.error to prevent test pollution
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

const MOCK_USER_ID = 'test-user-id';
const MOCK_STRATEGY: PracticeStrategyRecommendation = {
  summary: 'Your performance shows steady improvement.',
  suggestedDifficulty: 'B1',
  suggestedTopic: 'Daily Conversation',
  suggestedDurationMin: 20,
  confidence: 'high'
};

const MOCK_STATS: PracticeSummaryPoint[] = [
  {
    id: 's1',
    language: 'en-US',
    score: 85,
    answerTimeSec: 45,
    ttsLatencyMs: 120,
    finishedAt: new Date().toISOString(),
  }
];

describe('GET /api/practice/strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: {
        userId: MOCK_USER_ID,
        email: 'test@example.com',
        isAdmin: false
      },
      error: undefined,
    });
    mockGetRecentSummaries.mockResolvedValue(MOCK_STATS);
    mockGetLatestStrategy.mockResolvedValue(MOCK_STRATEGY);
    mockGetStrategyCache.mockReturnValue(undefined); // No cache by default
    consoleErrorSpy.mockClear();
  });

  it('should return 401 if authentication fails', async () => {
    mockRequireAuth.mockResolvedValue({ user: null, error: 'Unauthorized' });

    const request = new NextRequest('http://localhost/api/practice/strategy');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockGetRecentSummaries).not.toHaveBeenCalled();
  });

  it('should return cached recommendation when available', async () => {
    mockGetStrategyCache.mockReturnValue(MOCK_STRATEGY);

    const request = new NextRequest('http://localhost/api/practice/strategy');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(MOCK_STRATEGY);
    expect(body.meta.cached).toBe(true);
    expect(mockGetLatestStrategy).not.toHaveBeenCalled();
    expect(mockSetStrategyCache).not.toHaveBeenCalled();
  });

  it('should force refresh when forceRefresh=true query param', async () => {
    mockGetStrategyCache.mockReturnValue(MOCK_STRATEGY);

    const request = new NextRequest('http://localhost/api/practice/strategy?forceRefresh=true');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(MOCK_STRATEGY);
    expect(body.meta.cached).toBe(false);
    expect(mockGetLatestStrategy).toHaveBeenCalled();
    expect(mockSetStrategyCache).toHaveBeenCalled();
  });

  it('should generate new recommendation when cache is empty', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(MOCK_STRATEGY);
    expect(body.meta.cached).toBe(false);
    expect(mockGetRecentSummaries).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      language: undefined,
      limit: 3,
    });
    expect(mockGetLatestStrategy).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      recentStats: MOCK_STATS,
      strategyType: 'ai-recommended',
    });
    expect(mockSetStrategyCache).toHaveBeenCalled();
  });

  it('should handle language query parameter', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy?language=zh-CN');
    await GET(request);

    expect(mockGetRecentSummaries).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      language: 'zh-CN',
      limit: 3,
    });
  });

  it('should use progressive strategy when strategyType=progressive', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy?strategyType=progressive');
    await GET(request);

    expect(mockGetLatestStrategy).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      recentStats: MOCK_STATS,
      strategyType: 'progressive',
    });
    expect(mockSetStrategyCache).toHaveBeenCalledWith(
      'strategy:test-user-id:progressive:any',
      MOCK_STRATEGY
    );
  });

  it('should use ai-recommended strategy by default', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy');
    await GET(request);

    expect(mockGetLatestStrategy).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      recentStats: MOCK_STATS,
      strategyType: 'ai-recommended',
    });
  });

  it('should include strategyType in cache key', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy?strategyType=progressive&language=en-US');
    await GET(request);

    expect(mockSetStrategyCache).toHaveBeenCalledWith(
      'strategy:test-user-id:progressive:en-US',
      MOCK_STRATEGY
    );
  });

  it('should handle errors and return 500', async () => {
    const mockError = new Error('Strategy generation failed');
    mockGetLatestStrategy.mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost/api/practice/strategy');
    const response = await GET(request);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to generate practice strategy:',
      mockError
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'INTERNAL_ERROR' });
  });
});

describe('POST /api/practice/strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: {
        userId: MOCK_USER_ID,
        email: 'test@example.com',
        isAdmin: false
      },
      error: undefined,
    });
    mockGetRecentSummaries.mockResolvedValue(MOCK_STATS);
    mockGetLatestStrategy.mockResolvedValue(MOCK_STRATEGY);
    consoleErrorSpy.mockClear();
  });

  it('should return 401 if authentication fails', async () => {
    mockRequireAuth.mockResolvedValue({ user: null, error: 'Unauthorized' });

    const request = new NextRequest('http://localhost/api/practice/strategy', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('should generate new strategy and update cache', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceRefresh: true }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(MOCK_STRATEGY);
    expect(body.meta.cached).toBe(false);
    expect(mockGetLatestStrategy).toHaveBeenCalled();
    expect(mockSetStrategyCache).toHaveBeenCalled();
  });

  it('should handle language query parameter in POST', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy?language=zh-CN', {
      method: 'POST',
    });
    await POST(request);

    expect(mockGetRecentSummaries).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      language: 'zh-CN',
      limit: 3,
    });
  });

  it('should use progressive strategy in POST when strategyType=progressive', async () => {
    const request = new NextRequest('http://localhost/api/practice/strategy?strategyType=progressive', {
      method: 'POST',
    });
    await POST(request);

    expect(mockGetLatestStrategy).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      recentStats: MOCK_STATS,
      strategyType: 'progressive',
    });
    expect(mockSetStrategyCache).toHaveBeenCalledWith(
      'strategy:test-user-id:progressive:any',
      MOCK_STRATEGY
    );
  });

  it('should handle errors and return 500', async () => {
    const mockError = new Error('Strategy generation failed');
    mockGetLatestStrategy.mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost/api/practice/strategy', {
      method: 'POST',
    });
    const response = await POST(request);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to generate practice strategy:',
      mockError
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'INTERNAL_ERROR' });
  });
});
