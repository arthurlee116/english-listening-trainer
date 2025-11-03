import type { StrategyHistoryEntry } from '@/lib/practice/types';

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

class InMemoryCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { value, expiry });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const strategyCache = new InMemoryCache<unknown>();

export function getStrategyCache(key: string) {
  return strategyCache.get(key);
}

export function setStrategyCache(key: string, value: unknown, ttlMs: number = 5 * 60 * 1000): void {
  strategyCache.set(key, value, ttlMs);
}

export function deleteStrategyCache(key: string): void {
  strategyCache.delete(key);
}

// Strategy History Cache
// TTL: 30 minutes for history data (longer than single recommendations)
const STRATEGY_HISTORY_TTL = 30 * 60 * 1000;

const strategyHistoryCache = new InMemoryCache<StrategyHistoryEntry[]>();

/**
 * Get strategy history for a specific user and strategy type
 * @param userId User identifier
 * @param strategyType Type of strategy (ai-recommended or progressive)
 * @returns Cached strategy history entries or undefined if not found
 */
export function getStrategyHistoryCache(userId: string, strategyType: string): StrategyHistoryEntry[] | undefined {
  const cacheKey = `strategy:history:${userId}:${strategyType}`;
  return strategyHistoryCache.get(cacheKey);
}

/**
 * Set strategy history cache for a specific user and strategy type
 * @param userId User identifier
 * @param strategyType Type of strategy
 * @param history Array of strategy history entries
 * @param ttlMs Optional custom TTL (default: 30 minutes)
 */
export function setStrategyHistoryCache(
  userId: string,
  strategyType: string,
  history: StrategyHistoryEntry[],
  ttlMs: number = STRATEGY_HISTORY_TTL
): void {
  const cacheKey = `strategy:history:${userId}:${strategyType}`;
  strategyHistoryCache.set(cacheKey, history, ttlMs);
}

/**
 * Add a single strategy recommendation to history cache
 * Maintains a rolling window of the most recent entries
 * @param userId User identifier
 * @param strategyType Type of strategy
 * @param entry Strategy history entry to add
 * @param maxEntries Maximum number of entries to keep (default: 50)
 */
export function addToStrategyHistoryCache(
  userId: string,
  strategyType: string,
  entry: StrategyHistoryEntry,
  maxEntries: number = 50
): void {
  const cacheKey = `strategy:history:${userId}:${strategyType}`;
  const existingHistory = strategyHistoryCache.get(cacheKey) || [];

  // Add new entry to the beginning and limit to maxEntries
  const updatedHistory = [entry, ...existingHistory].slice(0, maxEntries);

  strategyHistoryCache.set(cacheKey, updatedHistory, STRATEGY_HISTORY_TTL);
}

/**
 * Delete strategy history cache for a specific user and strategy type
 * @param userId User identifier
 * @param strategyType Type of strategy
 */
export function deleteStrategyHistoryCache(userId: string, strategyType: string): void {
  const cacheKey = `strategy:history:${userId}:${strategyType}`;
  strategyHistoryCache.delete(cacheKey);
}

/**
 * Clear all strategy history cache
 * Use with caution - this affects all users and strategy types
 */
export function clearStrategyHistoryCache(): void {
  strategyHistoryCache.clear();
}
