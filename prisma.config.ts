import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// 加载 .env.local 文件
config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || 'file:/app/prisma/data/app.db'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
})
