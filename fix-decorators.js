/**
 * 修复数据库文件中的装饰器语法
 */

const fs = require('fs')
const path = require('path')

const dbFile = path.join(__dirname, 'lib/db-unified.ts')

// 读取文件内容
let content = fs.readFileSync(dbFile, 'utf8')

// 移除剩余的装饰器语法
const decoratorPattern = /@monitored\(['"]([^'"]+)['"]\)\s*static\s+(\w+)/g

content = content.replace(decoratorPattern, (match, queryName, methodName) => {
  return `static ${methodName} = withMonitoring('${queryName}', `
})

// 修复方法结束的问题 - 查找需要添加额外括号的地方
const lines = content.split('\n')
const fixedLines = []
let inMethod = false
let braceCount = 0
let needsExtraClosing = false

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  
  // 检查是否是withMonitoring方法
  if (line.includes('= withMonitoring(')) {
    inMethod = true
    braceCount = 0
    needsExtraClosing = true
  }
  
  if (inMethod) {
    // 计算大括号
    const openBraces = (line.match(/\{/g) || []).length
    const closeBraces = (line.match(/\}/g) || []).length
    braceCount += openBraces - closeBraces
    
    // 如果是方法结束（只有一个}且braceCount为0）
    if (braceCount === 0 && closeBraces > 0 && needsExtraClosing) {
      // 添加额外的括号
      const modifiedLine = line.replace(/^(\s*)\}$/, '$1})')
      fixedLines.push(modifiedLine)
      inMethod = false
      needsExtraClosing = false
    } else {
      fixedLines.push(line)
    }
  } else {
    fixedLines.push(line)
  }
}

content = fixedLines.join('\n')

// 修复this引用为类名引用
content = content.replace(/this\.(\w+)/g, 'DatabaseOperations.$1')

// 写回文件
fs.writeFileSync(dbFile, content, 'utf8')

console.log('✅ Fixed decorators in db-unified.ts')

// 修复其他文件的引用
const filesToFix = [
  'app/api/v1/exercises/save/route.ts',
  'app/api/v1/invitation/verify/route.ts',
  'app/api/v1/system/health/route.ts',
  'lib/monitoring.ts'
]

filesToFix.forEach(file => {
  const filePath = path.join(__dirname, file)
  if (fs.existsSync(filePath)) {
    let fileContent = fs.readFileSync(filePath, 'utf8')
    fileContent = fileContent.replace(/@\/lib\/db-simple/g, '@/lib/db-unified')
    fileContent = fileContent.replace(/compatibleDbOperations/g, 'DatabaseOperations')
    fs.writeFileSync(filePath, fileContent, 'utf8')
    console.log(`✅ Fixed imports in ${file}`)
  }
})

console.log('🎉 All fixes applied!')