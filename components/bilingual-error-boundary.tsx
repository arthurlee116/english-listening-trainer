"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BilingualText } from '@/components/ui/bilingual-text'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class BilingualErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('BilingualErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md mx-auto p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <BilingualText translationKey="messages.errorOccurred" />
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="messages.errorDescription" />
                </p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      <BilingualText translationKey="messages.errorDetails" />
                    </summary>
                    <pre className="mt-2 text-xs text-left bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => this.setState({ hasError: false, error: undefined })}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <BilingualText translationKey="buttons.retry" />
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2"
                >
                  <BilingualText translationKey="messages.refreshPage" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// 函数式组件包装器，用于Hook
export function withBilingualErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <BilingualErrorBoundary fallback={fallback}>
        <Component {...props} />
      </BilingualErrorBoundary>
    )
  }
}