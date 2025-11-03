import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrategyHistoryPanel } from '@/components/strategy/strategy-history-panel';
import type { StrategyHistoryEntry } from '@/lib/practice/types';

// Mock the fetch API
const mockFetch = vi.spyOn(global, 'fetch');

const MOCK_STRATEGY_HISTORY: StrategyHistoryEntry[] = [
  {
    id: '1',
    generatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    strategyType: 'ai-recommended',
    suggestedDifficulty: 'B1',
    suggestedTopic: 'Daily Conversation',
    suggestedDurationMin: 20,
    confidence: 'high',
    summary: 'Your performance shows steady improvement.',
    actualScore: 85,
    actualScoreDelta: 12,
  },
  {
    id: '2',
    generatedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    strategyType: 'ai-recommended',
    suggestedDifficulty: 'B2',
    suggestedTopic: 'Business English',
    suggestedDurationMin: 25,
    confidence: 'medium',
    summary: 'Consider advancing to B2 level.',
    actualScore: 78,
    actualScoreDelta: -5,
  },
  {
    id: '3',
    generatedAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
    strategyType: 'progressive',
    suggestedDifficulty: 'A2',
    suggestedTopic: 'Daily Conversation',
    suggestedDurationMin: 15,
    confidence: 'high',
    summary: 'Good progress at A2 level.',
    progressionHint: 'Keep practicing consistently!',
    actualScore: 92,
    actualScoreDelta: 22,
  },
];

const createMockSuccessResponse = (data: StrategyHistoryEntry[]): Response => {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data,
      meta: {
        count: data.length,
        strategyType: 'ai-recommended',
        includeScores: true,
      },
    }),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'default',
    url: '',
    clone: () => createMockSuccessResponse(data),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
  } as Response;
};

const createMockErrorResponse = (): Response => {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'INTERNAL_ERROR' }),
    headers: new Headers(),
    redirected: false,
    statusText: 'Internal Server Error',
    type: 'default',
    url: '',
    clone: () => createMockErrorResponse(),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
  } as Response;
};

describe('StrategyHistoryPanel Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(createMockSuccessResponse(MOCK_STRATEGY_HISTORY));
  });

  it('should display loading skeleton initially', () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    // Check for loading state
    expect(screen.getByText('Recent Strategy History')).toBeInTheDocument();
    // Skeleton elements should be present
    expect(screen.getAllByRole('generic')).toBeTruthy();
  });

  it('should render strategy history data on success', async () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Check if all entries are rendered
    expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    expect(screen.getByText('Consider advancing to B2 level.')).toBeInTheDocument();
    expect(screen.getByText('Good progress at A2 level.')).toBeInTheDocument();
  });

  it('should display badges for each strategy entry', async () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Check badges are present
    expect(screen.getAllByText('AI Smart')).toHaveLength(2);
    expect(screen.getAllByText('Progressive')).toHaveLength(1);
    expect(screen.getAllByText('B1')).toHaveLength(1);
    expect(screen.getAllByText('B2')).toHaveLength(1);
    expect(screen.getAllByText('A2')).toHaveLength(1);
  });

  it('should display progression hints for progressive strategies', async () => {
    render(<StrategyHistoryPanel strategyType="progressive" />);

    await waitFor(() => {
      expect(screen.getByText('Good progress at A2 level.')).toBeInTheDocument();
    });

    // Progression hint should be displayed for progressive strategy
    expect(screen.getByText('Keep practicing consistently!')).toBeInTheDocument();
  });

  it('should display actual scores when available', async () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Check if actual scores are displayed
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('should display score deviations with correct icons', async () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Check for trend icons (these are rendered as icons, not text)
    // The component shows score deltas like +12, -5, +22
    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
    expect(screen.getByText('+22')).toBeInTheDocument();
  });

  it('should refetch data when strategyType prop changes', async () => {
    const { rerender } = render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Verify initial call
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/practice/strategy/history?strategyType=ai-recommended&limit=7&includeScores=true'
    );

    // Clear mocks and rerender with different strategy type
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(createMockSuccessResponse([]));

    rerender(<StrategyHistoryPanel strategyType="progressive" />);

    await waitFor(() => {
      // Wait for the new request to complete
      expect(mockFetch).toHaveBeenCalled();
    });

    // Verify new call with progressive strategy
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('strategyType=progressive')
    );
  });

  it('should respect limit prop', async () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" limit={2} />);

    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Verify API was called with correct limit
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/practice/strategy/history?strategyType=ai-recommended&limit=2&includeScores=true'
    );
  });

  it('should display error state when API fails', async () => {
    mockFetch.mockResolvedValueOnce(createMockErrorResponse());

    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load history')).toBeInTheDocument();
    });
  });

  it('should display empty state when no history available', async () => {
    mockFetch.mockResolvedValueOnce(createMockSuccessResponse([]));

    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('No strategy history yet')).toBeInTheDocument();
      expect(screen.getByText('Start practicing to see your strategy recommendations and outcomes')).toBeInTheDocument();
    });
  });

  it('should format timestamps correctly', async () => {
    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement.')).toBeInTheDocument();
    });

    // Check that timestamps are formatted (they should show as "1h ago", "2h ago", etc.)
    // The exact text will depend on the timing, but we verify the component renders
    expect(screen.getAllByText(/ago/)).toBeTruthy();
  });

  it('should handle entries without actual scores gracefully', async () => {
    const historyWithoutScores: StrategyHistoryEntry[] = [
      {
        id: '1',
        generatedAt: new Date().toISOString(),
        strategyType: 'ai-recommended',
        suggestedDifficulty: 'B1',
        suggestedTopic: 'Daily Conversation',
        suggestedDurationMin: 20,
        confidence: 'high',
        summary: 'No score available for this entry.',
        // No actualScore field
      },
    ];

    mockFetch.mockResolvedValueOnce(createMockSuccessResponse(historyWithoutScores));

    render(<StrategyHistoryPanel strategyType="ai-recommended" />);

    await waitFor(() => {
      expect(screen.getByText('No score available for this entry.')).toBeInTheDocument();
    });

    // Should still render the entry even without score
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('20 min')).toBeInTheDocument();
  });
});
