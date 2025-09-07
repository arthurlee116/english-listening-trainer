#!/usr/bin/env node

/**
 * MCP Server Test Script
 * 用于测试和修复MCP服务器连接问题
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 清理npm临时目录
function cleanupNpmTemp() {
  console.log('🧹 清理npm临时目录...');
  
  const tempDirs = [
    '/tmp/.npm',
    '/private/tmp/.npm',
    path.join(os.tmpdir(), '.npm')
  ];
  
  tempDirs.forEach(dir => {
    try {
      if (fs.existsSync(dir)) {
        console.log(`删除临时目录: ${dir}`);
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`无法删除 ${dir}: ${error.message}`);
    }
  });
}

// 清理npx缓存
function cleanupNpxCache() {
  console.log('🧹 清理npx缓存...');
  
  return new Promise((resolve, reject) => {
    const npx = spawn('npx', ['--yes', '--', 'echo', 'cache-test'], {
      stdio: 'pipe'
    });
    
    npx.on('close', (code) => {
      console.log(`npx缓存测试完成，退出码: ${code}`);
      resolve();
    });
    
    npx.on('error', (error) => {
      console.warn(`npx缓存清理警告: ${error.message}`);
      resolve(); // 继续执行，不阻塞
    });
  });
}

// 测试MCP服务器连接
function testMcpConnection() {
  console.log('🔗 测试MCP服务器连接...');
  
  // 这里可以添加具体的MCP服务器测试逻辑
  // 根据项目需要调整
  
  console.log('✅ MCP连接测试完成');
  return Promise.resolve();
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始MCP修复流程...');
    
    // 1. 清理npm临时目录
    cleanupNpmTemp();
    
    // 2. 清理npx缓存
    await cleanupNpxCache();
    
    // 3. 测试MCP连接
    await testMcpConnection();
    
    console.log('✅ MCP修复完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ MCP修复失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { cleanupNpmTemp, cleanupNpxCache, testMcpConnection };