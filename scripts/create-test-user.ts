#!/usr/bin/env tsx

/**
 * 创建测试用户账号脚本
 */

import { PrismaClient } from '@prisma/client'
import { createUser } from '../lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 创建测试用户账号...')

  try {
    // 检查数据库连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 测试用户信息
    const testEmail = 'test@example.com'
    const testPassword = 'Test123456'
    const testName = '测试用户'

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail }
    })

    if (existingUser) {
      console.log('⚠️  测试用户账号已存在，跳过创建')
      console.log(`   邮箱: ${existingUser.email}`)
      console.log(`   姓名: ${existingUser.name}`)
    } else {
      // 创建测试用户账号
      console.log('👤 创建测试用户账号...')
      
      const user = await createUser(testEmail, testPassword, testName, false)
      
      if (user) {
        console.log('✅ 测试用户账号创建成功')
        console.log(`   邮箱: ${user.email}`)
        console.log(`   姓名: ${user.name}`)
        console.log(`   ID: ${user.id}`)
      } else {
        throw new Error('测试用户账号创建失败')
      }
    }

    // 显示登录信息
    console.log('\n🔑 测试用户登录信息:')
    console.log(`   邮箱: ${testEmail}`)
    console.log(`   密码: ${testPassword}`)
    console.log(`   登录地址: http://localhost:3000`)

    console.log('\n✨ 测试用户创建完成！')

  } catch (error) {
    console.error('❌ 创建测试用户失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行主函数
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})