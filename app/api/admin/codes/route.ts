import { NextRequest, NextResponse } from 'next/server'
import { databaseAdapter } from '@/lib/database-adapter'

// 简单的管理员密码验证
const ADMIN_PASSWORD = 'admin123'

function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')
    
    // 验证管理员密码
    if (!verifyAdminPassword(password || '')) {
      return NextResponse.json({ 
        error: '管理员密码错误' 
      }, { status: 401 })
    }

    // 获取所有邀请码
    const codes = await databaseAdapter.getAllInvitationCodes()
    
    return NextResponse.json({ 
      success: true,
      codes,
      count: codes.length
    })

  } catch (error) {
    console.error('Admin get codes failed:', error)
    return NextResponse.json({ 
      error: '获取失败，请稍后重试' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { password, code } = await request.json()
    
    // 验证管理员密码
    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ 
        error: '管理员密码错误' 
      }, { status: 401 })
    }

    if (!code) {
      return NextResponse.json({ 
        error: '缺少邀请码参数' 
      }, { status: 400 })
    }

    // 删除邀请码
    const success = await databaseAdapter.deleteInvitationCode(code.trim().toUpperCase())
    
    if (!success) {
      return NextResponse.json({ 
        error: '删除失败，邀请码可能不存在' 
      }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      message: `邀请码 ${code} 删除成功`
    })

  } catch (error) {
    console.error('Admin delete code failed:', error)
    return NextResponse.json({ 
      error: '删除失败，请稍后重试' 
    }, { status: 500 })
  }
}