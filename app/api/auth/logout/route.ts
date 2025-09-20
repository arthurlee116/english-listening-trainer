import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, clearUserCache } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // 获取当前用户身份（用于清除缓存）
    const user = getUserFromRequest(request)

    // 创建响应
    const response = NextResponse.json({
      message: '登出成功'
    })

    // 清除认证 Cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })

    // 清除用户缓存，防止滞留认证信息
    if (user) {
      clearUserCache(user.userId)
      console.log(`🔄 Cleared cache for user: ${user.email}`)
    }

    return response

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: '登出失败，请稍后重试' },
      { status: 500 }
    )
  }
}
