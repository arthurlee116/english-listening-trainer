// News module exports
export { fetchAllNews, RSS_SOURCES, CATEGORY_LABELS } from './rss-fetcher'
export type { FetchedArticle, RSSSource, NewsCategory } from './rss-fetcher'

export { processAndStoreNews, getActiveTopics, cleanupExpiredData } from './news-processor'

export { generateTranscriptsForTopic, generateAllPendingTranscripts, getTranscript } from './transcript-generator'

export { refreshNews, shouldRefresh, initScheduler, getLastRefreshTime, getNextRefreshTime, isCurrentlyRefreshing } from './scheduler'

export { searchNewsForTopic, buildEnhancedTranscriptPrompt } from './exa-search'
export type { NewsEnhancementResult } from './exa-search'

export { initNewsSystem } from './init'
