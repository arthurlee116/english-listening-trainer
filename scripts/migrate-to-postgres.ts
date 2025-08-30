#!/usr/bin/env tsx

/**
 * SQLite 到 PostgreSQL 数据迁移脚本
 * 同时进行架构迁移：从邀请码系统到用户认证系统
 */

import { PrismaClient } from '@prisma/client'
import Database from 'better-sqlite3'
import { createUser } from '../lib/auth'
import path from 'path'

// 源 SQLite 数据库（旧系统）
const sourceDbPath = path.join(process.cwd(), 'data', 'app.db')
const sourceDb = new Database(sourceDbPath, { readonly: true })

// 目标 Prisma 客户端（新系统，支持多数据库）
const targetDb = new PrismaClient()

interface LegacyInvitation {
  id: string
  code: string
  used_by: string | null
  created_at: string
  used_at: string | null
  usage_count: number
}

interface LegacyExercise {
  id: string
  invitation_code: string
  exercise_data: string
  difficulty: string
  language: string
  topic: string
  accuracy: number | null
  score: number | null
  duration: number | null
  created_at: string
}

interface LegacyDailyUsage {
  id: string
  date: string
  invitation_code: string
  session_count: number
  total_duration: number
  avg_accuracy: number
  created_at: string
}

interface MigrationStats {
  invitations: number
  exercises: number
  dailyUsage: number
  createdUsers: number
  createdPracticeSessions: number
  skippedRecords: number
}

async function main() {
  console.log('🚀 开始数据库迁移：SQLite (邀请码系统) → PostgreSQL (用户认证系统)')
  console.log('=' .repeat(80))

  const stats: MigrationStats = {
    invitations: 0,
    exercises: 0,
    dailyUsage: 0,
    createdUsers: 0,
    createdPracticeSessions: 0,
    skippedRecords: 0
  }

  try {
    // 检查目标数据库连接
    await targetDb.$connect()
    console.log('✅ 目标数据库连接成功')

    // 检查源数据库
    const tables = sourceDb.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all()
    console.log('📊 源数据库表：', tables.map((t: unknown) => (t as { name: string }).name).join(', '))

    // 第一步：读取源数据库统计
    console.log('\n📈 分析源数据库...')
    const invitations = sourceDb.prepare('SELECT * FROM invitations ORDER BY created_at').all() as LegacyInvitation[]
    const exercises = sourceDb.prepare('SELECT * FROM exercises ORDER BY created_at').all() as LegacyExercise[]
    const dailyUsage = sourceDb.prepare('SELECT * FROM daily_usage ORDER BY date').all() as LegacyDailyUsage[]

    stats.invitations = invitations.length
    stats.exercises = exercises.length
    stats.dailyUsage = dailyUsage.length

    console.log(`   邀请码记录: ${stats.invitations}`)
    console.log(`   练习记录: ${stats.exercises}`)
    console.log(`   日常使用记录: ${stats.dailyUsage}`)

    // 第二步：创建用户账号（基于邀请码）
    console.log('\n👤 创建用户账号...')
    const userMap = new Map<string, string>() // invitation_code -> user_id

    for (const invitation of invitations) {
      if (invitation.used_by) {
        // 为已使用的邀请码创建用户
        const email = `user-${invitation.code}@listeningtrain.com`
        const password = `Temp123456`
        const name = invitation.used_by || `User ${invitation.code}`
        
        try {
          const existingUser = await targetDb.user.findUnique({
            where: { email }
          })

          if (!existingUser) {
            const newUser = await createUser(email, password, name, false)
            if (newUser) {
              userMap.set(invitation.code, newUser.id)
              stats.createdUsers++
              console.log(`   ✓ 创建用户: ${email} (基于邀请码: ${invitation.code})`)
            }
          } else {
            userMap.set(invitation.code, existingUser.id)
            console.log(`   ⚠ 用户已存在: ${email}`)
          }
        } catch (error) {
          console.log(`   ❌ 创建用户失败 (${invitation.code}):`, error)
          stats.skippedRecords++
        }
      }
    }

    // 第三步：迁移练习记录
    console.log('\n📚 迁移练习记录...')
    for (const exercise of exercises) {
      const userId = userMap.get(exercise.invitation_code)
      
      if (userId) {
        try {
          await targetDb.practiceSession.create({
            data: {
              userId,
              exerciseData: exercise.exercise_data,
              difficulty: exercise.difficulty,
              language: exercise.language,
              topic: exercise.topic,
              accuracy: exercise.accuracy,
              score: exercise.score,
              duration: exercise.duration,
              createdAt: new Date(exercise.created_at)
            }
          })
          
          stats.createdPracticeSessions++
          console.log(`   ✓ 迁移练习记录: ${exercise.topic} (${exercise.difficulty})`)
        } catch (error) {
          console.log(`   ❌ 迁移练习记录失败:`, error)
          stats.skippedRecords++
        }
      } else {
        console.log(`   ⚠ 跳过练习记录 (无对应用户): ${exercise.invitation_code}`)
        stats.skippedRecords++
      }
    }

    // 第四步：创建管理员账号
    console.log('\n🔑 创建管理员账号...')
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@listeningtrain.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456'
    const adminName = process.env.ADMIN_NAME || 'System Administrator'

    const existingAdmin = await targetDb.user.findUnique({
      where: { email: adminEmail }
    })

    if (!existingAdmin) {
      const admin = await createUser(adminEmail, adminPassword, adminName, true)
      if (admin) {
        console.log(`   ✓ 创建管理员: ${adminEmail}`)
      }
    } else {
      // 确保现有用户是管理员
      if (!existingAdmin.isAdmin) {
        await targetDb.user.update({
          where: { id: existingAdmin.id },
          data: { isAdmin: true }
        })
        console.log(`   ✓ 升级为管理员: ${adminEmail}`)
      } else {
        console.log(`   ⚠ 管理员已存在: ${adminEmail}`)
      }
    }

    // 第五步：数据验证
    console.log('\n🔍 数据验证...')
    const finalUserCount = await targetDb.user.count()
    const finalPracticeCount = await targetDb.practiceSession.count()
    
    console.log(`   目标数据库用户数: ${finalUserCount}`)
    console.log(`   目标数据库练习会话数: ${finalPracticeCount}`)

    // 显示迁移统计
    console.log('\n📊 迁移统计报告')
    console.log('=' .repeat(50))
    console.log(`源数据:`)
    console.log(`  ├─ 邀请码记录: ${stats.invitations}`)
    console.log(`  ├─ 练习记录: ${stats.exercises}`)
    console.log(`  └─ 日常使用记录: ${stats.dailyUsage}`)
    console.log(`迁移结果:`)
    console.log(`  ├─ 创建用户: ${stats.createdUsers}`)
    console.log(`  ├─ 创建练习会话: ${stats.createdPracticeSessions}`)
    console.log(`  └─ 跳过记录: ${stats.skippedRecords}`)
    
    console.log('\n✨ 数据迁移完成！')
    
    // 显示登录信息
    console.log('\n🔑 登录信息:')
    console.log(`   管理员邮箱: ${adminEmail}`)
    console.log(`   管理员密码: ${adminPassword}`)
    console.log(`   登录地址: http://localhost:3000`)
    
    // 显示用户账号信息
    if (stats.createdUsers > 0) {
      console.log('\n👥 创建的用户账号 (基于邀请码):')
      for (const [_inviteCode, userId] of userMap) {
        const user = await targetDb.user.findUnique({ where: { id: userId } })
        if (user) {
          console.log(`   📧 ${user.email} (密码: Temp123456)`)
        }
      }
    }

  } catch (error) {
    console.error('❌ 数据迁移失败:', error)
    process.exit(1)
  } finally {
    sourceDb.close()
    await targetDb.$disconnect()
  }
}

// 验证数据完整性的函数
async function verifyMigration() {
  console.log('🔍 验证迁移数据...')
  
  const sourceDb = new Database(sourceDbPath, { readonly: true })
  const targetDb = new PrismaClient()
  
  try {
    await targetDb.$connect()
    
    // 验证用户数
    const sourceInvitations = sourceDb.prepare('SELECT COUNT(*) as count FROM invitations WHERE used_by IS NOT NULL').get() as {count: number}
    const targetUsers = await targetDb.user.count({ where: { isAdmin: false } })
    
    // 验证练习记录数
    const sourceExercises = sourceDb.prepare('SELECT COUNT(*) as count FROM exercises').get() as {count: number}
    const targetPractices = await targetDb.practiceSession.count()
    
    console.log('验证结果:')
    console.log(`  用户数对比: 源 ${sourceInvitations.count} vs 目标 ${targetUsers}`)
    console.log(`  练习记录对比: 源 ${sourceExercises.count} vs 目标 ${targetPractices}`)
    
    const isValid = sourceInvitations.count === targetUsers && sourceExercises.count === targetPractices
    console.log(isValid ? '✅ 数据验证通过' : '❌ 数据验证失败')
    
    return isValid
  } finally {
    sourceDb.close()
    await targetDb.$disconnect()
  }
}

// 命令行参数处理
const args = process.argv.slice(2)
const isVerifyOnly = args.includes('--verify-only')
const isRollback = args.includes('--rollback')

if (isVerifyOnly) {
  verifyMigration().catch((error) => {
    console.error('❌ 验证失败:', error)
    process.exit(1)
  })
} else if (isRollback) {
  console.log('🔄 执行回滚操作（清空目标数据库）...')
  targetDb.$connect().then(async () => {
    await targetDb.practiceSession.deleteMany()
    await targetDb.user.deleteMany()
    console.log('✅ 数据库已清空')
    await targetDb.$disconnect()
  }).catch((error) => {
    console.error('❌ 回滚失败:', error)
    process.exit(1)
  })
} else {
  main().catch((error) => {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  })
}