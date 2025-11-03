import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '@/app/api/practice/history/summary/route';
import { PracticeSummaryPoint } from '@/lib/practice/history-summary';

// Mock dependencies
const mockRequireAuth = vi.fn();
const mockGetRecentSummaries = vi.fn();

vi.mock('@/lib/auth', () => ({
  get requireAuth() { return mockRequireAuth; },
}));

vi.mock('@/lib/practice/history-summary', () => ({
  get getRecentSummaries() { return mockGetRecentSummaries; },
}));

// Mock console.error to prevent test pollution
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

const MOCK_USER_ID = 'test-user-id';
const MOCK_SUMMARIES: PracticeSummaryPoint[] = [
  {
    id: 's1',
    language: 'en-US',
    score: 95,
    answerTimeSec: 12.5,
    ttsLatencyMs: 450,
    finishedAt: new Date().toISOString(),
  },
  {
    id: 's2',
    language: 'zh-CN',
    score: 88,
    answerTimeSec: 15.0,
    ttsLatencyMs: 550,
    finishedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe('GET /api/practice/history/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { userId: MOCK_USER_ID },
      error: null,
    });
    mockGetRecentSummaries.mockResolvedValue(MOCK_SUMMARIES);
    consoleErrorSpy.mockClear();
  });

  it('should return 401 if authentication fails', async () => {
    mockRequireAuth.mockResolvedValue({ user: null, error: 'Unauthorized' });

    const request = new NextRequest('http://localhost/api/practice/history/summary');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockGetRecentSummaries).not.toHaveBeenCalled();
  });

  it('should call getRecentSummaries with default limit (3) and no language filter', async () => {
    const request = new NextRequest('http://localhost/api/practice/history/summary');
    await GET(request);

    expect(mockGetRecentSummaries).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      language: undefined,
      limit: 3,
    });
  });

  it('should call getRecentSummaries with the specified language filter', async () => {
    const request = new NextRequest(
      'http://localhost/api/practice/history/summary?language=zh-CN'
    );
    await GET(request);

    expect(mockGetRecentSummaries).toHaveBeenCalledWith({
      userId: MOCK_USER_ID,
      language: 'zh-CN',
      limit: 3,
    });
  });

  it('should return 200 with data and meta.generatedAt as a valid ISO string', async () => {
    const request = new NextRequest('http://localhost/api/practice/history/summary');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data).toEqual(MOCK_SUMMARIES);
    expect(body.meta).toBeDefined();
    expect(body.meta.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    ); // Check for ISO 8601 format
  });

  it('should handle empty data gracefully', async () => {
    mockGetRecentSummaries.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/practice/history/summary');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });

  it('should handle errors from getRecentSummaries, log the error, and return 500', async () => {
    const mockError = new Error('Database read failed');
    mockGetRecentSummaries.mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost/api/practice/history/summary');
    const response = await GET(request);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load practice history summary:',
      mockError
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'INTERNAL_ERROR' });
  });
});
