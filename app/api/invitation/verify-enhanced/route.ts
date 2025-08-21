/**
 * 增强版邀请码验证API
 * 使用新的统一数据库操作和错误处理
 */

import { NextRequest, NextResponse } from 'next/server'
import { DatabaseOperations } from '@/lib/db-unified'
import { ErrorHandler, ErrorCode, ErrorSeverity } from '@/lib/error-handler'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    
    if (!code || typeof code !== 'string') {
      const error = ErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Missing invitation code',
        ErrorSeverity.LOW,
        '请输入邀请码'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 400 })
    }

    // 清理和标准化邀请码
    const invitationCode = code.trim().toUpperCase()
    
    if (!/^[A-Z0-9]{6,8}$/.test(invitationCode)) {
      const error = ErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid invitation code format',
        ErrorSeverity.LOW,
        '邀请码格式不正确，应为6-8位字母数字组合'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 400 })
    }

    // 验证邀请码是否存在
    const isValid = DatabaseOperations.verifyInvitationCode(invitationCode)
    
    if (!isValid) {
      const error = ErrorHandler.createError(
        ErrorCode.INVALID_INVITATION_CODE,
        'Invitation code not found',
        ErrorSeverity.MEDIUM,
        '邀请码不存在或已过期'
      )
      
      return NextResponse.json({ 
        error: error.userMessage 
      }, { status: 404 })
    }

    // 检查今日使用次数
    const todayUsage = DatabaseOperations.getTodayUsageCount(invitationCode)
    const remainingUsage = Math.max(0, 5 - todayUsage)
    
    if (remainingUsage <= 0) {
      const error = ErrorHandler.createError(
        ErrorCode.USAGE_LIMIT_EXCEEDED,
        'Daily usage limit exceeded',
        ErrorSeverity.MEDIUM,
        '今日使用次数已用完，请明天再来'
      )
      
      return NextResponse.json({ 
        error: error.userMessage,
        code: invitationCode,
        todayUsage,
        remainingUsage: 0
      }, { status: 429 })
    }
    
    return NextResponse.json({ 
      success: true,
      code: invitationCode,
      todayUsage,
      remainingUsage,
      message: '邀请码验证成功'
    })

  } catch (error) {
    const appError = ErrorHandler.wrapError(
      error as Error,
      ErrorCode.INTERNAL_SERVER_ERROR,
      ErrorSeverity.HIGH,
      '验证失败，请稍后重试'
    )
    
    return NextResponse.json({ 
      error: appError.userMessage 
    }, { status: 500 })
  }
}

// 健康检查端点
export async function GET() {
  try {
    const healthCheck = DatabaseOperations.healthCheck()
    
    if (healthCheck.status === 'healthy') {
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      })
    } else {
      return NextResponse.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'error'
      }, { status: 503 })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'error'
    }, { status: 503 })
  }
}