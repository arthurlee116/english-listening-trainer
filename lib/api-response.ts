/**
 * 统一API响应格式和错误处理机制
 * 提供标准化的响应格式和错误处理工具
 */

import { NextResponse } from 'next/server'

// 标准API响应接口
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    version: string
    requestId?: string
    [key: string]: any  // 允许额外的属性
  }
}

// 分页响应接口
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// 错误代码枚举
export enum ErrorCode {
  // 通用错误 (1xxx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 认证错误 (2xxx)
  INVALID_INVITATION_CODE = 'INVALID_INVITATION_CODE',
  INVITATION_CODE_NOT_FOUND = 'INVITATION_CODE_NOT_FOUND',
  INVITATION_CODE_EXPIRED = 'INVITATION_CODE_EXPIRED',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // 资源错误 (3xxx)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // 业务逻辑错误 (4xxx)
  EXERCISE_SAVE_FAILED = 'EXERCISE_SAVE_FAILED',
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  TTS_GENERATION_FAILED = 'TTS_GENERATION_FAILED',
  WRONG_ANSWER_SAVE_FAILED = 'WRONG_ANSWER_SAVE_FAILED',
  
  // 外部服务错误 (5xxx)
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  TTS_SERVICE_UNAVAILABLE = 'TTS_SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

// 错误代码到HTTP状态码的映射
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.MISSING_PARAMETERS]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  
  [ErrorCode.INVALID_INVITATION_CODE]: 401,
  [ErrorCode.INVITATION_CODE_NOT_FOUND]: 404,
  [ErrorCode.INVITATION_CODE_EXPIRED]: 401,
  [ErrorCode.DAILY_LIMIT_EXCEEDED]: 429,
  [ErrorCode.ACCESS_DENIED]: 403,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  
  [ErrorCode.EXERCISE_SAVE_FAILED]: 500,
  [ErrorCode.AI_GENERATION_FAILED]: 500,
  [ErrorCode.TTS_GENERATION_FAILED]: 500,
  [ErrorCode.WRONG_ANSWER_SAVE_FAILED]: 500,
  
  [ErrorCode.AI_SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TTS_SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500
}

// 错误代码到中文消息的映射
const ERROR_MESSAGE_MAP: Record<ErrorCode, string> = {
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.INVALID_REQUEST]: '请求格式不正确',
  [ErrorCode.MISSING_PARAMETERS]: '缺少必要参数',
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  
  [ErrorCode.INVALID_INVITATION_CODE]: '邀请码格式不正确',
  [ErrorCode.INVITATION_CODE_NOT_FOUND]: '邀请码不存在或已过期',
  [ErrorCode.INVITATION_CODE_EXPIRED]: '邀请码已过期',
  [ErrorCode.DAILY_LIMIT_EXCEEDED]: '今日使用次数已达上限',
  [ErrorCode.ACCESS_DENIED]: '访问被拒绝',
  [ErrorCode.TOO_MANY_REQUESTS]: '请求过于频繁，请稍后再试',
  
  [ErrorCode.RESOURCE_NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: '资源已存在',
  [ErrorCode.RESOURCE_CONFLICT]: '资源冲突',
  
  [ErrorCode.EXERCISE_SAVE_FAILED]: '练习保存失败',
  [ErrorCode.AI_GENERATION_FAILED]: 'AI内容生成失败',
  [ErrorCode.TTS_GENERATION_FAILED]: '语音合成失败',
  [ErrorCode.WRONG_ANSWER_SAVE_FAILED]: '错题保存失败',
  
  [ErrorCode.AI_SERVICE_UNAVAILABLE]: 'AI服务暂时不可用',
  [ErrorCode.TTS_SERVICE_UNAVAILABLE]: '语音服务暂时不可用',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败'
}

// API版本常量
export const API_VERSION = 'v1'

/**
 * 生成请求ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ApiResponse['meta']>
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      ...meta
    }
  }
  
  return NextResponse.json(response)
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginatedResponse<T>['pagination'],
  meta?: Partial<ApiResponse['meta']>
): NextResponse {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      ...meta
    }
  }
  
  return NextResponse.json(response)
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: any,
  customMessage?: string,
  meta?: Partial<ApiResponse['meta']>
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message: customMessage || ERROR_MESSAGE_MAP[code],
      details
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      ...meta
    }
  }
  
  const statusCode = ERROR_STATUS_MAP[code] || 500
  
  return NextResponse.json(response, { status: statusCode })
}

/**
 * 异常处理装饰器
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const result = await handler(...args)
      
      // 如果结果已经是NextResponse，直接返回
      if (result instanceof NextResponse) {
        return result
      }
      
      // 否则包装成成功响应
      return createSuccessResponse(result)
    } catch (error) {
      console.error('API Handler Error:', error)
      
      // 如果是已知的业务错误，使用对应的错误代码
      if (error instanceof ApiError) {
        return createErrorResponse(error.code, error.details, error.message)
      }
      
      // 未知错误，返回通用内部错误
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        process.env.NODE_ENV === 'development' ? {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        } : undefined
      )
    }
  }
}

/**
 * 自定义API错误类
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: any
  ) {
    super(message || ERROR_MESSAGE_MAP[code])
    this.name = 'ApiError'
  }
}

/**
 * 快速创建常用错误
 */
export const createApiError = {
  invalidRequest: (details?: any) => new ApiError(ErrorCode.INVALID_REQUEST, undefined, details),
  missingParameters: (params: string[]) => new ApiError(ErrorCode.MISSING_PARAMETERS, `缺少参数: ${params.join(', ')}`, { missingParams: params }),
  validationError: (details: any) => new ApiError(ErrorCode.VALIDATION_ERROR, undefined, details),
  invalidInvitationCode: () => new ApiError(ErrorCode.INVALID_INVITATION_CODE),
  invitationCodeNotFound: () => new ApiError(ErrorCode.INVITATION_CODE_NOT_FOUND),
  dailyLimitExceeded: (current: number, limit: number) => new ApiError(ErrorCode.DAILY_LIMIT_EXCEEDED, `今日已使用${current}/${limit}次`, { current, limit }),
  rateLimitExceeded: (message?: string) => new ApiError(ErrorCode.TOO_MANY_REQUESTS, message),
  resourceNotFound: (resource: string) => new ApiError(ErrorCode.RESOURCE_NOT_FOUND, `${resource}不存在`),
  databaseError: (details?: any) => new ApiError(ErrorCode.DATABASE_ERROR, undefined, details),
  aiServiceUnavailable: () => new ApiError(ErrorCode.AI_SERVICE_UNAVAILABLE),
  ttsServiceUnavailable: () => new ApiError(ErrorCode.TTS_SERVICE_UNAVAILABLE)
}

/**
 * 分页参数验证和处理
 */
export function validatePaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
  const offset = (page - 1) * limit
  
  return { page, limit, offset }
}

/**
 * 构建分页信息
 */
export function buildPaginationInfo(
  page: number,
  limit: number,
  total: number
) {
  const totalPages = Math.ceil(total / limit)
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}