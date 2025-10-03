#!/usr/bin/env node

/**
 * Docker container seed script - creates admin user
 * Uses plain JavaScript to avoid TypeScript path resolution issues
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting database initialization...')

  try {
    // Connect to database
    await prisma.$connect()
    console.log('✅ Database connected')

    // Get admin credentials from environment
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@listeningtrain.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456'
    const adminName = process.env.ADMIN_NAME || 'System Administrator'

    console.log(`📧 Admin email: ${adminEmail}`)

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists, skipping creation')
      
      // Update to admin if not already
      if (!existingAdmin.isAdmin) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { isAdmin: true }
        })
        console.log('✅ Upgraded existing user to admin')
      }
    } else {
      // Create admin user
      console.log('👤 Creating admin user...')
      
      const hashedPassword = await bcrypt.hash(adminPassword, 10)
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          isAdmin: true
        }
      })
      
      console.log('✅ Admin user created successfully')
      console.log(`   Email: ${admin.email}`)
      console.log(`   Name: ${admin.name}`)
      console.log(`   ID: ${admin.id}`)
    }

    // Show database stats
    const userCount = await prisma.user.count()
    const sessionCount = await prisma.practiceSession.count()
    
    console.log('\n📊 Database statistics:')
    console.log(`   Total users: ${userCount}`)
    console.log(`   Total practice sessions: ${sessionCount}`)

    // Show login info
    console.log('\n🔑 Admin login credentials:')
    console.log(`   Email: ${adminEmail}`)
    console.log(`   Password: ${adminPassword}`)
    console.log(`   Admin URL: http://localhost:3005`)

    console.log('\n✨ Database initialization complete!')

  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled promise rejection:', err)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err)
  process.exit(1)
})

// Execute
main().catch((error) => {
  console.error('❌ Script execution failed:', error)
  process.exit(1)
})
