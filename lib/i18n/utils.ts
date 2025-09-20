import { TranslationKey, DifficultyLevel, DurationOption } from './types';

/**
 * Utility functions for bilingual text formatting
 */

/**
 * Format bilingual text with consistent separator
 */
export function formatBilingualText(en: string, zh: string, separator = ' '): string {
  return `${en}${separator}${zh}`;
}

/**
 * Format text with unit in parentheses
 */
export function formatWithUnit(text: string, unit: string): string {
  return `${text} (${unit})`;
}

/**
 * Predefined difficulty levels with bilingual labels
 */
export const difficultyLevels: DifficultyLevel[] = [
  {
    level: 'A1',
    translation: { en: 'A1 - Beginner', zh: 'A1 - 初学者' }
  },
  {
    level: 'A2', 
    translation: { en: 'A2 - Elementary', zh: 'A2 - 基础级' }
  },
  {
    level: 'B1',
    translation: { en: 'B1 - Intermediate', zh: 'B1 - 中级' }
  },
  {
    level: 'B2',
    translation: { en: 'B2 - Upper Intermediate', zh: 'B2 - 中高级' }
  },
  {
    level: 'C1',
    translation: { en: 'C1 - Advanced', zh: 'C1 - 高级' }
  },
  {
    level: 'C2',
    translation: { en: 'C2 - Proficient', zh: 'C2 - 精通级' }
  }
];

/**
 * Predefined duration options with bilingual labels
 */
export const durationOptions: DurationOption[] = [
  {
    value: '1min',
    translation: { en: '1 minute', zh: '1分钟' },
    wordCount: 120
  },
  {
    value: '2min',
    translation: { en: '2 minutes', zh: '2分钟' },
    wordCount: 240
  },
  {
    value: '3min',
    translation: { en: '3 minutes', zh: '3分钟' },
    wordCount: 360
  },
  {
    value: '5min',
    translation: { en: '5 minutes', zh: '5分钟' },
    wordCount: 600
  }
];

/**
 * Get bilingual difficulty level label
 */
export function getDifficultyLabel(level: string): string {
  const difficulty = difficultyLevels.find(d => d.level === level);
  if (!difficulty) {
    console.warn(`Unknown difficulty level: ${level}`);
    return level;
  }
  return formatBilingualText(difficulty.translation.en, difficulty.translation.zh);
}

/**
 * Get bilingual duration label with word count
 */
export function getDurationLabel(value: string): string {
  const duration = durationOptions.find(d => d.value === value);
  if (!duration) {
    console.warn(`Unknown duration value: ${value}`);
    return value;
  }
  
  const baseText = formatBilingualText(duration.translation.en, duration.translation.zh);
  const wordCountText = `(~${duration.wordCount} ${formatBilingualText('words', '词')})`;
  
  return `${baseText} ${wordCountText}`;
}

/**
 * Validate translation key has both languages
 */
export function isValidTranslationKey(key: unknown): key is TranslationKey {
  return (
    typeof key === 'object' &&
    key !== null &&
    typeof (key as Record<string, string>).en === 'string' &&
    typeof (key as Record<string, string>).zh === 'string' &&
    (key as Record<string, string>).en.length > 0 &&
    (key as Record<string, string>).zh.length > 0
  );
}

/**
 * Get fallback text when translation is missing
 */
export function getFallbackText(key: string, fallbackStrategy?: unknown): string {
  if (fallbackStrategy && typeof fallbackStrategy === 'object' && 'showPlaceholder' in fallbackStrategy) {
    return (fallbackStrategy as { showPlaceholder?: string }).showPlaceholder || '[Missing Translation]';
  }

  if (fallbackStrategy && typeof fallbackStrategy === 'object' && 'showKey' in fallbackStrategy) {
    return (fallbackStrategy as { showKey?: boolean }).showKey !== false ? key : '[Translation Missing]';
  }

  // Default behavior: return the key if no showPlaceholder specified
  return key;
}
