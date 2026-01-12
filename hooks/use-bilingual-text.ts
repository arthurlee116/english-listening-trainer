import { useMemo, useCallback, useEffect } from 'react';
import { FormatOptions, TranslationKey, UseBilingualTextReturn } from '@/lib/i18n/types';
import { useLanguage, Language } from '@/components/providers/language-provider';

import { translationCache } from '@/lib/i18n/memory-management';
import { i18nPerformanceMonitor } from '@/lib/i18n/performance';

import commonTranslationsData from '@/lib/i18n/translations/common.json';
import componentsTranslationsData from '@/lib/i18n/translations/components.json';
import pagesTranslationsData from '@/lib/i18n/translations/pages.json';
import achievementsTranslationsData from '@/lib/i18n/translations/achievements.json';

// Translation resources are bundled via static imports to ensure immediate availability
const commonTranslations: Record<string, unknown> = commonTranslationsData as Record<string, unknown>;
const componentsTranslations: Record<string, unknown> = componentsTranslationsData as Record<string, unknown>;
const pagesTranslations: Record<string, unknown> = pagesTranslationsData as Record<string, unknown>;
const translationsLoaded = true;

const achievementsTranslations: Record<string, unknown> = achievementsTranslationsData as Record<string, unknown>;
const achievementsSection: Record<string, unknown> =
  (achievementsTranslations['achievements'] as Record<string, unknown>) || {};

const isTranslationKey = (value: unknown): value is TranslationKey => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.en === 'string' && typeof record.zh === 'string';
};

/**
 * Select language text based on current language preference
 */
const selectLanguage = (en: string, zh: string, currentLanguage: Language): string => {
  return currentLanguage === 'en' ? en : zh;
};

const applyTemplateValues = (
  text: string,
  values?: Record<string, string | number>
): string => {
  if (!values) {
    return text;
  }

  return Object.entries(values).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }

    const replacement = String(value);
    return acc.split(`{${key}}`).join(replacement);
  }, text);
};

/**
 * Custom hook for bilingual text formatting with performance optimizations
 * Provides utilities to format text in single language based on user preference
 */
export function useBilingualText(): UseBilingualTextReturn {
  const { currentLanguage } = useLanguage();
  
  // 当语言切换时清理旧语言的翻译缓存
  useEffect(() => {
    translationCache.clear();
    i18nPerformanceMonitor.updateMemoryUsage(0, 0);
  }, [currentLanguage]);
  
  /**
   * Format bilingual text from English and Chinese strings with memoization
   * Now returns single language based on currentLanguage
   */
  const formatBilingual = useCallback((en: string, zh: string, options?: FormatOptions): string => {
    const withUnit = options?.withUnit;
    const withParentheses = options?.withParentheses;
    const values = options?.values;

    const formattedEn = applyTemplateValues(en, values);
    const formattedZh = applyTemplateValues(zh, values);

    // Select language based on current preference
    let formatted = selectLanguage(formattedEn, formattedZh, currentLanguage);

    if (withUnit) {
      if (withParentheses) {
        formatted = `${formatted} (${withUnit})`;
      } else {
        formatted = `${formatted} ${withUnit}`;
      }
    }

    return formatted;
  }, [currentLanguage]);

  /**
   * Get bilingual value from a TranslationKey object with memoization
   */
  const getBilingualValue = useCallback((translationKey: TranslationKey, options?: FormatOptions): string => {
    return formatBilingual(translationKey.en, translationKey.zh, options);
  }, [formatBilingual]);

  /**
   * Get nested object value by dot notation path with optimized caching
   */
  const getNestedValue = useCallback((obj: Record<string, unknown> | undefined, path: string): unknown => {
    const cacheKey = `nested:${currentLanguage}:${path}`;
    
    const cached = translationCache.get(cacheKey);
    if (cached) {
      i18nPerformanceMonitor.recordCacheHit('translation');
      return cached;
    }

    i18nPerformanceMonitor.recordCacheMiss('translation');

    const result = path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      const record = current as Record<string, unknown>;
      return record[key] !== undefined ? record[key] : undefined;
    }, obj);

    // Cache string results only; nested objects are handled per-call
    if (typeof result === 'string') {
      translationCache.set(cacheKey, result);
      i18nPerformanceMonitor.updateMemoryUsage(translationCache.size(), 0);
    }

    return result;
  }, [currentLanguage]);

  /**
   * Get translation using key path and format as bilingual text with memoization
   */
  const t = useCallback((key: string, options?: FormatOptions): string => {
    // Check cache first with language-specific key
    const cacheKey = `t:${currentLanguage}:${key}:${JSON.stringify(options || {})}`;
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
      let translationObj: Record<string, unknown> | undefined;
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
      } else if (key.startsWith('achievements.')) {
        const remainder = key.substring(13);
        if (remainder.startsWith('notifications.') || remainder.startsWith('dashboard.')) {
          translationObj = achievementsTranslations;
          actualKey = remainder;
        } else {
          translationObj = achievementsSection;
          actualKey = remainder;
        }
      } else {
        // Try to find in common first, then components, then pages
        const candidate =
          getNestedValue(commonTranslations, key) ||
          getNestedValue(componentsTranslations, key) ||
          getNestedValue(pagesTranslations, key) ||
          getNestedValue(achievementsTranslations, key) ||
          (key.startsWith('achievements.')
            ? getNestedValue(achievementsSection, key.substring(13))
            : undefined);

        if (isTranslationKey(candidate)) {
          const result = formatBilingual(candidate.en, candidate.zh, options);
          
          // Cache the result using managed cache
          translationCache.set(cacheKey, result);
          i18nPerformanceMonitor.endTranslation();
          i18nPerformanceMonitor.updateMemoryUsage(translationCache.size(), 0);
          
          return result;
        }

        translationObj = candidate && typeof candidate === 'object'
          ? (candidate as Record<string, unknown>)
          : undefined;
      }

      // Get the translation object using dot notation
      const translation = getNestedValue(translationObj, actualKey);

      // Check if it's a valid TranslationKey object
      if (isTranslationKey(translation)) {
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
