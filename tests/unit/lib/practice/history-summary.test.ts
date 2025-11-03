import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentSummaries, PracticeSummaryPoint } from '@/lib/practice/history-summary';
import { PracticeSession } from '@prisma/client';

// Mock PrismaClient
const mockFindMany = vi.fn();

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    practiceSession: {
      get findMany() { return mockFindMany; },
    },
  })),
}));

const MOCK_USER_ID = 'user-123';

// Helper to create mock session data
const createMockSession = (
  id: string,
  language: string,
  score: number,
  createdAt: Date,
  answerTimeMs: number,
  ttsLatencyMs: number
): PracticeSession => ({
  id,
  userId: MOCK_USER_ID,
  difficulty: 'EASY',
  language,
  topic: 'Test Topic',
  accuracy: 0.8,
  score,
  duration: 60,
  createdAt,
  updatedAt: createdAt,
  exerciseData: JSON.stringify([
    { userAnswerTimeMs: answerTimeMs / 2, ttsLatencyMs: ttsLatencyMs / 2 },
    { userAnswerTimeMs: answerTimeMs / 2, ttsLatencyMs: ttsLatencyMs / 2 },
  ]),
  // Add other required fields for PracticeSession if necessary, using placeholders
  // Assuming the actual PracticeSession type has more fields, but we only select a few.
  // The mock needs to satisfy the full PracticeSession type for the mock data array.
  // Since we only select id, language, score, createdAt, exerciseData, the mock can be minimal.
} as unknown as PracticeSession);

describe('getRecentSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSessions = [
    createMockSession('id-1', 'en-US', 90, new Date('2025-10-31T10:00:00Z'), 10000, 500),
    createMockSession('id-2', 'zh-CN', 80, new Date('2025-10-31T09:00:00Z'), 15000, 600),
    createMockSession('id-3', 'en-US', 70, new Date('2025-10-31T08:00:00Z'), 20000, 700),
    createMockSession('id-4', 'es-ES', 60, new Date('2025-10-31T07:00:00Z'), 5000, 400),
    createMockSession('id-5', 'en-US', 50, new Date('2025-10-31T06:00:00Z'), 8000, 300),
  ];

  it('should return the default limit (3) of recent summaries for a user, sorted by finishedAt descending', async () => {
    mockFindMany.mockResolvedValue(mockSessions.slice(0, 3));

    const result = await getRecentSummaries({ userId: MOCK_USER_ID });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: MOCK_USER_ID },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })
    );

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('id-1');
    expect(result[0].score).toBe(90);
    expect(result[0].answerTimeSec).toBe(10.0); // 10000ms / 1000
    expect(result[0].ttsLatencyMs).toBe(250); // (500/2 + 500/2) / 2 = 250 (average of 2 points)
    expect(result[2].id).toBe('id-3');
  });

  it('should apply the language filter correctly', async () => {
    const enUsSessions = mockSessions.filter(s => s.language === 'en-US');
    mockFindMany.mockResolvedValue(enUsSessions.slice(0, 2));

    const result = await getRecentSummaries({ userId: MOCK_USER_ID, language: 'en-US', limit: 2 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: MOCK_USER_ID, language: 'en-US' },
        take: 2,
      })
    );

    expect(result).toHaveLength(2);
    expect(result.every(s => s.language === 'en-US')).toBe(true);
    expect(result[0].id).toBe('id-1');
    expect(result[1].id).toBe('id-3');
  });

  it('should handle custom limit correctly', async () => {
    mockFindMany.mockResolvedValue(mockSessions.slice(0, 5));

    const result = await getRecentSummaries({ userId: MOCK_USER_ID, limit: 5 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
    expect(result).toHaveLength(5);
  });

  it('should return an empty array if no sessions are found', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await getRecentSummaries({ userId: MOCK_USER_ID });

    expect(result).toEqual([]);
  });

  it('should handle database errors gracefully and return an empty array', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection failed'));

    const result = await getRecentSummaries({ userId: MOCK_USER_ID });

    expect(result).toEqual([]);
  });

  it('should handle malformed exerciseData gracefully and default metrics to zero', async () => {
    const malformedSession = {
      ...mockSessions[0],
      id: 'malformed-id',
      exerciseData: '{"not": "an array"}', // Malformed JSON
    };
    const corruptedSession = {
      ...mockSessions[1],
      id: 'corrupted-id',
      exerciseData: 'invalid json', // Corrupted JSON
    };

    mockFindMany.mockResolvedValue([malformedSession, corruptedSession]);

    const result = await getRecentSummaries({ userId: MOCK_USER_ID, limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('malformed-id');
    expect(result[0].answerTimeSec).toBe(0);
    expect(result[0].ttsLatencyMs).toBe(0);
    expect(result[1].id).toBe('corrupted-id');
    expect(result[1].answerTimeSec).toBe(0);
    expect(result[1].ttsLatencyMs).toBe(0);
  });
});
