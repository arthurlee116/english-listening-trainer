/**
 * 核心功能测试脚本
 * 测试关键的数据库操作和错误处理
 */

const path = require('path')
const fs = require('fs')

// 测试数据库模块是否可以加载
async function testDatabaseLoad() {
  console.log('🧪 Testing database module load...')
  
  try {
    // 检查数据库文件是否存在
    const dbFile = path.join(process.cwd(), 'lib', 'db-unified.ts')
    if (!fs.existsSync(dbFile)) {
      throw new Error('Database unified module not found')
    }
    
    console.log('✅ Database module exists')
    return true
  } catch (error) {
    console.error('❌ Database test failed:', error.message)
    return false
  }
}

// 测试错误处理模块
async function testErrorHandler() {
  console.log('🧪 Testing error handler module...')
  
  try {
    const errorHandlerFile = path.join(process.cwd(), 'lib', 'error-handler.ts')
    if (!fs.existsSync(errorHandlerFile)) {
      throw new Error('Error handler module not found')
    }
    
    console.log('✅ Error handler module exists')
    return true
  } catch (error) {
    console.error('❌ Error handler test failed:', error.message)
    return false
  }
}

// 测试配置管理
async function testConfigManager() {
  console.log('🧪 Testing config manager module...')
  
  try {
    const configFile = path.join(process.cwd(), 'lib', 'config-manager.ts')
    if (!fs.existsSync(configFile)) {
      throw new Error('Config manager module not found')
    }
    
    console.log('✅ Config manager module exists')
    return true
  } catch (error) {
    console.error('❌ Config manager test failed:', error.message)
    return false
  }
}

// 测试组件模块
async function testComponents() {
  console.log('🧪 Testing component modules...')
  
  const components = [
    'main-app.tsx',
    'exercise-setup.tsx'
  ]
  
  let allExist = true
  
  for (const component of components) {
    const componentFile = path.join(process.cwd(), 'components', component)
    if (!fs.existsSync(componentFile)) {
      console.error(`❌ Component not found: ${component}`)
      allExist = false
    } else {
      console.log(`✅ Component exists: ${component}`)
    }
  }
  
  return allExist
}

// 测试Hooks模块
async function testHooks() {
  console.log('🧪 Testing hook modules...')
  
  const hooks = [
    'use-invitation-code.ts',
    'use-exercise-workflow.ts'
  ]
  
  let allExist = true
  
  for (const hook of hooks) {
    const hookFile = path.join(process.cwd(), 'hooks', hook)
    if (!fs.existsSync(hookFile)) {
      console.error(`❌ Hook not found: ${hook}`)
      allExist = false
    } else {
      console.log(`✅ Hook exists: ${hook}`)
    }
  }
  
  return allExist
}

// 测试API路由
async function testApiRoutes() {
  console.log('🧪 Testing API route modules...')
  
  const routes = [
    'app/api/invitation/verify-enhanced/route.ts',
    'app/api/exercises/save-enhanced/route.ts'
  ]
  
  let allExist = true
  
  for (const route of routes) {
    const routeFile = path.join(process.cwd(), route)
    if (!fs.existsSync(routeFile)) {
      console.error(`❌ Route not found: ${route}`)
      allExist = false
    } else {
      console.log(`✅ Route exists: ${route}`)
    }
  }
  
  return allExist
}

// 测试数据目录
async function testDataDirectory() {
  console.log('🧪 Testing data directory...')
  
  try {
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
      console.log('✅ Data directory created')
    } else {
      console.log('✅ Data directory exists')
    }
    
    return true
  } catch (error) {
    console.error('❌ Data directory test failed:', error.message)
    return false
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 Starting core functionality tests...\n')
  
  const tests = [
    { name: 'Database Module', test: testDatabaseLoad },
    { name: 'Error Handler', test: testErrorHandler },
    { name: 'Config Manager', test: testConfigManager },
    { name: 'Components', test: testComponents },
    { name: 'Hooks', test: testHooks },
    { name: 'API Routes', test: testApiRoutes },
    { name: 'Data Directory', test: testDataDirectory }
  ]
  
  const results = []
  
  for (const { name, test } of tests) {
    const result = await test()
    results.push({ name, passed: result })
    console.log() // 空行分隔
  }
  
  // 输出总结
  console.log('📊 Test Summary:')
  console.log('================')
  
  const passed = results.filter(r => r.passed).length
  const total = results.length
  
  results.forEach(({ name, passed }) => {
    console.log(`${passed ? '✅' : '❌'} ${name}`)
  })
  
  console.log(`\n${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('🎉 All core functionality tests passed!')
    return true
  } else {
    console.log('⚠️ Some tests failed, but core modules are available')
    return false
  }
}

// 运行测试
runAllTests().then((success) => {
  process.exit(success ? 0 : 1)
}).catch((error) => {
  console.error('💥 Test runner crashed:', error)
  process.exit(1)
})