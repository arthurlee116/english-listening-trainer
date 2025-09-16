import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import types
import { BilingualConfig, FormatOptions } from './types';

// Default bilingual configuration
export const bilingualConfig: BilingualConfig = {
  defaultLanguage: 'en',
  displayFormat: 'en-zh',
  separator: ' '
};

import { formatCache } from './memory-management';
import { i18nPerformanceMonitor } from './performance';

// Custom bilingual formatter function with optimized caching
export function formatBilingualText(en: string, zh: string, options?: FormatOptions): string {
  try {
    // Create cache key
    const cacheKey = `${en}|${zh}|${JSON.stringify(options || {})}`;
    
    // Check cache first
    const cached = formatCache.get(cacheKey);
    if (cached) {
      i18nPerformanceMonitor.recordCacheHit('format');
      return cached;
    }

    i18nPerformanceMonitor.recordCacheMiss('format');
    i18nPerformanceMonitor.startTranslation();

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

    // Cache the result using managed cache (with error handling)
    try {
      formatCache.set(cacheKey, formatted);
    } catch (cacheError) {
      console.warn('Failed to cache formatted text:', cacheError);
    }
    
    i18nPerformanceMonitor.endTranslation();
    i18nPerformanceMonitor.updateMemoryUsage(0, formatCache.size());

    return formatted;
  } catch (error) {
    console.error('Error in formatBilingualText:', error);
    // Fallback to simple concatenation
    return `${en} ${zh}`;
  }
}

// Clear format cache (useful for testing or memory management)
export function clearFormatCache(): void {
  formatCache.clear();
}

// Lazy loading for translation resources
let translationsLoaded = false;
let translationPromise: Promise<void> | null = null;

// Transform translation resources to extract English and Chinese separately
function transformTranslations(translations: unknown): { en: unknown; zh: unknown } {
  const en: unknown = {};
  const zh: unknown = {};

  function extractLanguages(obj: unknown, enTarget: unknown, zhTarget: unknown) {
    // Implementation with type guards for unknown
    if (typeof obj !== 'object' || obj === null) return;

    const objAsRecord = obj as Record<string, unknown>;
    for (const key in objAsRecord) {
      const value = objAsRecord[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const valueAsRecord = value as Record<string, unknown>;
        if (typeof valueAsRecord.en === 'string' && typeof valueAsRecord.zh === 'string') {
          // This is a TranslationKey object
          (enTarget as Record<string, string>)[key] = valueAsRecord.en;
          (zhTarget as Record<string, string>)[key] = valueAsRecord.zh;
        } else {
          // This is a nested object, recurse
          (enTarget as Record<string, unknown>)[key] = {};
          (zhTarget as Record<string, unknown>)[key] = {};
          extractLanguages(value, (enTarget as Record<string, unknown>)[key], (zhTarget as Record<string, unknown>)[key]);
        }
      }
    }
  }

  extractLanguages(translations, en, zh);
  return { en, zh };
}

// Lazy load translation resources
async function loadTranslations() {
  if (translationsLoaded) return;
  
  if (translationPromise) {
    await translationPromise;
    return;
  }

  translationPromise = (async () => {
    const startTime = performance.now();
    
    try {
      // Dynamic imports for better code splitting
      const [commonTranslations, pagesTranslations, componentsTranslations] = await Promise.all([
        import('./translations/common.json'),
        import('./translations/pages.json'),
        import('./translations/components.json')
      ]);

      // Transform all translation resources
      const commonLangs = transformTranslations(commonTranslations.default);
      const pagesLangs = transformTranslations(pagesTranslations.default);
      const componentsLangs = transformTranslations(componentsTranslations.default);

      // Add resources to i18n
      i18n.addResourceBundle('en', 'common', commonLangs.en as Record<string, string>);
      i18n.addResourceBundle('en', 'pages', pagesLangs.en as Record<string, string>);
      i18n.addResourceBundle('en', 'components', componentsLangs.en as Record<string, string>);
      
      i18n.addResourceBundle('zh', 'common', commonLangs.zh as Record<string, string>);
      i18n.addResourceBundle('zh', 'pages', pagesLangs.zh as Record<string, string>);
      i18n.addResourceBundle('zh', 'components', componentsLangs.zh as Record<string, string>);

      translationsLoaded = true;
      
      // Record load time
      const loadTime = performance.now() - startTime;
      i18nPerformanceMonitor.setTranslationLoadTime(loadTime);
      
      console.log(`✅ Translations loaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to load translations:', error);
      throw error;
    }
  })();

  await translationPromise;
}

// Initialize i18next with minimal configuration
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // Start with empty resources - will be loaded lazily
    resources: {
      en: {},
      zh: {}
    },

    // Enable return objects for nested translations
    returnObjects: true,
  });

// Export function to ensure translations are loaded
export async function ensureTranslationsLoaded(): Promise<void> {
  await loadTranslations();
}

export default i18n;