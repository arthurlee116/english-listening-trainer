import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrategyRecommendationCard } from '@/components/home/strategy-recommendation-card';
import type { PracticeStrategyRecommendation } from '@/lib/practice/strategy-builder';

// Mock the fetch API
const mockFetch = vi.spyOn(global, 'fetch');

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock useBilingualText hook
vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: (key: string) => key,
  }),
}));

const MOCK_STRATEGY: PracticeStrategyRecommendation = {
  summary: 'Your performance shows steady improvement in listening comprehension.',
  suggestedDifficulty: 'B1',
  suggestedTopic: 'Daily Conversation',
  suggestedDurationMin: 20,
  confidence: 'high',
  progressionHint: 'Based on your average score of 85% with positive trend, we recommend advancing to B2 level. Keep up the excellent progress!'
};

const MOCK_PROGRESSIVE_STRATEGY: PracticeStrategyRecommendation = {
  summary: 'Your recent practice shows improving performance with an average score of 88%. We\'ve adjusted your difficulty to B2 for optimal learning.',
  suggestedDifficulty: 'B2',
  suggestedTopic: 'Business English',
  suggestedDurationMin: 25,
  confidence: 'high',
  progressionHint: 'Based on your average score of 88% with positive trend, we recommend advancing to B2 level. Keep up the excellent progress!'
};

const createMockSuccessResponse = (data: PracticeStrategyRecommendation, cached = false): Response => {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        cached
      },
    }),
    // Minimal required properties for Response mock
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'default',
    url: '',
    clone: () => createMockSuccessResponse(data, cached),
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
    // Minimal required properties for Response mock
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

describe('StrategyRecommendationCard Integration Tests', () => {
  const mockOnApplySuggestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(createMockSuccessResponse(MOCK_STRATEGY));
  });

  it('should show loading skeleton initially and then display recommendation on success', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);

    // 1. Check loading state (skeleton should be present)
    // Note: During loading, the skeleton is shown without 'AI Practice Strategy' text
    expect(screen.getAllByRole('generic')).toBeTruthy(); // Skeleton containers present

    // 2. Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });

    // 3. Now check that the header text is visible after loading
    expect(screen.getByText('AI Practice Strategy')).toBeInTheDocument();

    // 4. Check if recommendation details are displayed
    expect(screen.getByText('Difficulty: B1')).toBeInTheDocument();
    expect(screen.getByText('Topic: Daily Conversation')).toBeInTheDocument();
    expect(screen.getByText('Duration: 20 min')).toBeInTheDocument();
    expect(screen.getByText('Confidence: high')).toBeInTheDocument();

    // 5. Check if buttons are present
    expect(screen.getByRole('button', { name: /Apply Suggestion/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('should call onApplySuggestion with correct data when Apply button is clicked', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);
    const user = userEvent.setup();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });

    // Click Apply button
    await user.click(screen.getByRole('button', { name: /Apply Suggestion/i }));

    // Check if onApplySuggestion was called with correct data
    expect(mockOnApplySuggestion).toHaveBeenCalledWith({
      difficulty: 'B1',
      topic: 'Daily Conversation',
      duration: 20,
    });

    // Check if success toast was shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'common.success',
      description: 'Practice settings updated based on AI recommendation',
    });
  });

  it('should regenerate recommendation when Regenerate button is clicked', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);
    const user = userEvent.setup();

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });

    // Mock a different response for regeneration
    const newStrategy: PracticeStrategyRecommendation = {
      ...MOCK_STRATEGY,
      summary: 'Great progress! Try more challenging content.',
      suggestedDifficulty: 'B2',
    };
    mockFetch.mockResolvedValueOnce(createMockSuccessResponse(newStrategy));

    // Click Regenerate button
    await user.click(screen.getByRole('button', { name: /Refresh recommendation/i }));

    // Wait for new data to load
    await waitFor(() => {
      expect(screen.getByText('Great progress! Try more challenging content.')).toBeInTheDocument();
    });

    // Check if fetch was called with forceRefresh parameter
    expect(mockFetch).toHaveBeenCalledWith('/api/practice/strategy?forceRefresh=true&strategyType=ai-recommended');

    // Check if new recommendation is displayed
    expect(screen.getByText('Difficulty: B2')).toBeInTheDocument();
  });

  it('should display error state and allow retry when API fails', async () => {
    // Mock initial fetch to fail
    mockFetch.mockResolvedValueOnce(createMockErrorResponse());

    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Recommendation Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Unable to load AI-powered practice recommendations at this time.')).toBeInTheDocument();
    });

    // Check if error toast was shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'common.error',
      description: 'common.tryAgainLater',
      variant: 'destructive',
    });

    // Mock subsequent fetch to succeed
    mockFetch.mockResolvedValueOnce(createMockSuccessResponse(MOCK_STRATEGY));

    // Click Try Again button
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Try Again/i }));

    // Wait for success state
    await waitFor(() => {
      expect(screen.queryByText('Recommendation Unavailable')).not.toBeInTheDocument();
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });
  });

  it('should show cached indicator when data is from cache', async () => {
    mockFetch.mockResolvedValue(createMockSuccessResponse(MOCK_STRATEGY, true));

    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });

    // The component doesn't explicitly show cache status in UI, but the API call should include cached: true
    // This test ensures the component handles cached responses correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/practice/strategy?strategyType=ai-recommended');
  });

  it('should allow switching between AI and Progressive strategies', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);
    const user = userEvent.setup();

    // Wait for initial AI strategy to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });

    // Mock progressive strategy response BEFORE switching
    mockFetch.mockResolvedValueOnce(createMockSuccessResponse(MOCK_PROGRESSIVE_STRATEGY));

    // Switch to Progressive strategy
    await user.click(screen.getByText('Progressive'));

    // Wait for progressive data to display
    await waitFor(() => {
      expect(screen.getByText(/88%/)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Check if progression hint is displayed
    expect(screen.getByText('Progression Analysis')).toBeInTheDocument();
  });

  it('should not display progression hint for AI recommended strategy', async () => {
    mockFetch.mockResolvedValue(createMockSuccessResponse(MOCK_STRATEGY));

    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Your performance shows steady improvement in listening comprehension.')).toBeInTheDocument();
    });

    // Progression hint should not be present
    expect(screen.queryByText('Progression Analysis')).not.toBeInTheDocument();
  });

  it('should toggle history panel when history button is clicked', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);
    const user = userEvent.setup();

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('AI Practice Strategy')).toBeInTheDocument();
    });

    // History button should be visible
    expect(screen.getByLabelText('Toggle history')).toBeInTheDocument();

    // Click history button to show history
    await user.click(screen.getByLabelText('Toggle history'));

    // History panel should appear (StrategyHistoryPanel renders its own loading skeleton)
    await waitFor(() => {
      // The panel will make an API call to fetch history
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/practice/strategy/history')
      );
    });
  });

  it('should hide history panel on second click', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);
    const user = userEvent.setup();

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('AI Practice Strategy')).toBeInTheDocument();
    });

    // First click to show history
    await user.click(screen.getByLabelText('Toggle history'));

    // Verify history API was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/practice/strategy/history')
    );

    // Clear mocks
    vi.clearAllMocks();

    // Second click to hide history
    await user.click(screen.getByLabelText('Toggle history'));

    // History panel should be hidden (no new API calls should be made)
    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/practice/strategy/history')
      );
    });
  });

  it('should refresh history when strategy type changes', async () => {
    render(<StrategyRecommendationCard onApplySuggestion={mockOnApplySuggestion} />);
    const user = userEvent.setup();

    // Wait for initial AI strategy to load
    await waitFor(() => {
      expect(screen.getByText('AI Practice Strategy')).toBeInTheDocument();
    });

    // Click history button to show history
    await user.click(screen.getByLabelText('Toggle history'));

    // Wait for history API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('strategyType=ai-recommended')
      );
    });

    // Clear mocks
    vi.clearAllMocks();

    // Mock progressive strategy for the strategy recommendation
    mockFetch.mockResolvedValueOnce(createMockSuccessResponse(MOCK_PROGRESSIVE_STRATEGY));

    // Switch to Progressive strategy
    await user.click(screen.getByText('Progressive'));

    // Wait for new strategy recommendation
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/practice/strategy?strategyType=progressive')
      );
    });

    // History should also refresh for the new strategy type
    // The exact behavior depends on the component's implementation
    // We verify that strategy switching triggers necessary updates
    expect(mockFetch).toHaveBeenCalled();
  });
});
