import { useMemo, useCallback } from 'react';
import { FormatOptions, TranslationKey, UseBilingualTextReturn, bilingualConfig } from '@/lib/i18n/types';

import { translationCache } from '@/lib/i18n/memory-management';
import { i18nPerformanceMonitor } from '@/lib/i18n/performance';

import commonTranslationsData from '@/lib/i18n/translations/common.json';
import componentsTranslationsData from '@/lib/i18n/translations/components.json';
import pagesTranslationsData from '@/lib/i18n/translations/pages.json';

// Translation resources are bundled via static imports to ensure immediate availability
const commonTranslations: Record<string, unknown> = commonTranslationsData as Record<string, unknown>;
const componentsTranslations: Record<string, unknown> = componentsTranslationsData as Record<string, unknown>;
const pagesTranslations: Record<string, unknown> = pagesTranslationsData as Record<string, unknown>;
const translationsLoaded = true;

/**
 * Custom hook for bilingual text formatting with performance optimizations
 * Provides utilities to format text in "English 中文" format
 */
export function useBilingualText(): UseBilingualTextReturn {
  
  /**
   * Format bilingual text from English and Chinese strings with memoization
   */
  const formatBilingual = useCallback((en: string, zh: string, options?: FormatOptions): string => {
    const separator = options?.separator || bilingualConfig.separator;
    const withUnit = options?.withUnit;
    const withParentheses = options?.withParentheses;

    let formatted = `${en}${separator}${zh}`;

    if (withUnit) {
      if (withParentheses) {
        formatted = `${formatted} (${withUnit})`;
      } else {
        formatted = `${formatted} ${withUnit}`;
      }
    }

    return formatted;
  }, []);

  /**
   * Get bilingual value from a TranslationKey object with memoization
   */
  const getBilingualValue = useCallback((translationKey: TranslationKey, options?: FormatOptions): string => {
    return formatBilingual(translationKey.en, translationKey.zh, options);
  }, [formatBilingual]);

  /**
   * Get nested object value by dot notation path with optimized caching
   */
  const getNestedValue = useCallback((obj: any, path: string): any => {
    const cacheKey = `nested:${path}`;
    
    const cached = translationCache.get(cacheKey);
    if (cached) {
      i18nPerformanceMonitor.recordCacheHit('translation');
      return cached;
    }

    i18nPerformanceMonitor.recordCacheMiss('translation');

    const result = path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);

    // Cache the result using managed cache
    translationCache.set(cacheKey, result);
    i18nPerformanceMonitor.updateMemoryUsage(translationCache.size(), 0);

    return result;
  }, []);

  /**
   * Get translation using key path and format as bilingual text with memoization
   */
  const t = useCallback((key: string, options?: FormatOptions): string => {
    // Check cache first
    const cacheKey = `t:${key}:${JSON.stringify(options || {})}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      i18nPerformanceMonitor.recordCacheHit('translation');
      return cached;
    }

    i18nPerformanceMonitor.recordCacheMiss('translation');
    i18nPerformanceMonitor.startTranslation();

    try {
      // Ensure translations are loaded
      if (!translationsLoaded) {
        console.warn(`Translations not loaded yet for key: ${key}`);
        return key;
      }

      // Determine which translation file to use based on key prefix
      let translationObj: any;
      let actualKey = key;

      if (key.startsWith('common.')) {
        translationObj = commonTranslations;
        actualKey = key.substring(7); // Remove 'common.' prefix
      } else if (key.startsWith('components.')) {
        translationObj = componentsTranslations;
        actualKey = key.substring(11); // Remove 'components.' prefix
      } else if (key.startsWith('pages.')) {
        translationObj = pagesTranslations;
        actualKey = key.substring(6); // Remove 'pages.' prefix
      } else {
        // Try to find in common first, then components, then pages
        translationObj = getNestedValue(commonTranslations, key) ||
                        getNestedValue(componentsTranslations, key) ||
                        getNestedValue(pagesTranslations, key);
        
        if (translationObj && translationObj.en && translationObj.zh) {
          const result = formatBilingual(translationObj.en, translationObj.zh, options);
          
          // Cache the result using managed cache
          translationCache.set(cacheKey, result);
          i18nPerformanceMonitor.endTranslation();
          i18nPerformanceMonitor.updateMemoryUsage(translationCache.size(), 0);
          
          return result;
        }
      }

      // Get the translation object using dot notation
      const translation = getNestedValue(translationObj, actualKey);

      // Check if it's a valid TranslationKey object
      if (translation && typeof translation === 'object' && translation.en && translation.zh) {
        const result = formatBilingual(translation.en, translation.zh, options);
        
        // Cache the result using managed cache
        translationCache.set(cacheKey, result);
        i18nPerformanceMonitor.endTranslation();
        i18nPerformanceMonitor.updateMemoryUsage(translationCache.size(), 0);
        
        return result;
      }

      // Fallback: return the key itself
      console.warn(`Missing translation for key: ${key}`);
      i18nPerformanceMonitor.endTranslation();
      return key;
    } catch (error) {
      console.error(`Error getting translation for key: ${key}`, error);
      i18nPerformanceMonitor.endTranslation();
      return key;
    }
  }, [formatBilingual, getNestedValue]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    t,
    formatBilingual,
    getBilingualValue,
  }), [t, formatBilingual, getBilingualValue]);
}

// Export function to clear translation cache (useful for testing)
export function clearTranslationCache(): void {
  translationCache.clear();
}
