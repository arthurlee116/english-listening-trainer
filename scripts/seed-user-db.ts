#!/usr/bin/env tsx

/**
 * 用户系统数据库初始化脚本
 * 创建默认管理员账号和初始数据
 */

import { PrismaClient } from '@prisma/client'
import { createUser } from '../lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 开始初始化用户系统数据库...')

  try {
    // 检查数据库连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 从环境变量获取管理员账号信息
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@listeningtrain.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456'
    const adminName = process.env.ADMIN_NAME || 'System Administrator'

    console.log(`📧 管理员邮箱: ${adminEmail}`)

    // 检查管理员账号是否已存在
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      console.log('⚠️  管理员账号已存在，跳过创建')
      
      // 如果不是管理员，则更新为管理员
      if (!existingAdmin.isAdmin) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { isAdmin: true }
        })
        console.log('✅ 已将现有用户升级为管理员')
      }
    } else {
      // 创建管理员账号
      console.log('👤 创建默认管理员账号...')
      
      const admin = await createUser(adminEmail, adminPassword, adminName, true)
      
      if (admin) {
        console.log('✅ 管理员账号创建成功')
        console.log(`   邮箱: ${admin.email}`)
        console.log(`   姓名: ${admin.name}`)
        console.log(`   ID: ${admin.id}`)
      } else {
        throw new Error('管理员账号创建失败')
      }
    }

    // 显示数据库统计信息
    const userCount = await prisma.user.count()
    const sessionCount = await prisma.practiceSession.count()
    
    console.log('\n📊 数据库统计:')
    console.log(`   用户总数: ${userCount}`)
    console.log(`   练习会话总数: ${sessionCount}`)

    // 显示登录信息
    console.log('\n🔑 管理员登录信息:')
    console.log(`   邮箱: ${adminEmail}`)
    console.log(`   密码: ${adminPassword}`)
    console.log(`   登录地址: http://localhost:3000/admin`)

    console.log('\n✨ 数据库初始化完成！')

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 错误处理
process.on('unhandledRejection', (err) => {
  console.error('❌ 未处理的 Promise 拒绝:', err)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err)
  process.exit(1)
})

// 执行主函数
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})