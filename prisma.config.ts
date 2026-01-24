import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// 加载 .env.local 文件
config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
