'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { bilingualConfig, formatBilingualText, ensureTranslationsLoaded } from '@/lib/i18n/config';
import { BilingualConfig, FormatOptions, TranslationKey } from '@/lib/i18n/types';

// Context for bilingual configuration
interface BilingualContextType {
  config: BilingualConfig;
  updateConfig: (newConfig: Partial<BilingualConfig>) => void;
  formatBilingual: (en: string, zh: string, options?: FormatOptions) => string;
  isReady: boolean;
}

const BilingualContext = createContext<BilingualContextType | undefined>(undefined);

// Hook to use bilingual context
export function useBilingualContext(): BilingualContextType {
  const context = useContext(BilingualContext);
  if (!context) {
    throw new Error('useBilingualContext must be used within a BilingualProvider');
  }
  return context;
}

// Props for the provider
interface I18nProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<BilingualConfig>;
}

/**
 * I18n Provider that wraps the app with bilingual text support
 * Provides both react-i18next and custom bilingual formatting
 */
export function I18nProvider({ children, initialConfig }: I18nProviderProps) {
  const [config, setConfig] = useState<BilingualConfig>({
    ...bilingualConfig,
    ...initialConfig,
  });
  const [isReady, setIsReady] = useState(false);

  // Initialize i18n when component mounts with optimized loading
  useEffect(() => {
    const initializeI18n = async () => {
      try {
        // Wait for i18n to be ready
        if (!i18n.isInitialized) {
          await i18n.init();
        }
        
        // Load translations lazily
        await ensureTranslationsLoaded();
        
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        // Set ready to true anyway to prevent blocking the app
        setIsReady(true);
      }
    };

    initializeI18n();
  }, []);

  // Update configuration with memoization
  const updateConfig = useCallback((newConfig: Partial<BilingualConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Format bilingual text using current config with memoization
  const formatBilingual = useCallback((en: string, zh: string, options?: FormatOptions) => {
    return formatBilingualText(en, zh, {
      separator: config.separator,
      ...options,
    });
  }, [config.separator]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: BilingualContextType = useMemo(() => ({
    config,
    updateConfig,
    formatBilingual,
    isReady,
  }), [config, updateConfig, formatBilingual, isReady]);

  // Show loading state while i18n initializes
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading 加载中...</div>
      </div>
    );
  }

  return (
    <BilingualContext.Provider value={contextValue}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </BilingualContext.Provider>
  );
}

export default I18nProvider;