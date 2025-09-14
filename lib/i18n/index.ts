// Main i18n exports
export { default as i18n } from './config';
export * from './types';
export * from './utils';

// Re-export commonly used items
export { useBilingualText } from '@/hooks/use-bilingual-text';
export { BilingualText } from '@/components/ui/bilingual-text';
export { I18nProvider } from '@/components/providers/i18n-provider';
export { default as I18nErrorBoundary, DefaultI18nErrorFallback } from '@/components/i18n-error-boundary';