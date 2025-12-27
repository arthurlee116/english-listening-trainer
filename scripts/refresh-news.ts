#!/usr/bin/env npx tsx
/**
 * 手动刷新新闻脚本
 * 用法: npm run refresh-news
 */

// Load environment variables from .env.local
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
    })
  } catch {
    console.warn('Warning: .env.local not found, using system environment variables')
  }
}
loadEnv()

import { refreshNews } from '../lib/news/scheduler'

async function main() {
  console.log('🗞️  Starting news refresh...\n')
  
  try {
    const result = await refreshNews()
    
    console.log('\n✅ Refresh completed!')
    console.log(`   📰 Articles processed: ${result.articlesProcessed}`)
    console.log(`   🎯 Topics created: ${result.topicsCreated}`)
    console.log(`   📝 Transcripts generated: ${result.transcriptsGenerated}`)
    console.log(`   ⏱️  Duration: ${result.duration}ms`)
  } catch (error) {
    console.error('\n❌ Refresh failed:', error)
    process.exit(1)
  }
}

main()
