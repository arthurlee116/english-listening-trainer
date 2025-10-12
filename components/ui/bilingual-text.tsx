import React from 'react';
import { cn } from '@/lib/utils';
import { BilingualTextProps, TranslationKey } from '@/lib/i18n/types';
import { useBilingualText } from '@/hooks/use-bilingual-text';
import achievementsTranslationsData from '@/lib/i18n/translations/achievements.json';

const achievementsLookup = achievementsTranslationsData as Record<string, unknown>;

const isTranslationObject = (value: unknown): value is TranslationKey => {
  return typeof value === 'object' && value !== null && 'en' in value && 'zh' in value;
};

const resolveAchievementTranslation = (key: string): TranslationKey | null => {
  if (!key.startsWith('achievements.')) {
    return null;
  }

  const walkPath = (base: Record<string, unknown>, path: string[]): unknown => {
    return path.reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, base);
  };

  const directPath = key.split('.');
  const directResult = walkPath(achievementsLookup, directPath);
  if (isTranslationObject(directResult)) {
    return directResult;
  }

  const namespaceStripped = key.substring(13);
  if (!namespaceStripped) {
    return null;
  }

  const strippedResult = walkPath(achievementsLookup, namespaceStripped.split('.'));
  return isTranslationObject(strippedResult) ? strippedResult : null;
};

/**
 * BilingualText component for consistent bilingual text display
 * Supports both translation keys and direct English/Chinese text
 */
export function BilingualText({
  translationKey,
  en,
  zh,
  unit,
  className,
  as: Component = 'span',
  options,
  ...props
}: BilingualTextProps) {
  const { t, getBilingualValue } = useBilingualText();

  // Determine the text to display
  let displayText: string;

  const mergedOptions = unit !== undefined ? { ...options, withUnit: unit } : options;

  if (translationKey) {
    // Use translation key with i18n system
    const translatedValue = t(translationKey, mergedOptions);

    if (translatedValue === translationKey) {
      const achievementTranslation = resolveAchievementTranslation(translationKey);

      if (achievementTranslation) {
        displayText = getBilingualValue(achievementTranslation, mergedOptions);
      } else {
        displayText = translatedValue;
      }
    } else {
      displayText = translatedValue;
    }
  } else if (en && zh) {
    // Use direct English and Chinese text
    const translationObj: TranslationKey = { en, zh };
    displayText = getBilingualValue(translationObj, mergedOptions);
  } else {
    // Fallback to whatever text is available
    displayText = en || zh || '[Missing Translation]';
    console.warn('BilingualText: Missing both translation key and en/zh props');
  }

  const Tag = Component || 'span';
  const elementProps = props as React.HTMLAttributes<HTMLElement>;

  return React.createElement(
    Tag,
    { className: cn(className), ...elementProps },
    displayText
  );
}

// Export default for convenience
export default BilingualText;
