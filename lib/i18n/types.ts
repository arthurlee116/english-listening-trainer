import React from 'react';

// Core interfaces for bilingual text system
export interface TranslationKey {
  en: string;
  zh: string;
}

export interface BilingualConfig {
  defaultLanguage: 'en' | 'zh';
  displayFormat: 'en-zh' | 'zh-en';
  separator: string;
}

export interface FormatOptions {
  withUnit?: string;
  withParentheses?: boolean;
  separator?: string;
  values?: Record<string, string | number>;
}

// Translation resource structure interfaces
export interface CommonTranslations {
  buttons: Record<string, TranslationKey>;
  labels: Record<string, TranslationKey>;
  messages: Record<string, TranslationKey>;
  placeholders: Record<string, TranslationKey>;
  status: Record<string, TranslationKey>;
  actions: Record<string, TranslationKey>;
}

export interface PagesTranslations {
  home: Record<string, TranslationKey>;
  assessment: Record<string, TranslationKey>;
  history: Record<string, TranslationKey>;
  results: Record<string, TranslationKey>;
  admin: Record<string, TranslationKey>;
}

export interface ComponentsTranslations {
  audioPlayer: Record<string, TranslationKey>;
  questionInterface: Record<string, TranslationKey>;
  wrongAnswersBook: Record<string, TranslationKey>;
  authDialog: Record<string, TranslationKey>;
  navigation: Record<string, TranslationKey>;
}

export interface TranslationResources {
  en: {
    common: CommonTranslations;
    pages: PagesTranslations;
    components: ComponentsTranslations;
  };
  zh: {
    common: CommonTranslations;
    pages: PagesTranslations;
    components: ComponentsTranslations;
  };
}

// Hook return types
export interface UseBilingualTextReturn {
  t: (key: string, options?: FormatOptions) => string;
  formatBilingual: (en: string, zh: string, options?: FormatOptions) => string;
  getBilingualValue: (translationKey: TranslationKey, options?: FormatOptions) => string;
}

// Component prop types
export interface BilingualTextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  translationKey?: string;
  en?: string;
  zh?: string;
  unit?: string;
  className?: string;
  as?: keyof HTMLElementTagNameMap;
  options?: FormatOptions;
}

// Difficulty levels and duration options
export interface DifficultyLevel {
  level: string;
  translation: TranslationKey;
}

export interface DurationOption {
  value: string;
  translation: TranslationKey;
  wordCount?: number;
}

// Error handling
export interface FallbackStrategy {
  showKey: boolean;
  showEnglish: boolean;
  showPlaceholder: string;
}

export interface I18nErrorBoundaryProps {
  fallback: React.ComponentType<{error: Error}>;
  children: React.ReactNode;
}

// Default bilingual configuration
export const bilingualConfig: BilingualConfig = {
  defaultLanguage: 'en',
  displayFormat: 'en-zh',
  separator: ' '
};
