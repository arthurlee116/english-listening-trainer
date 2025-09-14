'use client';

import React from 'react';
import { I18nErrorBoundaryProps } from '@/lib/i18n/types';

interface I18nErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for i18n-related errors
 * Provides fallback UI when translation system fails
 */
export class I18nErrorBoundary extends React.Component<
  I18nErrorBoundaryProps,
  I18nErrorBoundaryState
> {
  constructor(props: I18nErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): I18nErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('I18n Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI
      return <this.props.fallback error={this.state.error!} />;
    }

    return this.props.children;
  }
}

/**
 * Default fallback component for i18n errors
 */
export function DefaultI18nErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Translation Error 翻译错误
        </h1>
        <p className="text-gray-600 mb-4">
          There was an error loading the translations. Please refresh the page.
          <br />
          翻译加载出错，请刷新页面。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Page 刷新页面
        </button>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">
              Error Details 错误详情
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {error.message}
              {error.stack && `\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Convenience wrapper that uses the default fallback
 */
export function I18nErrorBoundaryWithDefault({ children }: { children: React.ReactNode }) {
  return (
    <I18nErrorBoundary fallback={DefaultI18nErrorFallback}>
      {children}
    </I18nErrorBoundary>
  );
}

export default I18nErrorBoundary;