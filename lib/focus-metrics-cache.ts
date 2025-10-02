import { FocusAreaStats, FocusArea, WrongAnswerItem } from './types'
import { PracticeSession, computeFocusStats, selectRecommendedFocusAreas } from './focus-metrics'

// Cache storage key
const CACHE_KEY = 'english-listening-focus-area-cache'
const CACHE_VERSION = '1.0.0'
const CACHE_EXPIRY_HOURS = 1 // Cache expires after 1 hour

// Cache data structure
interface FocusAreaCache {
  stats: FocusAreaStats
  recommendations: FocusArea[]
  lastCalculated: string
  dataVersion: string
  cacheVersion: string
  // Metadata for cache validation
  wrongAnswersCount: number
  sessionsCount: number
  lastWrongAnswerAt?: string
  lastSessionAt?: string
}

// Generate data version hash based on input data
function generateDataVersion(
  wrongAnswers: WrongAnswerItem[],
  sessions: PracticeSession[]
): string {
  const wrongAnswersHash = wrongAnswers.length > 0 
    ? `${wrongAnswers.length}_${wrongAnswers[wrongAnswers.length - 1]?.answer.attemptedAt || ''}`
    : '0'
  
  const sessionsHash = sessions.length > 0
    ? `${sessions.length}_${sessions[sessions.length - 1]?.createdAt || ''}`
    : '0'
  
  return `${wrongAnswersHash}_${sessionsHash}`
}

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

// Get cached data with validation
function getCachedData(): FocusAreaCache | null {
  if (!isLocalStorageAvailable()) {
    return null
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) {
      return null
    }

    const parsed = JSON.parse(cached) as FocusAreaCache
    
    // Check cache version compatibility
    if (!parsed.cacheVersion || parsed.cacheVersion !== CACHE_VERSION) {
      console.warn('Focus area cache version mismatch, invalidating cache')
      return null
    }

    // Check if cache has expired
    const cacheAge = Date.now() - new Date(parsed.lastCalculated).getTime()
    const maxAge = CACHE_EXPIRY_HOURS * 60 * 60 * 1000
    
    if (cacheAge > maxAge) {
      console.debug('Focus area cache expired, will recalculate')
      return null
    }

    // Validate cache structure
    if (!parsed.stats || !parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      console.warn('Invalid focus area cache structure, invalidating cache')
      return null
    }

    return parsed
  } catch (error) {
    console.error('Failed to parse focus area cache:', error)
    return null
  }
}

// Save data to cache
function saveCacheData(cache: FocusAreaCache): boolean {
  if (!isLocalStorageAvailable()) {
    return false
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    return true
  } catch (error) {
    console.error('Failed to save focus area cache:', error)
    return false
  }
}

// Check if cached data is still valid for given input
function isCacheValid(
  cache: FocusAreaCache,
  wrongAnswers: WrongAnswerItem[],
  sessions: PracticeSession[]
): boolean {
  // Check data version
  const currentDataVersion = generateDataVersion(wrongAnswers, sessions)
  if (cache.dataVersion !== currentDataVersion) {
    return false
  }

  // Check counts match
  if (cache.wrongAnswersCount !== wrongAnswers.length || 
      cache.sessionsCount !== sessions.length) {
    return false
  }

  // Check timestamps match
  const lastWrongAnswer = wrongAnswers.length > 0 
    ? wrongAnswers[wrongAnswers.length - 1]?.answer.attemptedAt
    : undefined
  const lastSession = sessions.length > 0 
    ? sessions[sessions.length - 1]?.createdAt
    : undefined

  if (cache.lastWrongAnswerAt !== lastWrongAnswer || 
      cache.lastSessionAt !== lastSession) {
    return false
  }

  return true
}

/**
 * Focus Area Metrics Cache Service
 * Provides caching for expensive focus area calculations
 */
export class FocusMetricsCache {
  /**
   * Get focus area statistics with caching
   * Returns cached results if valid, otherwise computes and caches new results
   */
  static getStats(
    wrongAnswers: WrongAnswerItem[],
    sessions: PracticeSession[]
  ): FocusAreaStats {
    // Try to get cached data
    const cached = getCachedData()
    
    if (cached && isCacheValid(cached, wrongAnswers, sessions)) {
      console.debug('Using cached focus area statistics')
      return cached.stats
    }

    // Cache miss or invalid - compute new stats
    console.debug('Computing new focus area statistics')
    const stats = computeFocusStats(wrongAnswers, sessions)
    
    // Cache the results
    this.updateCache(stats, wrongAnswers, sessions)
    
    return stats
  }

  /**
   * Get recommended focus areas with caching
   * Returns cached recommendations if valid, otherwise computes and caches new ones
   */
  static getRecommendations(
    wrongAnswers: WrongAnswerItem[],
    sessions: PracticeSession[],
    maxRecommendations: number = 3
  ): FocusArea[] {
    // Try to get cached data
    const cached = getCachedData()
    
    if (cached && isCacheValid(cached, wrongAnswers, sessions)) {
      console.debug('Using cached focus area recommendations')
      // Return up to the requested number of recommendations
      return cached.recommendations.slice(0, maxRecommendations)
    }

    // Cache miss or invalid - compute new recommendations
    console.debug('Computing new focus area recommendations')
    const stats = computeFocusStats(wrongAnswers, sessions)
    const recommendations = selectRecommendedFocusAreas(stats, maxRecommendations)
    
    // Cache the results
    this.updateCache(stats, wrongAnswers, sessions, recommendations)
    
    return recommendations
  }

  /**
   * Get both stats and recommendations in a single call with caching
   * More efficient when both are needed
   */
  static getStatsAndRecommendations(
    wrongAnswers: WrongAnswerItem[],
    sessions: PracticeSession[],
    maxRecommendations: number = 3
  ): { stats: FocusAreaStats; recommendations: FocusArea[] } {
    // Try to get cached data
    const cached = getCachedData()
    
    if (cached && isCacheValid(cached, wrongAnswers, sessions)) {
      console.debug('Using cached focus area data')
      return {
        stats: cached.stats,
        recommendations: cached.recommendations.slice(0, maxRecommendations)
      }
    }

    // Cache miss or invalid - compute new data
    console.debug('Computing new focus area data')
    const stats = computeFocusStats(wrongAnswers, sessions)
    const recommendations = selectRecommendedFocusAreas(stats, maxRecommendations)
    
    // Cache the results
    this.updateCache(stats, wrongAnswers, sessions, recommendations)
    
    return { stats, recommendations }
  }

  /**
   * Update cache with new data
   */
  private static updateCache(
    stats: FocusAreaStats,
    wrongAnswers: WrongAnswerItem[],
    sessions: PracticeSession[],
    recommendations?: FocusArea[]
  ): void {
    // Generate recommendations if not provided
    const recs = recommendations || selectRecommendedFocusAreas(stats, 3)
    
    const cache: FocusAreaCache = {
      stats,
      recommendations: recs,
      lastCalculated: new Date().toISOString(),
      dataVersion: generateDataVersion(wrongAnswers, sessions),
      cacheVersion: CACHE_VERSION,
      wrongAnswersCount: wrongAnswers.length,
      sessionsCount: sessions.length,
      lastWrongAnswerAt: wrongAnswers.length > 0 
        ? wrongAnswers[wrongAnswers.length - 1]?.answer.attemptedAt
        : undefined,
      lastSessionAt: sessions.length > 0 
        ? sessions[sessions.length - 1]?.createdAt
        : undefined
    }

    saveCacheData(cache)
  }

  /**
   * Invalidate the cache (force recalculation on next access)
   */
  static invalidateCache(): boolean {
    if (!isLocalStorageAvailable()) {
      return false
    }

    try {
      localStorage.removeItem(CACHE_KEY)
      console.debug('Focus area cache invalidated')
      return true
    } catch (error) {
      console.error('Failed to invalidate focus area cache:', error)
      return false
    }
  }

  /**
   * Check if cache exists and is valid for given data
   */
  static isCacheValid(
    wrongAnswers: WrongAnswerItem[],
    sessions: PracticeSession[]
  ): boolean {
    const cached = getCachedData()
    return cached ? isCacheValid(cached, wrongAnswers, sessions) : false
  }

  /**
   * Get cache statistics and metadata
   */
  static getCacheInfo(): {
    exists: boolean
    lastCalculated?: string
    cacheAge?: number
    dataVersion?: string
    wrongAnswersCount?: number
    sessionsCount?: number
    storageAvailable: boolean
  } {
    const cached = getCachedData()
    
    if (!cached) {
      return {
        exists: false,
        storageAvailable: isLocalStorageAvailable()
      }
    }

    const cacheAge = Date.now() - new Date(cached.lastCalculated).getTime()
    
    return {
      exists: true,
      lastCalculated: cached.lastCalculated,
      cacheAge,
      dataVersion: cached.dataVersion,
      wrongAnswersCount: cached.wrongAnswersCount,
      sessionsCount: cached.sessionsCount,
      storageAvailable: isLocalStorageAvailable()
    }
  }

  /**
   * Preload cache with given data (useful for warming up cache)
   */
  static preloadCache(
    wrongAnswers: WrongAnswerItem[],
    sessions: PracticeSession[]
  ): void {
    // Check if cache is already valid
    if (this.isCacheValid(wrongAnswers, sessions)) {
      console.debug('Cache already valid, skipping preload')
      return
    }

    // Compute and cache data
    console.debug('Preloading focus area cache')
    const stats = computeFocusStats(wrongAnswers, sessions)
    const recommendations = selectRecommendedFocusAreas(stats, 3)
    
    this.updateCache(stats, wrongAnswers, sessions, recommendations)
  }

  /**
   * Get cache size in bytes (approximate)
   */
  static getCacheSize(): number {
    if (!isLocalStorageAvailable()) {
      return 0
    }

    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? new Blob([cached]).size : 0
    } catch {
      return 0
    }
  }
}

// Export default instance for convenience
export default FocusMetricsCache