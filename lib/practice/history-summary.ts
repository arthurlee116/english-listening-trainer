import { getPrismaClient } from '@/lib/database';

export type PracticeSummaryPoint = {
  id: string;
  language: string;
  score: number;
  answerTimeSec: number;
  ttsLatencyMs: number;
  finishedAt: string;
};

// Minimal type for exercise data extraction
type ExerciseDataPoint = {
  ttsLatencyMs?: number;
  userAnswerTimeMs?: number;
};

/**
 * Reads existing practice history data and returns recent summaries.
 * @param options.userId The ID of the user whose history to fetch.
 * @param options.language Optional language filter (e.g., 'en-US').
 * @param options.limit Maximum number of sessions to return (default: 3).
 * @returns A promise that resolves to an array of PracticeSummaryPoint, sorted by finishedAt descending.
 */
export async function getRecentSummaries({
  userId,
  language,
  limit = 3,
}: {
  userId: string;
  language?: string;
  limit?: number;
}): Promise<PracticeSummaryPoint[]> {
  const prisma = getPrismaClient();
  try {
    const sessions = await prisma.practiceSession.findMany({
      where: {
        userId,
        ...(language && { language }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        language: true,
        score: true,
        createdAt: true,
        exerciseData: true,
      },
    });

    return sessions.map((session) => {
      let parsedData: ExerciseDataPoint[] = [];
      try {
        // exerciseData is stored as a JSON string in the database
        parsedData = JSON.parse(session.exerciseData as string);
        if (!Array.isArray(parsedData)) {
          parsedData = [];
        }
      } catch (e) {
        console.error(`Failed to parse exerciseData for session ${session.id}:`, e);
        // Fallback to empty array if parsing fails
        parsedData = [];
      }

      // Calculate total answer time and average TTS latency
      const totalAnswerTimeMs = parsedData.reduce(
        (sum, data) => sum + (data.userAnswerTimeMs || 0),
        0
      );
      const totalTtsLatencyMs = parsedData.reduce(
        (sum, data) => sum + (data.ttsLatencyMs || 0),
        0
      );
      const validTtsCount = parsedData.filter(d => d.ttsLatencyMs !== undefined && d.ttsLatencyMs > 0).length;

      const answerTimeSec = parseFloat((totalAnswerTimeMs / 1000).toFixed(2));
      const ttsLatencyMs = validTtsCount > 0
        ? Math.round(totalTtsLatencyMs / validTtsCount)
        : 0;

      return {
        id: session.id,
        language: session.language,
        score: session.score || 0, // Assuming score is nullable
        answerTimeSec,
        ttsLatencyMs,
        finishedAt: session.createdAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Error fetching recent practice summaries:', error);
    // Guarantee no error is thrown, return empty array on failure
    return [];
  }
}
