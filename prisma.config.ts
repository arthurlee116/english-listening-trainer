import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const prismaCliDatabaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: prismaCliDatabaseUrl,
  },
})
