/**
 * TypeScript 实用类型工具集
 * 为英语听力训练应用提供类型安全保障
 */

// ==================== 基础工具类型 ====================

/**
 * 严格的非空类型，排除 null 和 undefined
 */
export type StrictNonNullable<T> = T extends null | undefined ? never : T

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * 严格的记录类型，防止索引访问返回 undefined
 */
export type StrictRecord<K extends string | number | symbol, T> = {
  [P in K]: T
}

/**
 * 获取对象的可选属性键
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

/**
 * 获取对象的必需属性键
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

// ==================== API 相关类型 ====================

/**
 * API 响应的通用类型
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * API 错误类型
 */
export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * 分页参数类型
 */
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

// ==================== 表单和验证类型 ====================

/**
 * 表单字段错误类型
 */
export interface FieldError {
  field: string
  message: string
  code?: string
}

/**
 * 表单验证结果类型
 */
export interface ValidationResult<T = Record<string, unknown>> {
  valid: boolean
  data?: T
  errors?: FieldError[]
}

// ==================== AI 服务专用类型 ====================

/**
 * AI 生成请求的基础类型
 */
export interface AIGenerationRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * AI 响应的基础类型
 */
export interface AIGenerationResponse<T = string> {
  result: T
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  finishReason: 'stop' | 'length' | 'error'
}

// ==================== 音频处理类型 ====================

/**
 * 音频生成选项
 */
export interface AudioGenerationOptions {
  speed?: number
  voice?: string
  format?: 'wav' | 'mp3' | 'flac'
  quality?: 'low' | 'medium' | 'high'
}

/**
 * 音频元数据
 */
export interface AudioMetadata {
  duration: number // 秒
  sampleRate: number
  channels: number
  bitRate?: number
  fileSize: number // 字节
}

// ==================== 数据库操作类型 ====================

/**
 * 数据库查询选项
 */
export interface QueryOptions {
  select?: string[]
  where?: Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>
  limit?: number
  offset?: number
}

/**
 * 数据库操作结果
 */
export interface DatabaseResult<T = unknown> {
  success: boolean
  data?: T
  rowsAffected?: number
  insertId?: number | string
  error?: string
}

// ==================== 错误处理类型 ====================

/**
 * 应用错误代码枚举
 */
export enum ErrorCode {
  // 通用错误
  UNKNOWN = 'UNKNOWN',
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  
  // 邀请码相关
  INVALID_INVITATION_CODE = 'INVALID_INVITATION_CODE',
  INVITATION_CODE_EXPIRED = 'INVITATION_CODE_EXPIRED',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  
  // AI 服务相关
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  
  // TTS 相关
  TTS_SERVICE_UNAVAILABLE = 'TTS_SERVICE_UNAVAILABLE',
  TTS_GENERATION_FAILED = 'TTS_GENERATION_FAILED',
  AUDIO_FILE_NOT_FOUND = 'AUDIO_FILE_NOT_FOUND',
  
  // 数据库相关
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED'
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 检查值是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * 检查值是否为数字
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * 检查值是否为对象（非 null）
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 检查值是否为数组
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value)
}

/**
 * 检查对象是否具有指定属性
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj
}

/**
 * 安全的对象属性访问
 */
export function safeGet<T>(
  obj: Record<string, unknown>,
  key: string,
  defaultValue: T
): T {
  const value = obj[key]
  return value !== undefined ? (value as T) : defaultValue
}

// ==================== 实用函数 ====================

/**
 * 移除对象中的 undefined 属性
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T]
    }
  }
  return result
}

/**
 * 深度克隆对象（简单实现）
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T
  }
  
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

/**
 * 类型安全的数组访问
 */
export function safeArrayAccess<T>(
  array: T[],
  index: number,
  defaultValue: T
): T {
  return array[index] !== undefined ? array[index] : defaultValue
}

/**
 * 创建类型安全的枚举检查函数
 */
export function createEnumChecker<T extends Record<string, string | number>>(
  enumObject: T
) {
  const values = Object.values(enumObject)
  return (value: unknown): value is T[keyof T] => {
    return values.includes(value as string | number)
  }
}

// ==================== 特定业务类型检查 ====================

/**
 * 检查是否为有效的难度级别
 */
export function isValidDifficulty(value: unknown): value is 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  return isString(value) && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value)
}

/**
 * 检查是否为有效的题目类型
 */
export function isValidQuestionType(value: unknown): value is 'single' | 'short' {
  return isString(value) && ['single', 'short'].includes(value)
}

/**
 * 检查是否为有效的邀请码格式（6位字母数字）
 */
export function isValidInvitationCode(value: unknown): value is string {
  return isString(value) && /^[A-Z0-9]{6}$/.test(value)
}

export default {
  // 类型导出
  ErrorCode,
  AppError,
  
  // 类型守卫
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  hasProperty,
  
  // 实用函数
  safeGet,
  removeUndefined,
  deepClone,
  safeArrayAccess,
  createEnumChecker,
  
  // 业务类型检查
  isValidDifficulty,
  isValidQuestionType,
  isValidInvitationCode
}