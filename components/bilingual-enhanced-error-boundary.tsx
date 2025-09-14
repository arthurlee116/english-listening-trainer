/**
 * 增强的双语错误边界组件
 * 提供更好的错误恢复、用户反馈和错误上报功能
 */

"use client"

import React, { Component, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BilingualText } from '@/components/ui/bilingual-text'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  AlertTriangle, 
  RefreshCw, 
  Bug, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Zap,
  Shield
} from 'lucide-react'

// 错误类型分类
enum ErrorCategory {
  REACT_ERROR = 'react_error',
  ASYNC_ERROR = 'async_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_ERROR = 'permission_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// 错误严重程度
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface ErrorAnalysis {
  category: ErrorCategory
  severity: ErrorSeverity
  userMessageKey: string
  technicalMessage: string
  suggestionKeys: string[]
  isRecoverable: boolean
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorAnalysis) => void
  showTechnicalDetails?: boolean
  allowReset?: boolean
  componentName?: string
  userId?: string
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  errorAnalysis?: ErrorAnalysis
  retryAttempts: number
  maxRetries: number
  showDetails: boolean
  lastErrorTime: Date | null
}

export class BilingualEnhancedErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = []

  public state: State = {
    hasError: false,
    retryAttempts: 0,
    maxRetries: 3,
    showDetails: false,
    lastErrorTime: null
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      lastErrorTime: new Date()
    }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    
    // 分析错误
    const analysis = this.analyzeError(error, errorInfo)
    this.setState({ errorAnalysis: analysis })

    // 记录错误
    this.logError(error, errorInfo, analysis)

    // 调用外部错误处理器
    this.props.onError?.(error, analysis)

    // 自动重试逻辑（仅对可恢复的错误）
    if (analysis.isRecoverable && this.state.retryAttempts < this.state.maxRetries) {
      this.scheduleRetry()
    }
  }

  private analyzeError(error: Error, errorInfo: React.ErrorInfo): ErrorAnalysis {
    const errorMessage = error.message.toLowerCase()
    
    // 分析错误类型
    let category = ErrorCategory.UNKNOWN_ERROR
    let severity = ErrorSeverity.MEDIUM
    let userMessageKey = 'messages.errorOccurred'
    let suggestionKeys: string[] = []
    let isRecoverable = true

    // 网络错误
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('xhr')) {
      category = ErrorCategory.NETWORK_ERROR
      severity = ErrorSeverity.MEDIUM
      userMessageKey = 'messages.networkError'
      suggestionKeys = [
        'suggestions.checkNetwork',
        'suggestions.retryOperation',
        'suggestions.refreshPage'
      ]
    }
    // 权限错误
    else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      category = ErrorCategory.PERMISSION_ERROR
      severity = ErrorSeverity.HIGH
      userMessageKey = 'messages.permissionError'
      suggestionKeys = [
        'suggestions.relogin',
        'suggestions.contactAdmin',
        'suggestions.checkAccount'
      ]
      isRecoverable = false
    }
    // 验证错误
    else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      category = ErrorCategory.VALIDATION_ERROR
      severity = ErrorSeverity.LOW
      userMessageKey = 'messages.validationError'
      suggestionKeys = [
        'suggestions.checkInput',
        'suggestions.refillForm',
        'suggestions.checkHints'
      ]
    }
    // 异步操作错误
    else if (errorMessage.includes('promise') || errorMessage.includes('async') || errorMessage.includes('await')) {
      category = ErrorCategory.ASYNC_ERROR
      severity = ErrorSeverity.MEDIUM
      userMessageKey = 'messages.asyncError'
      suggestionKeys = [
        'suggestions.retryLater',
        'suggestions.checkNetwork',
        'suggestions.refreshPage'
      ]
    }
    // React组件错误
    else if (error.stack?.includes('react') || errorMessage.includes('component') || errorMessage.includes('render')) {
      category = ErrorCategory.REACT_ERROR
      severity = ErrorSeverity.HIGH
      userMessageKey = 'messages.componentError'
      suggestionKeys = [
        'suggestions.refreshPage',
        'suggestions.clearCache',
        'suggestions.hardRefresh'
      ]
    }
    // 内存错误（通常比较严重）
    else if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      category = ErrorCategory.REACT_ERROR
      severity = ErrorSeverity.CRITICAL
      userMessageKey = 'messages.memoryError'
      suggestionKeys = [
        'suggestions.closeTabs',
        'suggestions.restartBrowser',
        'suggestions.clearBrowserData'
      ]
      isRecoverable = false
    }

    return {
      category,
      severity,
      userMessageKey,
      technicalMessage: error.message,
      suggestionKeys,
      isRecoverable
    }
  }

  private logError(error: Error, errorInfo: React.ErrorInfo, analysis: ErrorAnalysis): void {
    const logData = {
      timestamp: new Date().toISOString(),
      category: analysis.category,
      severity: analysis.severity,
      component: this.props.componentName || 'Unknown',
      userId: this.props.userId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      reactErrorInfo: {
        componentStack: errorInfo.componentStack
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryAttempts: this.state.retryAttempts
    }

    // 根据严重程度选择日志级别
    switch (analysis.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR BOUNDARY:', logData)
        break
      case ErrorSeverity.HIGH:
        console.error('🔴 HIGH SEVERITY ERROR BOUNDARY:', logData)
        break
      case ErrorSeverity.MEDIUM:
        console.warn('🟡 MEDIUM SEVERITY ERROR BOUNDARY:', logData)
        break
      case ErrorSeverity.LOW:
        console.info('🔵 LOW SEVERITY ERROR BOUNDARY:', logData)
        break
    }
  }

  private scheduleRetry(): void {
    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryAttempts), 10000)
    
    const timeout = setTimeout(() => {
      this.setState(prevState => ({ 
        retryAttempts: prevState.retryAttempts + 1 
      }))
      this.handleRetry()
    }, retryDelay)

    this.retryTimeouts.push(timeout)
  }

  private handleRetry = (): void => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorAnalysis: undefined,
      showDetails: false
    })
  }

  private handleManualRetry = (): void => {
    this.setState(prevState => ({ 
      retryAttempts: prevState.retryAttempts + 1 
    }))
    this.handleRetry()
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorAnalysis: undefined,
      retryAttempts: 0,
      showDetails: false,
      lastErrorTime: null
    })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private toggleDetails = (): void => {
    this.setState(prevState => ({ 
      showDetails: !prevState.showDetails 
    }))
  }

  private getSeverityColor(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'destructive'
      case ErrorSeverity.HIGH:
        return 'destructive'
      case ErrorSeverity.MEDIUM:
        return 'default'
      case ErrorSeverity.LOW:
        return 'secondary'
      default:
        return 'default'
    }
  }

  private getSeverityIcon(severity: ErrorSeverity): React.ReactNode {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return <Zap className="w-4 h-4" />
      case ErrorSeverity.HIGH:
        return <AlertTriangle className="w-4 h-4" />
      case ErrorSeverity.MEDIUM:
        return <Bug className="w-4 h-4" />
      case ErrorSeverity.LOW:
        return <Shield className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  public componentWillUnmount(): void {
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
    this.retryTimeouts = []
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorAnalysis, retryAttempts, maxRetries, showDetails, lastErrorTime } = this.state
      const { allowReset = true, showTechnicalDetails = false, componentName } = this.props

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-2xl mx-auto p-8">
            <div className="space-y-6">
              {/* 错误标题和严重程度 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    {errorAnalysis ? this.getSeverityIcon(errorAnalysis.severity) : <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {errorAnalysis ? (
                        <BilingualText translationKey={errorAnalysis.userMessageKey} />
                      ) : (
                        <BilingualText translationKey="messages.errorOccurred" />
                      )}
                    </h3>
                    {componentName && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        <BilingualText translationKey="messages.component" />: {componentName}
                      </p>
                    )}
                  </div>
                </div>
                
                {errorAnalysis && (
                  <Badge variant={this.getSeverityColor(errorAnalysis.severity) as "default" | "destructive" | "secondary" | "outline" | null | undefined}>
                    {errorAnalysis.severity.toUpperCase()}
                  </Badge>
                )}
              </div>

              {/* 错误信息 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {errorAnalysis?.technicalMessage || error?.message || 'Unknown error'}
                </p>
                
                {lastErrorTime && (
                  <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3 mr-1" />
                    <BilingualText translationKey="messages.occurredAt" />: {lastErrorTime.toLocaleString()}
                  </div>
                )}
              </div>

              {/* 建议解决方案 */}
              {errorAnalysis?.suggestionKeys && errorAnalysis.suggestionKeys.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    <BilingualText translationKey="messages.suggestedSolutions" />:
                  </h4>
                  <ul className="space-y-2">
                    {errorAnalysis.suggestionKeys.map((suggestionKey, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-300">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        <BilingualText translationKey={suggestionKey} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 重试信息 */}
              {retryAttempts > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <BilingualText 
                      en={`Retry attempts: ${retryAttempts}${maxRetries > 0 ? ` (max ${maxRetries})` : ''}`}
                      zh={`已尝试重试 ${retryAttempts} 次${maxRetries > 0 ? ` (最多 ${maxRetries} 次)` : ''}`}
                    />
                  </p>
                </div>
              )}

              {/* 技术详情 */}
              {(showTechnicalDetails || process.env.NODE_ENV === 'development') && (
                <Collapsible>
                  <CollapsibleTrigger
                    onClick={this.toggleDetails}
                    className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <BilingualText translationKey="messages.technicalDetails" />
                    {process.env.NODE_ENV === 'development' && (
                      <span> (<BilingualText translationKey="messages.developmentMode" />)</span>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 text-xs text-green-400 font-mono overflow-auto max-h-64">
                      <div className="mb-3">
                        <strong className="text-red-400">
                          <BilingualText translationKey="messages.errorDetails" />:
                        </strong>
                      </div>
                      <div className="mb-2">
                        <span className="text-yellow-400">
                          <BilingualText translationKey="messages.errorType" />:
                        </span> {error?.name}
                      </div>
                      <div className="mb-2">
                        <span className="text-yellow-400">
                          <BilingualText translationKey="messages.errorMessage" />:
                        </span> {error?.message}
                      </div>
                      {errorAnalysis && (
                        <>
                          <div className="mb-2">
                            <span className="text-yellow-400">
                              <BilingualText translationKey="messages.category" />:
                            </span> {errorAnalysis.category}
                          </div>
                          <div className="mb-2">
                            <span className="text-yellow-400">
                              <BilingualText translationKey="messages.severity" />:
                            </span> {errorAnalysis.severity}
                          </div>
                        </>
                      )}
                      {error?.stack && (
                        <div>
                          <span className="text-yellow-400">
                            <BilingualText translationKey="messages.stackTrace" />:
                          </span>
                          <pre className="mt-1 whitespace-pre-wrap break-all text-gray-300">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* 操作按钮 */}
              <div className="flex flex-wrap gap-3">
                {allowReset && errorAnalysis?.isRecoverable !== false && (
                  <Button
                    onClick={this.handleManualRetry}
                    disabled={retryAttempts >= maxRetries && maxRetries > 0}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <BilingualText translationKey="buttons.retry" />
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <BilingualText translationKey="messages.refreshPage" />
                </Button>
                
                <Button
                  variant="outline"
                  onClick={this.handleReset}
                  className="flex items-center space-x-2"
                >
                  <Shield className="w-4 h-4" />
                  <BilingualText translationKey="messages.resetComponent" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const subject = encodeURIComponent("Error Report - English Listening Trainer 错误报告 - 英语听力训练")
                    const body = encodeURIComponent(`
Error Details 错误详情:
- Type 类型: ${error?.name}
- Message 消息: ${error?.message}
- Component 组件: ${componentName || 'Unknown 未知'}
- Time 时间: ${lastErrorTime?.toISOString()}
- User Agent 用户代理: ${navigator.userAgent}
- Page URL 页面URL: ${window.location.href}

Please describe the steps that led to this error 请描述导致错误的操作步骤:


                    `.trim())
                    window.open(`mailto:laoli3699@qq.com?subject=${subject}&body=${body}`)
                  }}
                  className="flex items-center space-x-2"
                >
                  <Bug className="w-4 h-4" />
                  <BilingualText translationKey="messages.reportError" />
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

export default BilingualEnhancedErrorBoundary