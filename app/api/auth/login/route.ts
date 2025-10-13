import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, verifyPassword, generateJWT, validateEmail, getAuthCookieOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe = false } = await request.json()

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      )
    }

    // 查找用户
    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      )
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      )
    }

    // 生成 JWT Token
    const jwtPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    }
    const token = generateJWT(jwtPayload, rememberMe)

    // 创建响应
    const response = NextResponse.json({
      message: '登录成功',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
      },
      token
    })

    // 设置 HTTP-only Cookie
    const cookieOptions = getAuthCookieOptions(rememberMe)
    response.cookies.set('auth-token', token, cookieOptions)

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}