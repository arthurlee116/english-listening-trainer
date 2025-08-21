/**
 * 数据验证和输入清理系统
 * 提供统一的数据验证规则和中间件
 */

import { NextRequest } from 'next/server'
import { ApiError, createApiError } from './api-response'
import type { DifficultyLevel, QuestionType } from './types'

// 验证规则接口
export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object'
  min?: number
  max?: number
  pattern?: RegExp
  enum?: readonly string[]
  custom?: (value: any) => boolean | string
}

// 验证模式定义
export interface ValidationSchema {
  [key: string]: ValidationRule
}

/**
 * 验证单个字段
 */
export function validateField(
  value: any,
  fieldName: string,
  rule: ValidationRule
): { isValid: boolean; error?: string } {
  // 检查必填项
  if (rule.required && (value === undefined || value === null || value === '')) {
    return { isValid: false, error: `${fieldName} 是必填项` }
  }
  
  // 如果值为空且非必填，则跳过其他验证
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { isValid: true }
  }
  
  // 类型验证
  if (rule.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value
    if (actualType !== rule.type) {
      return { isValid: false, error: `${fieldName} 类型错误，期望 ${rule.type}，实际 ${actualType}` }
    }
  }
  
  // 字符串长度验证
  if (rule.type === 'string' && typeof value === 'string') {
    if (rule.min !== undefined && value.length < rule.min) {
      return { isValid: false, error: `${fieldName} 长度不能少于 ${rule.min} 个字符` }
    }
    if (rule.max !== undefined && value.length > rule.max) {
      return { isValid: false, error: `${fieldName} 长度不能超过 ${rule.max} 个字符` }
    }
  }
  
  // 数字范围验证
  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return { isValid: false, error: `${fieldName} 不能小于 ${rule.min}` }
    }
    if (rule.max !== undefined && value > rule.max) {
      return { isValid: false, error: `${fieldName} 不能大于 ${rule.max}` }
    }
  }
  
  // 数组长度验证
  if (rule.type === 'array' && Array.isArray(value)) {
    if (rule.min !== undefined && value.length < rule.min) {
      return { isValid: false, error: `${fieldName} 至少需要 ${rule.min} 个项目` }
    }
    if (rule.max !== undefined && value.length > rule.max) {
      return { isValid: false, error: `${fieldName} 最多只能有 ${rule.max} 个项目` }
    }
  }
  
  // 正则表达式验证
  if (rule.pattern && typeof value === 'string') {
    if (!rule.pattern.test(value)) {
      return { isValid: false, error: `${fieldName} 格式不正确` }
    }
  }
  
  // 枚举值验证
  if (rule.enum && !rule.enum.includes(value)) {
    return { isValid: false, error: `${fieldName} 必须是以下值之一: ${rule.enum.join(', ')}` }
  }
  
  // 自定义验证
  if (rule.custom) {
    const customResult = rule.custom(value)
    if (typeof customResult === 'string') {
      return { isValid: false, error: customResult }
    }
    if (!customResult) {
      return { isValid: false, error: `${fieldName} 验证失败` }
    }
  }
  
  return { isValid: true }
}

/**
 * 验证数据对象
 */
export function validateData(
  data: any,
  schema: ValidationSchema
): { isValid: boolean; errors: string[]; validData: any } {
  const errors: string[] = []
  const validData: any = {}
  
  // 验证必填字段
  for (const [fieldName, rule] of Object.entries(schema)) {
    const result = validateField(data[fieldName], fieldName, rule)
    
    if (!result.isValid) {
      errors.push(result.error!)
    } else {
      validData[fieldName] = data[fieldName]
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    validData
  }
}

/**
 * 输入清理函数
 */
export const sanitize = {
  // 清理字符串，移除HTML标签和多余空白
  string: (value: string): string => {
    return value
      .toString()
      .replace(/<[^>]*>/g, '') // 移除HTML标签
      .replace(/\s+/g, ' ') // 合并多个空白字符
      .trim()
  },
  
  // 清理邀请码
  invitationCode: (value: string): string => {
    return value
      .toString()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') // 只保留字母和数字
      .trim()
  },
  
  // 清理数字
  number: (value: any): number => {
    const num = Number(value)
    return isNaN(num) ? 0 : num
  },
  
  // 清理布尔值
  boolean: (value: any): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
    }
    return Boolean(value)
  }
}

// 常用验证模式
export const commonSchemas = {
  // 邀请码验证
  invitationCode: {
    code: {
      required: true,
      type: 'string' as const,
      min: 6,
      max: 8,
      pattern: /^[A-Z0-9]{6,8}$/,
      custom: (value: string) => {
        const cleaned = sanitize.invitationCode(value)
        return cleaned.length >= 6 && cleaned.length <= 8
      }
    }
  },
  
  // 练习保存验证
  exerciseSave: {
    exercise: {
      required: true,
      type: 'object' as const,
      custom: (value: any) => {
        return value && 
               typeof value.id === 'string' &&
               typeof value.difficulty === 'string' &&
               typeof value.topic === 'string' &&
               typeof value.transcript === 'string' &&
               Array.isArray(value.questions) &&
               typeof value.answers === 'object'
      }
    },
    invitationCode: {
      required: true,
      type: 'string' as const,
      pattern: /^[A-Z0-9]{6,8}$/
    }
  },
  
  // AI生成参数验证
  aiGeneration: {
    difficulty: {
      required: true,
      type: 'string' as const,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
    },
    wordCount: {
      required: true,
      type: 'number' as const,
      min: 50,
      max: 500
    },
    topic: {
      required: true,
      type: 'string' as const,
      min: 3,
      max: 200
    }
  },
  
  // 分页参数验证
  pagination: {
    page: {
      type: 'number' as const,
      min: 1,
      max: 1000
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 100
    }
  },
  
  // 错题筛选验证
  wrongAnswersFilter: {
    tags: {
      type: 'array' as const,
      max: 10
    },
    category: {
      type: 'string' as const,
      enum: ['error-type', 'knowledge', 'context', 'difficulty'] as const
    },
    limit: {
      type: 'number' as const,
      min: 1,
      max: 100
    },
    offset: {
      type: 'number' as const,
      min: 0
    }
  }
}

/**
 * 请求体验证中间件
 */
export async function validateRequestBody(
  request: NextRequest,
  schema: ValidationSchema
): Promise<{ isValid: boolean; data?: any; errors?: string[] }> {
  try {
    const body = await request.json()
    const result = validateData(body, schema)
    
    if (!result.isValid) {
      throw createApiError.validationError({
        errors: result.errors,
        receivedData: body
      })
    }
    
    return {
      isValid: true,
      data: result.validData
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    
    throw createApiError.invalidRequest({
      message: '请求体格式错误，应为有效的JSON',
      originalError: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * 查询参数验证
 */
export function validateQueryParams(
  searchParams: URLSearchParams,
  schema: ValidationSchema
): { isValid: boolean; data?: any; errors?: string[] } {
  const data: any = {}
  
  // 转换URL参数为对象
  for (const [key, value] of searchParams.entries()) {
    if (schema[key]) {
      // 根据类型转换参数值
      switch (schema[key].type) {
        case 'number':
          data[key] = parseInt(value) || undefined
          break
        case 'boolean':
          data[key] = sanitize.boolean(value)
          break
        case 'array':
          data[key] = value.split(',').map(item => item.trim()).filter(Boolean)
          break
        default:
          data[key] = value
      }
    }
  }
  
  const result = validateData(data, schema)
  
  if (!result.isValid) {
    throw createApiError.validationError({
      errors: result.errors,
      receivedParams: Object.fromEntries(searchParams.entries())
    })
  }
  
  return {
    isValid: true,
    data: result.validData
  }
}

/**
 * 难度级别验证
 */
export function validateDifficulty(difficulty: string): DifficultyLevel {
  const validDifficulties: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  
  if (!validDifficulties.includes(difficulty as DifficultyLevel)) {
    throw createApiError.validationError({
      field: 'difficulty',
      message: `难度级别必须是以下值之一: ${validDifficulties.join(', ')}`,
      received: difficulty
    })
  }
  
  return difficulty as DifficultyLevel
}

/**
 * 题目类型验证
 */
export function validateQuestionType(type: string): QuestionType {
  const validTypes: QuestionType[] = ['single', 'short']
  
  if (!validTypes.includes(type as QuestionType)) {
    throw createApiError.validationError({
      field: 'type',
      message: `题目类型必须是以下值之一: ${validTypes.join(', ')}`,
      received: type
    })
  }
  
  return type as QuestionType
}

/**
 * 文本长度验证（用于AI生成）
 */
export function validateTextLength(text: string, min: number, max: number): boolean {
  const length = text.trim().length
  return length >= min && length <= max
}

/**
 * UUID格式验证
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * 邀请码格式验证和清理
 */
export function validateAndCleanInvitationCode(code: string): string {
  if (!code || typeof code !== 'string') {
    throw createApiError.invalidInvitationCode()
  }
  
  const cleanedCode = sanitize.invitationCode(code)
  
  if (!/^[A-Z0-9]{6,8}$/.test(cleanedCode)) {
    throw createApiError.invalidInvitationCode()
  }
  
  return cleanedCode
}