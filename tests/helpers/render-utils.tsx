import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { BilingualConfig } from '@/lib/i18n/types';

// Extended render options for our custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // I18n configuration options
  initialI18nLanguage?: 'en' | 'zh';
  bilingualConfig?: Partial<BilingualConfig>;
  
  // Theme configuration
  theme?: 'light' | 'dark' | 'system';
  
  // Mock storage initialization
  mockStorage?: Record<string, string>;
  
  // Whether to skip i18n loading (for faster tests)
  skipI18nInit?: boolean;
  
  // Custom wrapper component
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Custom render function that wraps components with all necessary providers
 * Includes I18n, Theme, and mock storage initialization
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const {
    initialI18nLanguage = 'en',
    bilingualConfig,
    theme = 'light',
    mockStorage,
    skipI18nInit = false,
    wrapper: CustomWrapper,
    ...renderOptions
  } = options;

  // Initialize mock storage if provided
  if (mockStorage) {
    Object.entries(mockStorage).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
  }

  // Create the providers wrapper
  function AllTheProviders({ children }: { children: React.ReactNode }) {
    const i18nConfig = {
      defaultLanguage: initialI18nLanguage,
      ...bilingualConfig,
    };

    let content = (
      <ThemeProvider
        attribute="class"
        defaultTheme={theme}
        enableSystem={theme === 'system'}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    );

    // Wrap with I18n provider unless skipped
    if (!skipI18nInit) {
      content = (
        <I18nProvider initialConfig={i18nConfig}>
          {content}
        </I18nProvider>
      );
    }

    // Apply custom wrapper if provided
    if (CustomWrapper) {
      content = <CustomWrapper>{content}</CustomWrapper>;
    }

    return content;
  }

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
}

/**
 * Lightweight render function that skips I18n initialization for faster unit tests
 * Use this for testing components that don't require translation
 */
export function renderWithoutI18n(
  ui: React.ReactElement,
  options: Omit<CustomRenderOptions, 'skipI18nInit'> = {}
): RenderResult {
  return renderWithProviders(ui, { ...options, skipI18nInit: true });
}

/**
 * Render function specifically for testing I18n components
 * Provides additional utilities for testing translations
 */
export function renderWithI18n(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const result = renderWithProviders(ui, options);
  
  return {
    ...result,
    // Helper to wait for translations to load
    waitForI18n: async () => {
      // Wait for any pending i18n operations
      await new Promise(resolve => setTimeout(resolve, 0));
    },
    // Helper to change language during test
    changeLanguage: async (language: 'en' | 'zh') => {
      const { i18n } = await import('@/lib/i18n/config');
      await i18n.changeLanguage(language);
    },
  };
}

/**
 * Mock storage helper for initializing localStorage with test data
 */
export function mockLocalStorage(data: Record<string, string> = {}) {
  // Clear existing storage
  window.localStorage.clear();
  
  // Set new data
  Object.entries(data).forEach(([key, value]) => {
    window.localStorage.setItem(key, value);
  });
}

/**
 * Helper to create a mock storage event for testing cross-tab communication
 */
export function createStorageEvent(
  key: string,
  newValue: string | null,
  oldValue: string | null = null
): StorageEvent {
  return new StorageEvent('storage', {
    key,
    newValue,
    oldValue,
    storageArea: window.localStorage,
    url: window.location.href,
  });
}

// Re-export commonly used testing utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';