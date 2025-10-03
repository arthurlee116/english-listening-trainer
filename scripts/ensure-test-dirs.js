#!/usr/bin/env node

/**
 * 确保测试相关目录存在并有正确权限
 * 在CI环境中运行测试前调用
 */

const fs = require('fs')
const path = require('path')

const testDirs = [
  'test-results',
  'coverage',
  'tests/e2e',
  'tests/integration'
]

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`✓ Created directory: ${dirPath}`)
    } else {
      console.log(`✓ Directory exists: ${dirPath}`)
    }
    
    // 检查写权限
    fs.accessSync(dirPath, fs.constants.W_OK)
    console.log(`✓ Write permission confirmed: ${dirPath}`)
  } catch (error) {
    console.error(`✗ Failed to ensure directory ${dirPath}:`, error.message)
    process.exit(1)
  }
}

console.log('Ensuring test directories exist with proper permissions...')

testDirs.forEach(ensureDir)

console.log('✓ All test directories are ready')