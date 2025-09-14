/**
 * Memory management utilities for the i18n system
 */

// WeakMap for component-specific caches to prevent memory leaks
const componentCaches = new WeakMap<object, Map<string, string>>();

// Global cache cleanup configuration
interface CacheConfig {
  maxSize: number;
  cleanupInterval: number;
  maxAge: number; // in milliseconds
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000,
  cleanupInterval: 300000, // 5 minutes
  maxAge: 600000, // 10 minutes
};

// Cache entry with timestamp
interface CacheEntry {
  value: string;
  timestamp: number;
  accessCount: number;
}

// Enhanced cache with automatic cleanup
export class ManagedCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  set(key: string, value: string): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access count
    entry.accessCount++;
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Evict oldest entries (LRU-like behavior)
  private evictOldest(): void {
    const entriesToRemove = Math.floor(this.config.maxSize * 0.1); // Remove 10%
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        // Sort by access count (ascending) then by timestamp (ascending)
        if (a[1].accessCount !== b[1].accessCount) {
          return a[1].accessCount - b[1].accessCount;
        }
        return a[1].timestamp - b[1].timestamp;
      });

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.maxAge) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired i18n cache entries`);
    }
  }

  // Start automatic cleanup timer
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // Stop cleanup timer (call when component unmounts)
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    let totalAccess = 0;
    let oldestTimestamp = now;
    let newestTimestamp = 0;

    entries.forEach(entry => {
      totalAccess += entry.accessCount;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
    });

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: entries.length > 0 ? totalAccess / entries.length : 0,
      oldestEntry: oldestTimestamp === now ? 0 : now - oldestTimestamp,
      newestEntry: now - newestTimestamp,
    };
  }
}

// Global managed caches
export const translationCache = new ManagedCache({
  maxSize: 500,
  cleanupInterval: 300000, // 5 minutes
  maxAge: 600000, // 10 minutes
});

export const formatCache = new ManagedCache({
  maxSize: 1000,
  cleanupInterval: 300000, // 5 minutes
  maxAge: 300000, // 5 minutes (shorter for format cache)
});

// Component-specific cache management
export function getComponentCache(component: object): Map<string, string> {
  if (!componentCaches.has(component)) {
    componentCaches.set(component, new Map());
  }
  return componentCaches.get(component)!;
}

// Memory pressure detection
export function detectMemoryPressure(): boolean {
  if (typeof window !== 'undefined' && 'memory' in performance) {
    const memInfo = (performance as any).memory;
    if (memInfo) {
      const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
      return usedRatio > 0.8; // 80% threshold
    }
  }
  return false;
}

// Emergency cache cleanup
export function emergencyCleanup(): void {
  console.warn('🚨 Emergency i18n cache cleanup triggered');
  
  translationCache.clear();
  formatCache.clear();
  
  // Clear component caches (they'll be recreated as needed)
  // Note: WeakMap doesn't have a clear method, but entries will be GC'd
  // when components are unmounted
  
  // Force garbage collection if available (development only)
  if (process.env.NODE_ENV === 'development' && 'gc' in window) {
    (window as any).gc();
  }
}

// Monitor memory usage and trigger cleanup if needed
export function startMemoryMonitoring(): void {
  if (typeof window === 'undefined') return;

  setInterval(() => {
    if (detectMemoryPressure()) {
      console.warn('⚠️ High memory usage detected, performing cache cleanup');
      
      // Clear half of each cache
      const translationStats = translationCache.getStats();
      const formatStats = formatCache.getStats();
      
      if (translationStats.size > 100) {
        // Clear older entries
        translationCache.clear();
      }
      
      if (formatStats.size > 200) {
        formatCache.clear();
      }
    }
  }, 60000); // Check every minute
}

// Cleanup function for app shutdown
export function cleanup(): void {
  translationCache.destroy();
  formatCache.destroy();
}

// Development tools
export function logMemoryStats(): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('💾 I18n Memory Statistics');
    console.log('Translation Cache:', translationCache.getStats());
    console.log('Format Cache:', formatCache.getStats());
    
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo) {
        console.log('Browser Memory:', {
          used: `${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
          usage: `${((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100).toFixed(1)}%`,
        });
      }
    }
    console.groupEnd();
  }
}