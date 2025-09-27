#!/usr/bin/env tsx

/**
 * 测试质量检查脚本
 * 
 * 使用方式：
 * npm run quality-check
 * 或者
 * npx tsx scripts/run-quality-check.ts
 */

import { createQualityMonitor } from '../__tests__/utils/test-quality-monitor'

async function main() {
  console.log('🚀 Starting Test Quality Check...')
  
  // 创建质量监控器
  const monitor = createQualityMonitor({
    coverage: {
      lines: 85,
      branches: 80,
      functions: 90,
      statements: 85
    },
    maxTestDuration: 300000, // 5分钟
    maxFailedTests: 0,
    enablePerformanceCheck: true
  })
  
  try {
    // 执行质量检查
    const report = await monitor.runQualityCheck()
    
    // 根据结果设置退出码
    if (report.qualityGatePassed) {
      console.log('\n✅ Quality gate passed!')
      process.exit(0)
    } else {
      console.log('\n❌ Quality gate failed!')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('\n💥 Quality check failed with error:', error)
    process.exit(1)
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// 运行主函数
main().catch(error => {
  console.error('Main function failed:', error)
  process.exit(1)
})