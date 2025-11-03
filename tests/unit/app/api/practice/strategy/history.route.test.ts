import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/practice/strategy/history/route';
import type { NextRequest } from 'next/server';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}));

// Mock the strategy-history module
vi.mock('@/lib/practice/strategy-history', () => ({
  getStrategyHistory: vi.fn(),
}));

describe('GET /api/practice/strategy/history', () => {
  const mockGetStrategyHistory = vi.mocked(vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vi.fn()).mockImplementation(mockGetStrategyHistory);
  });

  const createMockRequest = (url: string): NextRequest => {
    return {
      url,
      headers: new Headers(),
      nextUrl: {
        searchParams: new URL(url).searchParams,
      },
    } as unknown as NextRequest;
  };

  it('should return 401 if user is not authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: 'Unauthorized',
      user: null,
    });

    const request = createMockRequest('http://localhost:3000/api/practice/strategy/history');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if strategyType is invalid', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?strategyType=invalid'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid strategyType');
  });

  it('should return 400 if limit is invalid', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?limit=abc'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid limit');
  });

  it('should return 400 if limit is out of range', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?limit=100'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid limit');
  });

  it('should return 500 if internal error occurs', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockRejectedValue(new Error('Unexpected error'));

    const request = createMockRequest('http://localhost:3000/api/practice/strategy/history');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('INTERNAL_ERROR');
  });

  it('should return success with default parameters', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        strategyType: 'ai-recommended',
        includeScores: true,
      },
    });

    const request = createMockRequest('http://localhost:3000/api/practice/strategy/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual([]);
    expect(data.meta).toEqual({
      count: 0,
      strategyType: 'ai-recommended',
      includeScores: true,
    });
  });

  it('should handle ai-recommended strategy type', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [
        {
          id: '1',
          generatedAt: new Date().toISOString(),
          strategyType: 'ai-recommended',
          suggestedDifficulty: 'B1',
          suggestedTopic: 'Daily Conversation',
          suggestedDurationMin: 20,
          confidence: 'high',
        },
      ],
      meta: {
        count: 1,
        strategyType: 'ai-recommended',
        includeScores: true,
      },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?strategyType=ai-recommended'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].strategyType).toBe('ai-recommended');
    expect(data.meta.strategyType).toBe('ai-recommended');
  });

  it('should handle progressive strategy type', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [
        {
          id: '2',
          generatedAt: new Date().toISOString(),
          strategyType: 'progressive',
          suggestedDifficulty: 'B2',
          suggestedTopic: 'Business English',
          suggestedDurationMin: 25,
          confidence: 'high',
          progressionHint: 'Keep up the good work!',
        },
      ],
      meta: {
        count: 1,
        strategyType: 'progressive',
        includeScores: true,
      },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?strategyType=progressive'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].strategyType).toBe('progressive');
    expect(data.data[0].progressionHint).toBe('Keep up the good work!');
  });

  it('should handle all strategy type', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        strategyType: 'all',
        includeScores: true,
      },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?strategyType=all'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meta.strategyType).toBe('all');
  });

  it('should respect limit parameter', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        strategyType: 'ai-recommended',
        includeScores: true,
      },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?limit=10'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meta).toBeDefined();
  });

  it('should handle includeScores parameter', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        strategyType: 'ai-recommended',
        includeScores: false,
      },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?includeScores=false'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meta.includeScores).toBe(false);
  });

  it('should handle multiple query parameters together', async () => {
    const { requireAuth } = await import('@/lib/auth');
    vi.mocked(requireAuth).mockResolvedValue({
      error: null,
      user: { userId: 'test-user' },
    });

    const { getStrategyHistory } = await import('@/lib/practice/strategy-history');
    vi.mocked(getStrategyHistory).mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        strategyType: 'progressive',
        includeScores: false,
      },
    });

    const request = createMockRequest(
      'http://localhost:3000/api/practice/strategy/history?strategyType=progressive&limit=5&includeScores=false'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meta.strategyType).toBe('progressive');
    expect(data.meta.includeScores).toBe(false);
  });
});
