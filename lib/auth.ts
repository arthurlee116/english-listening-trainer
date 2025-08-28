import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// JWT 密钥 - 生产环境应从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// 删除不需要的JWT_OPTIONS常量

export interface User {
  id: string
  email: string
  name?: string | null
  isAdmin: boolean
  createdAt: Date
  updatedAt: Date
}

export interface JWTPayload {
  userId: string
  email: string
  isAdmin: boolean
  iat?: number
  exp?: number
}

// ==========================================
// 密码相关工具函数
// ==========================================

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

/**
 * 验证密码复杂度
 * 要求：最少8位，包含大写字母、小写字母、数字
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('密码至少需要8位字符')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ==========================================
// JWT 相关工具函数  
// ==========================================

/**
 * 生成 JWT Token
 */
export function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string {
  const options: jwt.SignOptions = rememberMe 
    ? {} // 永不过期（不设置expiresIn）
    : { expiresIn: '24h' } // 24小时过期
    
  return jwt.sign(payload, JWT_SECRET, options)
}

/**
 * 验证 JWT Token
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * 从请求中提取用户信息
 */
export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  try {
    // 尝试从 Authorization header 获取
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      return verifyJWT(token)
    }
    
    // 尝试从 Cookie 获取
    const token = request.cookies.get('auth-token')?.value
    if (token) {
      return verifyJWT(token)
    }
    
    return null
  } catch (error) {
    console.error('Failed to get user from request:', error)
    return null
  }
}

// ==========================================
// 用户相关工具函数
// ==========================================

/**
 * 根据邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })
    return user
  } catch (error) {
    console.error('Failed to find user by email:', error)
    return null
  }
}

/**
 * 根据ID查找用户
 */
export async function findUserById(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    })
    return user
  } catch (error) {
    console.error('Failed to find user by ID:', error)
    return null
  }
}

/**
 * 创建新用户
 */
export async function createUser(
  email: string, 
  password: string, 
  name?: string,
  isAdmin: boolean = false
): Promise<User | null> {
  try {
    const hashedPassword = await hashPassword(password)
    
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        isAdmin
      }
    })
    
    return user
  } catch (error) {
    console.error('Failed to create user:', error)
    return null
  }
}

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 中间件：检查用户是否已认证
 */
export async function requireAuth(request: NextRequest): Promise<{ user: JWTPayload | null, error?: string }> {
  const user = getUserFromRequest(request)
  
  if (!user) {
    return { user: null, error: '未登录' }
  }
  
  // 验证用户是否仍然存在
  const dbUser = await findUserById(user.userId)
  if (!dbUser) {
    return { user: null, error: '用户不存在' }
  }
  
  return { user }
}

/**
 * 中间件：检查管理员权限
 */
export async function requireAdmin(request: NextRequest): Promise<{ user: JWTPayload | null, error?: string }> {
  const authResult = await requireAuth(request)
  
  if (authResult.error || !authResult.user) {
    return authResult
  }
  
  if (!authResult.user.isAdmin) {
    return { user: null, error: '需要管理员权限' }
  }
  
  return authResult
}

// ==========================================
// Cookie 工具函数
// ==========================================

/**
 * 设置认证 Cookie 选项
 */
export function getAuthCookieOptions(rememberMe: boolean = false) {
  const maxAge = rememberMe ? 365 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 记住我：1年，否则1天
  
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/'
  }
}