/**
 * Performance monitoring utilities for the i18n system
 */

interface PerformanceMetrics {
  translationCacheHits: number;
  translationCacheMisses: number;
  formatCacheHits: number;
  formatCacheMisses: number;
  translationLoadTime: number;
  averageTranslationTime: number;
  memoryUsage: {
    translationCacheSize: number;
    formatCacheSize: number;
  };
}

class I18nPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    translationCacheHits: 0,
    translationCacheMisses: 0,
    formatCacheHits: 0,
    formatCacheMisses: 0,
    translationLoadTime: 0,
    averageTranslationTime: 0,
    memoryUsage: {
      translationCacheSize: 0,
      formatCacheSize: 0,
    },
  };

  private translationTimes: number[] = [];
  private startTime: number = 0;

  // Start timing a translation operation
  startTranslation(): void {
    this.startTime = performance.now();
  }

  // End timing a translation operation
  endTranslation(): void {
    if (this.startTime > 0) {
      const duration = performance.now() - this.startTime;
      this.translationTimes.push(duration);
      
      // Keep only last 100 measurements for average calculation
      if (this.translationTimes.length > 100) {
        this.translationTimes.shift();
      }
      
      // Update average
      this.metrics.averageTranslationTime = 
        this.translationTimes.reduce((sum, time) => sum + time, 0) / this.translationTimes.length;
      
      this.startTime = 0;
    }
  }

  // Record cache hit
  recordCacheHit(type: 'translation' | 'format'): void {
    if (type === 'translation') {
      this.metrics.translationCacheHits++;
    } else {
      this.metrics.formatCacheHits++;
    }
  }

  // Record cache miss
  recordCacheMiss(type: 'translation' | 'format'): void {
    if (type === 'translation') {
      this.metrics.translationCacheMisses++;
    } else {
      this.metrics.formatCacheMisses++;
    }
  }

  // Update memory usage metrics
  updateMemoryUsage(translationCacheSize: number, formatCacheSize: number): void {
    this.metrics.memoryUsage.translationCacheSize = translationCacheSize;
    this.metrics.memoryUsage.formatCacheSize = formatCacheSize;
  }

  // Set translation load time
  setTranslationLoadTime(time: number): void {
    this.metrics.translationLoadTime = time;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get cache hit ratios
  getCacheHitRatios(): { translation: number; format: number } {
    const translationTotal = this.metrics.translationCacheHits + this.metrics.translationCacheMisses;
    const formatTotal = this.metrics.formatCacheHits + this.metrics.formatCacheMisses;
    
    return {
      translation: translationTotal > 0 ? this.metrics.translationCacheHits / translationTotal : 0,
      format: formatTotal > 0 ? this.metrics.formatCacheHits / formatTotal : 0,
    };
  }

  // Reset metrics
  reset(): void {
    this.metrics = {
      translationCacheHits: 0,
      translationCacheMisses: 0,
      formatCacheHits: 0,
      formatCacheMisses: 0,
      translationLoadTime: 0,
      averageTranslationTime: 0,
      memoryUsage: {
        translationCacheSize: 0,
        formatCacheSize: 0,
      },
    };
    this.translationTimes = [];
  }

  // Log performance summary
  logPerformanceSummary(): void {
    const ratios = this.getCacheHitRatios();
    
    console.group('🚀 I18n Performance Metrics');
    console.log('📊 Cache Hit Ratios:');
    console.log(`  Translation Cache: ${(ratios.translation * 100).toFixed(1)}%`);
    console.log(`  Format Cache: ${(ratios.format * 100).toFixed(1)}%`);
    console.log('⏱️ Timing:');
    console.log(`  Translation Load Time: ${this.metrics.translationLoadTime.toFixed(2)}ms`);
    console.log(`  Average Translation Time: ${this.metrics.averageTranslationTime.toFixed(2)}ms`);
    console.log('💾 Memory Usage:');
    console.log(`  Translation Cache Size: ${this.metrics.memoryUsage.translationCacheSize} entries`);
    console.log(`  Format Cache Size: ${this.metrics.memoryUsage.formatCacheSize} entries`);
    console.groupEnd();
  }
}

// Global performance monitor instance
export const i18nPerformanceMonitor = new I18nPerformanceMonitor();

// Development-only performance logging
export function enablePerformanceLogging(): void {
  if (process.env.NODE_ENV === 'development') {
    // Log performance summary every 30 seconds
    setInterval(() => {
      i18nPerformanceMonitor.logPerformanceSummary();
    }, 30000);
  }
}

// Memory usage monitoring
export function monitorMemoryUsage(): void {
  if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
    setInterval(() => {
      const memInfo = (performance as any).memory;
      if (memInfo) {
        console.log('🧠 Memory Usage:', {
          used: `${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    }, 60000); // Every minute
  }
}

// Bundle size analysis helper
export function analyzeBundleSize(): void {
  if (process.env.NODE_ENV === 'development') {
    import('./translations/common.json').then(common => {
      import('./translations/components.json').then(components => {
        import('./translations/pages.json').then(pages => {
          const commonSize = JSON.stringify(common).length;
          const componentsSize = JSON.stringify(components).length;
          const pagesSize = JSON.stringify(pages).length;
          const totalSize = commonSize + componentsSize + pagesSize;
          
          console.group('📦 Translation Bundle Analysis');
          console.log(`Common translations: ${(commonSize / 1024).toFixed(2)} KB`);
          console.log(`Components translations: ${(componentsSize / 1024).toFixed(2)} KB`);
          console.log(`Pages translations: ${(pagesSize / 1024).toFixed(2)} KB`);
          console.log(`Total size: ${(totalSize / 1024).toFixed(2)} KB`);
          console.groupEnd();
        });
      });
    });
  }
}