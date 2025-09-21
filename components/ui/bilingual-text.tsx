import React from 'react';
import { cn } from '@/lib/utils';
import { BilingualTextProps, TranslationKey } from '@/lib/i18n/types';
import { useBilingualText } from '@/hooks/use-bilingual-text';

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

  if (translationKey) {
    // Use translation key with i18n system
    displayText = t(translationKey, { ...options, withUnit: unit });
  } else if (en && zh) {
    // Use direct English and Chinese text
    const translationObj: TranslationKey = { en, zh };
    displayText = getBilingualValue(translationObj, { ...options, withUnit: unit });
  } else {
    // Fallback to whatever text is available
    displayText = en || zh || '[Missing Translation]';
    console.warn('BilingualText: Missing both translation key and en/zh props');
  }

  const elementProps = props as React.HTMLAttributes<HTMLElement>;

  return (
    <Component className={cn(className)} {...elementProps}>
      {displayText}
    </Component>
  );
}

// Export default for convenience
export default BilingualText;
