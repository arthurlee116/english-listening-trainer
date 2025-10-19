import { NextRequest, NextResponse } from 'next/server'
import { createUser, findUserByEmail, validateEmail, validatePasswordStrength, generateJWT, getAuthCookieOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

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

    // 验证密码复杂度
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { 
          error: '密码不符合要求',
          details: passwordValidation.errors
        },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 409 }
      )
    }

    // 创建用户
    const user = await createUser(email, password, name)
    if (!user) {
      return NextResponse.json(
        { error: '用户创建失败，请稍后重试' },
        { status: 500 }
      )
    }

    // 生成 JWT Token 实现自动登录
    const jwtPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    }
    const token = generateJWT(jwtPayload, false) // 注册默认不勾选"记住我"

    // 创建响应（不包含敏感信息）
    const response = NextResponse.json({
      message: '注册成功',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    }, { status: 201 })

    // 设置 HTTP-only Cookie 实现自动登录
    const cookieOptions = getAuthCookieOptions(false)
    response.cookies.set('auth-token', token, cookieOptions)

    return response

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}