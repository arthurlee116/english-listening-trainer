import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatBilingualText, clearFormatCache } from '@/lib/i18n/config';
import { useBilingualText, clearTranslationCache } from '@/hooks/use-bilingual-text';
import { i18nPerformanceMonitor } from '@/lib/i18n/performance';
import { translationCache, formatCache } from '@/lib/i18n/memory-management';
import { renderHook } from '@testing-library/react';

describe('I18n Performance Optimizations', () => {
  beforeEach(() => {
    // Clear caches and reset metrics before each test
    clearFormatCache();
    clearTranslationCache();
    i18nPerformanceMonitor.reset();
  });

  afterEach(() => {
    // Clean up after each test
    clearFormatCache();
    clearTranslationCache();
  });

  describe('Format Cache Performance', () => {
    it('should cache formatted bilingual text', () => {
      const en = 'Hello';
      const zh = '你好';
      
      // First call - should miss cache
      const result1 = formatBilingualText(en, zh);
      expect(result1).toBe('Hello 你好');
      
      // Second call - should hit cache
      const result2 = formatBilingualText(en, zh);
      expect(result2).toBe('Hello 你好');
      
      // Verify cache hit
      const metrics = i18nPerformanceMonitor.getMetrics();
      expect(metrics.formatCacheHits).toBe(1);
      expect(metrics.formatCacheMisses).toBe(1);
    });

    it('should handle cache with different options', () => {
      const en = 'Duration';
      const zh = '时长';
      
      const result1 = formatBilingualText(en, zh, { withUnit: 'min', withParentheses: true });
      expect(result1).toBe('Duration 时长 (min)');
      
      const result2 = formatBilingualText(en, zh, { withUnit: 'sec', withParentheses: true });
      expect(result2).toBe('Duration 时长 (sec)');
      
      // Should be different results due to different options
      expect(result1).not.toBe(result2);
    });

    it('should measure formatting performance', () => {
      const en = 'Test';
      const zh = '测试';
      
      formatBilingualText(en, zh);
      
      const metrics = i18nPerformanceMonitor.getMetrics();
      expect(metrics.averageTranslationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Translation Cache Performance', () => {
    it('should cache translation lookups', () => {
      const { result } = renderHook(() => useBilingualText());
      const { t } = result.current;
      
      // First call - should miss cache
      const result1 = t('common.buttons.generate');
      
      // Second call - should hit cache
      const result2 = t('common.buttons.generate');
      
      expect(result1).toBe(result2);
      
      // Verify cache behavior
      const metrics = i18nPerformanceMonitor.getMetrics();
      expect(metrics.translationCacheHits).toBeGreaterThan(0);
    });

    it('should handle missing translations gracefully', () => {
      const { result } = renderHook(() => useBilingualText());
      const { t } = result.current;
      
      const result1 = t('nonexistent.key');
      expect(result1).toBe('nonexistent.key');
    });
  });

  describe('Memory Management', () => {
    it('should limit cache size', () => {
      // Fill cache beyond limit
      for (let i = 0; i < 1200; i++) {
        formatBilingualText(`test${i}`, `测试${i}`);
      }
      
      // Cache should not exceed maximum size
      expect(formatCache.size()).toBeLessThanOrEqual(1000);
    });

    it('should provide cache statistics', () => {
      formatBilingualText('test', '测试');
      
      const stats = formatCache.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.maxSize).toBe(1000);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });

    it('should clean up expired entries', async () => {
      // Add entry to cache
      formatBilingualText('test', '测试');
      expect(formatCache.size()).toBe(1);
      
      // Mock time passage to trigger expiration
      vi.useFakeTimers();
      vi.advanceTimersByTime(600000); // 10 minutes
      
      // Trigger cleanup by accessing cache
      formatBilingualText('new', '新的');
      
      vi.useRealTimers();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track cache hit ratios', () => {
      // Generate some cache hits and misses
      formatBilingualText('test1', '测试1');
      formatBilingualText('test1', '测试1'); // Hit
      formatBilingualText('test2', '测试2');
      formatBilingualText('test2', '测试2'); // Hit
      
      const ratios = i18nPerformanceMonitor.getCacheHitRatios();
      expect(ratios.format).toBeGreaterThan(0);
      expect(ratios.format).toBeLessThanOrEqual(1);
    });

    it('should measure translation timing', () => {
      formatBilingualText('test', '测试');
      
      const metrics = i18nPerformanceMonitor.getMetrics();
      expect(metrics.averageTranslationTime).toBeGreaterThanOrEqual(0);
    });

    it('should track memory usage', () => {
      formatBilingualText('test', '测试');
      
      const metrics = i18nPerformanceMonitor.getMetrics();
      expect(metrics.memoryUsage.formatCacheSize).toBeGreaterThan(0);
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should support lazy loading', async () => {
      // This test verifies that translations can be loaded dynamically
      const { ensureTranslationsLoaded } = await import('@/lib/i18n/config');
      
      await expect(ensureTranslationsLoaded()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', () => {
      // Mock cache error
      const originalSet = formatCache.set;
      formatCache.set = vi.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      // Should not throw error
      expect(() => formatBilingualText('test', '测试')).not.toThrow();
      
      // Restore original method
      formatCache.set = originalSet;
    });

    it('should handle performance monitoring errors', () => {
      // Mock performance.now to throw error
      const originalNow = performance.now;
      performance.now = vi.fn().mockImplementation(() => {
        throw new Error('Performance API error');
      });
      
      // Should not throw error
      expect(() => formatBilingualText('test', '测试')).not.toThrow();
      
      // Restore original method
      performance.now = originalNow;
    });
  });
});