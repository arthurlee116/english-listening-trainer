import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { withDatabase } from '@/lib/database'

/**
 * 注册后自动登录功能集成测试
 * 
 * 测试场景：
 * 1. 用户注册成功后应该收到token和用户信息
 * 2. 注册API应该设置auth-token cookie
 * 3. 注册返回的用户信息应包含updatedAt字段
 */
describe('注册后自动登录', () => {
  const testEmail = `test-auto-login-${Date.now()}@example.com`
  const testPassword = 'Password123'
  const testName = '测试用户'

  beforeEach(async () => {
    // 清理测试数据
    await withDatabase(
      async (client) => {
        await client.user.deleteMany({
          where: { email: testEmail }
        })
      },
      'cleanup test user'
    )
  })

  afterEach(async () => {
    // 清理测试数据
    await withDatabase(
      async (client) => {
        await client.user.deleteMany({
          where: { email: testEmail }
        })
      },
      'cleanup test user'
    )
  })

  it('注册成功后应返回token和完整用户信息', async () => {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName
      })
    })

    expect(response.status).toBe(201)
    
    const data = await response.json()
    
    // 验证返回的数据结构
    expect(data).toHaveProperty('message', '注册成功')
    expect(data).toHaveProperty('token')
    expect(data).toHaveProperty('user')
    
    // 验证用户信息完整性
    expect(data.user).toHaveProperty('id')
    expect(data.user).toHaveProperty('email', testEmail)
    expect(data.user).toHaveProperty('name', testName)
    expect(data.user).toHaveProperty('isAdmin', false)
    expect(data.user).toHaveProperty('createdAt')
    expect(data.user).toHaveProperty('updatedAt')
    
    // 验证token是字符串且不为空
    expect(typeof data.token).toBe('string')
    expect(data.token.length).toBeGreaterThan(0)
  })

  it('注册成功后应设置auth-token cookie', async () => {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName
      })
    })

    expect(response.status).toBe(201)
    
    // 验证cookie设置
    const setCookieHeader = response.headers.get('set-cookie')
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain('auth-token=')
    expect(setCookieHeader).toContain('HttpOnly')
    expect(setCookieHeader).toContain('Path=/')
  })

  it('注册后可以使用token访问受保护的API', async () => {
    // 先注册
    const registerResponse = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName
      })
    })

    expect(registerResponse.status).toBe(201)
    const registerData = await registerResponse.json()
    const token = registerData.token

    // 使用token访问受保护的API
    const meResponse = await fetch('http://localhost:3000/api/auth/me', {
      headers: {
        'Cookie': `auth-token=${token}`
      }
    })

    expect(meResponse.status).toBe(200)
    const meData = await meResponse.json()
    
    expect(meData).toHaveProperty('user')
    expect(meData.user.email).toBe(testEmail)
    expect(meData.user.name).toBe(testName)
  })
})
