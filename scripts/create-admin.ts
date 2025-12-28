import { createUser, findUserByEmail, validateEmail, validatePasswordStrength } from '../lib/auth'
import { withDatabase } from '../lib/database'

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@listeningtrain.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456'
  const adminName = process.env.ADMIN_NAME || 'Administrator'

  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Example: DATABASE_URL="file:./data/app.db"')
  }

  if (!validateEmail(adminEmail)) {
    throw new Error(`Invalid ADMIN_EMAIL: ${adminEmail}`)
  }

  const passwordValidation = validatePasswordStrength(adminPassword)
  if (!passwordValidation.isValid) {
    throw new Error(`Invalid ADMIN_PASSWORD: ${passwordValidation.errors.join(', ')}`)
  }

  const existing = await findUserByEmail(adminEmail)
  if (existing) {
    if (existing.isAdmin) {
      console.log('✅ 管理员账号已存在：', adminEmail)
      return
    }
    throw new Error(`User exists but is not admin: ${adminEmail}`)
  }

  console.log('正在创建管理员账号...')
  const user = await createUser(adminEmail, adminPassword, adminName, true)
  if (!user) {
    throw new Error('Failed to create admin user')
  }

  console.log('✅ 管理员账号创建成功！')
  console.log('=================================')
  console.log('邮箱:', adminEmail)
  console.log('密码:', adminPassword)
  console.log('=================================')
  console.log('请使用以上凭据登录管理后台: http://localhost:3000/admin')
}

main()
  .catch((error) => {
    console.error('❌ 创建管理员失败:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await withDatabase((client) => client.$disconnect(), 'cleanup').catch(() => {})
  })

