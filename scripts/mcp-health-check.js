#!/usr/bin/env node

/**
 * MCP服务器健康检查脚本
 * 用于监控MCP服务器状态和预防性维护
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class McpHealthChecker {
  constructor() {
    this.tempDirs = [
      '/tmp/.npm',
      '/private/tmp/.npm',
      path.join(os.tmpdir(), '.npm')
    ];
  }

  // 检查npm缓存状态
  checkNpmCache() {
    console.log('🔍 检查npm缓存状态...');
    
    return new Promise((resolve) => {
      const npm = spawn('npm', ['cache', 'verify'], {
        stdio: 'pipe'
      });
      
      let output = '';
      npm.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          console.log('✅ npm缓存状态正常');
        } else {
          console.log('⚠️ npm缓存可能存在问题');
        }
        resolve({ code, output });
      });
    });
  }

  // 检查临时目录大小
  checkTempDirSize() {
    console.log('📊 检查临时目录大小...');
    
    this.tempDirs.forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          const stats = this.getDirSize(dir);
          const sizeMB = (stats / 1024 / 1024).toFixed(2);
          console.log(`📁 ${dir}: ${sizeMB} MB`);
          
          if (stats > 100 * 1024 * 1024) { // 100MB
            console.log(`⚠️ 临时目录 ${dir} 过大，建议清理`);
          }
        }
      } catch (error) {
        console.log(`❌ 无法检查 ${dir}: ${error.message}`);
      }
    });
  }

  // 递归计算目录大小
  getDirSize(dirPath) {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirSize(filePath);
        } else {
          totalSize += stats.size;
        }
      });
    } catch (error) {
      // 忽略权限错误等
    }
    
    return totalSize;
  }

  // 测试npx功能
  testNpxFunction() {
    console.log('🧪 测试npx功能...');
    
    return new Promise((resolve) => {
      const npx = spawn('npx', ['--version'], {
        stdio: 'pipe'
      });
      
      npx.on('close', (code) => {
        if (code === 0) {
          console.log('✅ npx功能正常');
        } else {
          console.log('❌ npx功能异常');
        }
        resolve(code === 0);
      });
      
      npx.on('error', (error) => {
        console.log('❌ npx测试失败:', error.message);
        resolve(false);
      });
    });
  }

  // 预防性清理
  preventiveMaintenance() {
    console.log('🔧 执行预防性维护...');
    
    // 清理超过7天的临时文件
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    this.tempDirs.forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          this.cleanOldFiles(dir, sevenDaysAgo);
        }
      } catch (error) {
        console.log(`⚠️ 清理 ${dir} 时出错: ${error.message}`);
      }
    });
  }

  // 清理旧文件
  cleanOldFiles(dirPath, cutoffTime) {
    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log(`🗑️ 已清理: ${filePath}`);
        }
      });
    } catch (error) {
      // 忽略权限错误等
    }
  }

  // 运行完整健康检查
  async runHealthCheck() {
    console.log('🏥 开始MCP健康检查...');
    console.log('='.repeat(50));
    
    try {
      // 1. 检查npm缓存
      await this.checkNpmCache();
      
      // 2. 检查临时目录
      this.checkTempDirSize();
      
      // 3. 测试npx功能
      const npxWorking = await this.testNpxFunction();
      
      // 4. 预防性维护
      this.preventiveMaintenance();
      
      console.log('='.repeat(50));
      
      if (npxWorking) {
        console.log('✅ MCP健康检查完成 - 系统状态良好');
        return true;
      } else {
        console.log('⚠️ MCP健康检查完成 - 发现问题，建议运行修复脚本');
        return false;
      }
      
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
      return false;
    }
  }
}

// 主函数
async function main() {
  const checker = new McpHealthChecker();
  const isHealthy = await checker.runHealthCheck();
  
  process.exit(isHealthy ? 0 : 1);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = McpHealthChecker;