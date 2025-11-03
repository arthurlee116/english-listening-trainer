import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PracticeHistoryDashboard from '@/components/results/practice-history-dashboard';
import { PracticeSummaryPoint } from '@/lib/practice/history-summary';

// Mock the fetch API
const mockFetch = vi.spyOn(global, 'fetch');

// Mock data
const MOCK_DATA: PracticeSummaryPoint[] = [
  { id: 's1', language: 'en-US', score: 90, answerTimeSec: 10.5, ttsLatencyMs: 400, finishedAt: new Date().toISOString() },
  { id: 's2', language: 'zh-CN', score: 80, answerTimeSec: 12.0, ttsLatencyMs: 500, finishedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 's3', language: 'en-US', score: 70, answerTimeSec: 15.0, ttsLatencyMs: 600, finishedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 's4', language: 'es-ES', score: 60, answerTimeSec: 18.0, ttsLatencyMs: 700, finishedAt: new Date(Date.now() - 10800000).toISOString() },
];

const createMockSuccessResponse = (data: PracticeSummaryPoint[]): Response => {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data: data,
      meta: { generatedAt: new Date().toISOString() },
    }),
    // Minimal required properties for Response mock
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

describe('PracticeHistoryDashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for 'all' languages
    mockFetch.mockImplementation((url) => {
      const urlString = url.toString();
      if (urlString.includes('language=zh-CN')) {
        return Promise.resolve(createMockSuccessResponse(MOCK_DATA.filter(p => p.language === 'zh-CN')));
      }
      if (urlString.includes('language=en-US')) {
        return Promise.resolve(createMockSuccessResponse(MOCK_DATA.filter(p => p.language === 'en-US')));
      }
      // Initial fetch returns top 3 sessions (simulating backend limit)
      return Promise.resolve(createMockSuccessResponse(MOCK_DATA.slice(0, 3)));
    });
  });

  it('should show loading state initially and then display data on success', async () => {
    render(<PracticeHistoryDashboard />);

    // 1. Check loading state (CardTitle is present)
    expect(screen.getByText('多语言测验回顾')).toBeInTheDocument();

    // 2. Wait for data to load (wait for a success state element)
    await waitFor(() => {
      expect(screen.getByText('平均听力得分')).toBeInTheDocument();
    });

    // 3. Check if metrics are displayed (Averages for top 3: 90+80+70 = 240/3 = 80)
    expect(screen.getByText('80%')).toBeInTheDocument(); // Average score
    expect(screen.getByText('12.5s')).toBeInTheDocument(); // Average answer time (10.5 + 12.0 + 15.0) / 3 = 12.5
    expect(screen.getByText('500ms')).toBeInTheDocument(); // Average TTS latency (400 + 500 + 600) / 3 = 500

    // 4. Check if recent sessions are listed
    expect(screen.getByText('最近测验详情')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument(); // Total sessions displayed
    expect(screen.getByText('得分: 90%')).toBeInTheDocument(); // Newest session score (s1)
  });

  it('should allow filtering by language and refetch data', async () => {
    render(<PracticeHistoryDashboard />);
    const user = userEvent.setup();

    // Wait for initial load
    await waitFor(() => expect(screen.getByText('所有语言')).toBeInTheDocument());

    // 1. Open the Select dropdown
    await user.click(screen.getByRole('combobox'));

    // 2. Select 'zh-CN'
    await user.click(screen.getByRole('option', { name: 'zh-CN' }));

    // 3. Wait for the component to re-render with filtered data (only s2)
    await waitFor(() => {
      expect(screen.getByText('zh-CN')).toBeInTheDocument();
    });

    // 4. Check if fetch was called with the correct parameter
    expect(mockFetch).toHaveBeenCalledWith('/api/practice/history/summary?language=zh-CN');

    // 5. Check if metrics reflect only the zh-CN session (s2: score 80, time 12.0, tts 500)
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('12.0s')).toBeInTheDocument();
    expect(screen.getByText('500ms')).toBeInTheDocument();
    expect(screen.getByText('基于最近 1 次测验')).toBeInTheDocument();
  });

  it('should display empty state when no data is returned for the selected filter', async () => {
    // Mock fetch to return empty array for 'es-ES'
    mockFetch.mockImplementation((url) => {
      const urlString = url.toString();
      if (urlString.includes('language=es-ES')) {
        // For the empty state test, we need to mock the response for the specific language filter
        return Promise.resolve(createMockSuccessResponse([]));
      }
      if (urlString.includes('language=zh-CN')) {
        return Promise.resolve(createMockSuccessResponse(MOCK_DATA.filter(p => p.language === 'zh-CN')));
      }
      if (urlString.includes('language=en-US')) {
        return Promise.resolve(createMockSuccessResponse(MOCK_DATA.filter(p => p.language === 'en-US')));
      }
      return Promise.resolve(createMockSuccessResponse(MOCK_DATA.slice(0, 3)));
    });

    render(<PracticeHistoryDashboard />);
    const user = userEvent.setup();

    // Wait for initial load
    await waitFor(() => expect(screen.getByText('所有语言')).toBeInTheDocument());

    // Select 'es-ES' (which returns empty data)
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'es-ES' })); // Select the option from the dropdown

    // Wait for empty state message
    await waitFor(() => {
      expect(screen.getByText('暂无 es-ES 的测验历史记录。')).toBeInTheDocument();
    });

    // Check that metrics are not displayed
    expect(screen.queryByText('平均听力得分')).not.toBeInTheDocument();
  });

  it('should display error state and allow retry', async () => {
    // 1. Mock initial fetch to fail
    mockFetch.mockResolvedValueOnce(createMockErrorResponse());

    render(<PracticeHistoryDashboard />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText('无法加载最近的测验回顾数据。')).toBeInTheDocument();
    });

    // 2. Mock subsequent fetch to succeed
    mockFetch.mockResolvedValueOnce(createMockSuccessResponse(MOCK_DATA.slice(0, 3)));

    // 3. Click retry button
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /重试/i }));

    // 4. Wait for success state
    await waitFor(() => {
      expect(screen.queryByText('加载失败')).not.toBeInTheDocument();
      expect(screen.getByText('平均听力得分')).toBeInTheDocument();
    });
  });
});
