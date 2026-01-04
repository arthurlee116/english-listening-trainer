'use client'

import { useState, useEffect } from 'react'
import { Newspaper, ExternalLink, RefreshCw, Clock, Loader2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BilingualText } from '@/components/ui/bilingual-text'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { useLanguage } from '@/components/providers/language-provider'
import type { DifficultyLevel } from '@/lib/types'

type NewsCategory = 'general' | 'tech' | 'business' | 'science' | 'world'

interface NewsSource {
  source: string
  sourceUrl: string
  title: string
  publishedAt: string
  category?: string
}

interface TopicTranscript {
  duration: number
  wordCount: number
}

export interface RecommendedTopic {
  id: string
  topic: string
  briefSummary: string
  difficulty: string
  article: NewsSource
  transcripts: TopicTranscript[]
}

interface CategoryLabels {
  [key: string]: { en: string; zh: string }
}

interface RecommendedTopicsProps {
  difficulty: DifficultyLevel | ''
  selectedDuration: number
  onDurationChange: (durationMinutes: number) => void
  onSelectTopic: (topic: RecommendedTopic, durationMinutes: number) => void
  onRefresh: () => void
}

const DURATION_OPTIONS = [1, 2, 3, 5]

export function RecommendedTopics({
  difficulty,
  selectedDuration,
  onDurationChange,
  onSelectTopic,
  onRefresh
}: RecommendedTopicsProps) {
  const { t } = useBilingualText()
  const { currentLanguage } = useLanguage()
  const [topics, setTopics] = useState<Record<string, RecommendedTopic[]>>({})
  const [categories, setCategories] = useState<CategoryLabels>({})
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | ''>('')

  useEffect(() => {
    fetchTopics()
  }, [selectedCategory])

  function normalizeTopics(input: unknown): Record<string, RecommendedTopic[]> {
    if (!input || typeof input !== 'object') return {}

    const result: Record<string, RecommendedTopic[]> = {}

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (!Array.isArray(value)) {
        result[key] = []
        continue
      }

      result[key] = value.map((topic) => {
        if (!topic || typeof topic !== 'object') return topic as RecommendedTopic

        const raw = topic as Partial<RecommendedTopic> & Record<string, unknown>
        const transcripts = Array.isArray(raw.transcripts) ? (raw.transcripts as TopicTranscript[]) : []

        return {
          ...(raw as RecommendedTopic),
          transcripts,
        }
      })
    }

    return result
  }

  async function fetchTopics() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      const res = await fetch(`/api/news/topics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTopics(normalizeTopics(data.topics))
        setCategories(data.categories || {})
        setLastRefresh(data.lastRefresh)
      }
    } catch (error) {
      console.error('Failed to fetch topics:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/news/refresh', { method: 'POST' })
      if (res.ok) {
        await fetchTopics()
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setRefreshing(false)
    }
  }

  function formatTimeAgo(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (hours < 1) return t('news.justNow')
    if (hours < 24) return `${hours}${t('news.hoursAgo')}`
    return `${Math.floor(hours / 24)}${t('news.daysAgo')}`
  }

  function getCategoryLabel(cat: string) {
    const labels = categories[cat]
    if (!labels) return cat
    return currentLanguage === 'zh' ? labels.zh : labels.en
  }

  const currentTopics = difficulty ? topics[difficulty] || [] : []
  const hasTopics = Object.keys(topics).length > 0

  if (loading && !hasTopics) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span><BilingualText translationKey="news.loading" /></span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-sky-600" />
          <h3 className="font-semibold text-slate-700">
            <BilingualText translationKey="news.recommendedTopics" />
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-500">
              {formatTimeAgo(lastRefresh)}
            </span>
          )}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="ghost"
            size="sm"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        <Button
          variant={selectedCategory === '' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('')}
          className="px-3"
        >
          {currentLanguage === 'zh' ? '全部' : 'All'}
        </Button>
        {Object.entries(categories).map(([cat, labels]) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat as NewsCategory)}
            className="px-3"
          >
            {currentLanguage === 'zh' ? labels.zh : labels.en}
          </Button>
        ))}
      </div>

      {/* Duration selector */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <div className="flex gap-1">
          {DURATION_OPTIONS.map(d => (
            <Button
              key={d}
              variant={selectedDuration === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => onDurationChange(d)}
              className="px-3"
            >
              {d}{t('news.minutes')}
            </Button>
          ))}
        </div>
      </div>

      {!hasTopics ? (
        <div className="text-center space-y-4 py-4">
          <p className="text-slate-600"><BilingualText translationKey="news.noTopics" /></p>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            <BilingualText translationKey="news.fetchNews" />
          </Button>
        </div>
      ) : !difficulty ? (
        <p className="text-sm text-slate-500 text-center py-4">
          <BilingualText translationKey="news.selectDifficultyFirst" />
        </p>
      ) : currentTopics.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">
          <BilingualText translationKey="news.noTopicsForDifficulty" />
        </p>
      ) : (
        <div className="space-y-3">
          {currentTopics.map(topic => {
            const hasTranscript = topic.transcripts.some(t => t.duration === selectedDuration)
            return (
              <div
                key={topic.id}
                className={`p-4 rounded-lg border transition-colors cursor-pointer hover:bg-sky-50 hover:border-sky-200 ${
                  hasTranscript ? '' : 'opacity-80'
                }`}
                onClick={() => onSelectTopic(topic, selectedDuration)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 truncate">{topic.topic}</h4>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{topic.briefSummary}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {topic.article.source}
                      </Badge>
                      {!hasTranscript && (
                        <Badge variant="secondary" className="text-xs">
                          {currentLanguage === 'zh' ? '需生成' : 'Generate'}
                        </Badge>
                      )}
                      {topic.article.category && (
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(topic.article.category)}
                        </Badge>
                      )}
                      <span>{formatTimeAgo(topic.article.publishedAt)}</span>
                      <a
                        href={topic.article.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                      >
                        <BilingualText translationKey="news.viewOriginal" />
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
