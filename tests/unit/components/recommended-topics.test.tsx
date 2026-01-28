import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecommendedTopics } from '@/components/home/recommended-topics'

vi.mock('@/hooks/use-bilingual-text', () => ({
  useBilingualText: () => ({
    t: (key: string) => key,
  })
}))

vi.mock('@/components/providers/language-provider', () => ({
  useLanguage: () => ({ currentLanguage: 'en' })
}))

vi.mock('@/components/ui/bilingual-text', () => ({
  BilingualText: ({ translationKey }: { translationKey: string }) => (
    <span>{translationKey}</span>
  )
}))

describe('RecommendedTopics', () => {
  it('renders topics and triggers selection handlers', async () => {
    const user = userEvent.setup()
    const onDurationChange = vi.fn()
    const onSelectTopic = vi.fn()
    const onRefresh = vi.fn()

    const mockResponse = {
      topics: {
        B1: [
          {
            id: 'topic-1',
            topic: 'Travel Tips',
            briefSummary: 'Short summary',
            difficulty: 'B1',
            article: {
              source: 'BBC',
              sourceUrl: 'https://example.com',
              title: 'Title',
              publishedAt: new Date().toISOString(),
              category: 'tech'
            },
            transcripts: [{ duration: 2, wordCount: 200 }]
          }
        ]
      },
      categories: {
        tech: { en: 'Tech', zh: '科技' }
      },
      lastRefresh: new Date().toISOString()
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    })
    vi.stubGlobal('fetch', fetchMock as typeof fetch)

    render(
      <RecommendedTopics
        difficulty="B1"
        selectedDuration={2}
        onDurationChange={onDurationChange}
        onSelectTopic={onSelectTopic}
        onRefresh={onRefresh}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Travel Tips')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '3news.minutes' }))
    expect(onDurationChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByText('Travel Tips'))
    expect(onSelectTopic).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'topic-1' }),
      2
    )
  })
})
