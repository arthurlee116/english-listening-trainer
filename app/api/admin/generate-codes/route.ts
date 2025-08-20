import { NextRequest, NextResponse } from 'next/server'
import { dbOperations, generateInvitationCode } from '@/lib/db'

// 简单的管理员密码验证
const ADMIN_PASSWORD = 'admin123' // 在生产环境中应该使用环境变量

function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

export async function POST(request: NextRequest) {
  try {
    const { password, count = 1, length = 6 } = await request.json()
    
    // 验证管理员密码
    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ 
        error: '管理员密码错误' 
      }, { status: 401 })
    }

    // 验证参数
    if (count < 1 || count > 100) {
      return NextResponse.json({ 
        error: '生成数量应在1-100之间' 
      }, { status: 400 })
    }

    if (length < 6 || length > 8) {
      return NextResponse.json({ 
        error: '邀请码长度应在6-8位之间' 
      }, { status: 400 })
    }

    // 生成邀请码
    const codes: string[] = []
    const maxAttempts = count * 10 // 防止无限循环
    let attempts = 0
    
    while (codes.length < count && attempts < maxAttempts) {
      const code = generateInvitationCode(length)
      
      // 检查是否重复
      if (!codes.includes(code)) {
        codes.push(code)
      }
      
      attempts++
    }

    if (codes.length < count) {
      return NextResponse.json({ 
        error: '生成邀请码时发生重复，请重试' 
      }, { status: 500 })
    }

    // 批量创建邀请码
    const successCount = dbOperations.createMultipleInvitationCodes(codes)
    
    if (successCount === 0) {
      return NextResponse.json({ 
        error: '所有邀请码创建失败，可能存在重复' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      generated: successCount,
      codes: codes.slice(0, successCount),
      message: `成功生成 ${successCount} 个邀请码`
    })

  } catch (error) {
    console.error('Admin generate codes failed:', error)
    return NextResponse.json({ 
      error: '生成失败，请稍后重试' 
    }, { status: 500 })
  }
}