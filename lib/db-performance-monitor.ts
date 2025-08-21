/**
 * 数据库性能监控工具
 * 提供查询性能分析、索引使用率监控、慢查询检测等功能
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = path.join(process.cwd(), 'data', 'app.db')

interface QueryPlan {
  id: number
  parent: number
  notused: number
  detail: string
}

interface IndexUsage {
  indexName: string
  tableName: string
  usageCount: number
  lastUsed?: Date
  efficiency: number
}

interface SlowQuery {
  query: string
  executionTime: number
  timestamp: Date
  planAnalysis?: QueryPlan[]
}

interface PerformanceReport {
  dbSize: number
  tableStats: Array<{
    name: string
    rowCount: number
    size: number
    avgRowSize: number
  }>
  indexStats: IndexUsage[]
  slowQueries: SlowQuery[]
  recommendations: string[]
  healthScore: number
}

export class DatabasePerformanceMonitor {
  private db: Database.Database
  private slowQueries: SlowQuery[] = []
  private queryHistory: Map<string, number[]> = new Map()

  constructor() {
    this.db = new Database(dbPath, { readonly: true })
  }

  // 分析查询执行计划
  analyzeQueryPlan(query: string): QueryPlan[] {
    try {
      const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as QueryPlan[]
      return plan
    } catch (error) {
      console.error('Failed to analyze query plan:', error)
      return []
    }
  }

  // 执行查询并监控性能
  executeWithMonitoring<T>(query: string, params: any[] = []): {
    result: T[]
    executionTime: number
    plan: QueryPlan[]
  } {
    const startTime = performance.now()
    
    // 分析执行计划
    const plan = this.analyzeQueryPlan(query)
    
    // 执行查询
    const stmt = this.db.prepare(query)
    const result = params.length > 0 ? stmt.all(...params) : stmt.all()
    
    const executionTime = performance.now() - startTime
    
    // 记录慢查询
    if (executionTime > 100) { // 100ms threshold
      this.recordSlowQuery(query, executionTime, plan)
    }
    
    // 更新查询历史
    this.updateQueryHistory(query, executionTime)
    
    return { result: result as T[], executionTime, plan }
  }

  // 记录慢查询
  private recordSlowQuery(query: string, executionTime: number, plan: QueryPlan[]): void {
    this.slowQueries.push({
      query: query.replace(/\s+/g, ' ').trim(),
      executionTime,
      timestamp: new Date(),
      planAnalysis: plan
    })
    
    // 保持最新的100条慢查询记录
    if (this.slowQueries.length > 100) {
      this.slowQueries = this.slowQueries.slice(-100)
    }
  }

  // 更新查询历史
  private updateQueryHistory(query: string, executionTime: number): void {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim()
    const history = this.queryHistory.get(normalizedQuery) || []
    history.push(executionTime)
    
    // 保持最近20次执行记录
    if (history.length > 20) {
      history.splice(0, history.length - 20)
    }
    
    this.queryHistory.set(normalizedQuery, history)
  }

  // 获取表统计信息
  getTableStatistics(): Array<{
    name: string
    rowCount: number
    size: number
    avgRowSize: number
  }> {
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as {name: string}[]

    return tables.map(table => {
      try {
        const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as {count: number}
        const sizeInfo = this.db.prepare(`
          SELECT 
            page_count * page_size as size 
          FROM pragma_page_count('${table.name}'), pragma_page_size()
        `).get() as {size: number} | undefined

        const size = sizeInfo?.size || 0
        const avgRowSize = rowCount.count > 0 ? size / rowCount.count : 0

        return {
          name: table.name,
          rowCount: rowCount.count,
          size,
          avgRowSize: Math.round(avgRowSize)
        }
      } catch (error) {
        console.error(`Failed to get stats for table ${table.name}:`, error)
        return {
          name: table.name,
          rowCount: 0,
          size: 0,
          avgRowSize: 0
        }
      }
    })
  }

  // 分析索引使用情况
  analyzeIndexUsage(): IndexUsage[] {
    const indexes = this.db.prepare(`
      SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `).all() as {name: string, tbl_name: string}[]

    return indexes.map(index => {
      try {
        // 获取索引信息
        const indexInfo = this.db.prepare(`PRAGMA index_info('${index.name}')`).all()
        
        // 模拟使用率分析（实际应用中需要查询统计信息）
        const efficiency = this.estimateIndexEfficiency(index.name, index.tbl_name)
        
        return {
          indexName: index.name,
          tableName: index.tbl_name,
          usageCount: 0, // SQLite没有内置的索引使用统计
          efficiency
        }
      } catch (error) {
        console.error(`Failed to analyze index ${index.name}:`, error)
        return {
          indexName: index.name,
          tableName: index.tbl_name,
          usageCount: 0,
          efficiency: 0
        }
      }
    })
  }

  // 估算索引效率
  private estimateIndexEfficiency(indexName: string, tableName: string): number {
    try {
      // 获取表的行数
      const tableRows = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as {count: number}
      
      // 获取索引的选择性（不同值的数量）
      const indexInfo = this.db.prepare(`PRAGMA index_info('${indexName}')`).all() as Array<{
        seqno: number
        cid: number
        name: string
      }>
      
      if (indexInfo.length === 0) return 0
      
      const firstColumn = indexInfo[0].name
      const distinctValues = this.db.prepare(`
        SELECT COUNT(DISTINCT ${firstColumn}) as distinct_count FROM ${tableName}
      `).get() as {distinct_count: number}
      
      // 计算选择性：不同值越多，索引效率越高
      const selectivity = tableRows.count > 0 ? distinctValues.distinct_count / tableRows.count : 0
      
      // 效率评分（0-100）
      return Math.min(100, Math.round(selectivity * 100))
    } catch (error) {
      console.error(`Failed to estimate efficiency for index ${indexName}:`, error)
      return 0
    }
  }

  // 检测未使用的索引
  detectUnusedIndexes(): string[] {
    const indexStats = this.analyzeIndexUsage()
    
    return indexStats
      .filter(index => index.efficiency < 10 && !index.indexName.includes('PRIMARY'))
      .map(index => index.indexName)
  }

  // 建议创建的索引
  suggestMissingIndexes(): Array<{
    tableName: string
    columns: string[]
    reason: string
    priority: 'high' | 'medium' | 'low'
  }> {
    const suggestions: Array<{
      tableName: string
      columns: string[]
      reason: string
      priority: 'high' | 'medium' | 'low'
    }> = []

    // 分析慢查询，寻找缺失的索引
    for (const slowQuery of this.slowQueries) {
      const analysis = this.analyzeSlowQueryForIndexSuggestions(slowQuery)
      suggestions.push(...analysis)
    }

    // 基于表结构的常见索引建议
    const structuralSuggestions = this.getStructuralIndexSuggestions()
    suggestions.push(...structuralSuggestions)

    // 去重并按优先级排序
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => 
        s.tableName === suggestion.tableName && 
        s.columns.join(',') === suggestion.columns.join(',')
      )
    )

    return uniqueSuggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  // 分析慢查询的索引建议
  private analyzeSlowQueryForIndexSuggestions(slowQuery: SlowQuery): Array<{
    tableName: string
    columns: string[]
    reason: string
    priority: 'high' | 'medium' | 'low'
  }> {
    const suggestions: Array<{
      tableName: string
      columns: string[]
      reason: string
      priority: 'high' | 'medium' | 'low'
    }> = []

    // 分析执行计划中的表扫描
    for (const plan of slowQuery.planAnalysis || []) {
      if (plan.detail.includes('SCAN TABLE')) {
        const tableMatch = plan.detail.match(/SCAN TABLE (\w+)/)
        if (tableMatch) {
          const tableName = tableMatch[1]
          
          // 查找WHERE条件中的列
          const whereColumns = this.extractWhereColumns(slowQuery.query, tableName)
          if (whereColumns.length > 0) {
            suggestions.push({
              tableName,
              columns: whereColumns,
              reason: `Table scan detected in slow query (${slowQuery.executionTime.toFixed(2)}ms)`,
              priority: slowQuery.executionTime > 500 ? 'high' : 'medium'
            })
          }
        }
      }
    }

    return suggestions
  }

  // 提取WHERE条件中的列名
  private extractWhereColumns(query: string, tableName: string): string[] {
    const columns: string[] = []
    
    // 简单的正则匹配WHERE子句中的列名
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/i)
    if (whereMatch) {
      const whereClause = whereMatch[1]
      
      // 查找形如 "column = ?" 或 "table.column = ?" 的模式
      const columnMatches = whereClause.match(/(\w+\.)?(\w+)\s*[=<>!]/g)
      if (columnMatches) {
        for (const match of columnMatches) {
          const column = match.replace(/\s*[=<>!].*/, '').replace(/^\w+\./, '')
          if (column && !columns.includes(column)) {
            columns.push(column)
          }
        }
      }
    }
    
    return columns
  }

  // 基于表结构的索引建议
  private getStructuralIndexSuggestions(): Array<{
    tableName: string
    columns: string[]
    reason: string
    priority: 'high' | 'medium' | 'low'
  }> {
    const suggestions: Array<{
      tableName: string
      columns: string[]
      reason: string
      priority: 'high' | 'medium' | 'low'
    }> = []

    // 检查外键列是否有索引
    const foreignKeys = this.db.prepare(`
      SELECT 
        m.name as table_name,
        p.from as column_name
      FROM sqlite_master m
      JOIN pragma_foreign_key_list(m.name) p
      WHERE m.type = 'table'
    `).all() as {table_name: string, column_name: string}[]

    for (const fk of foreignKeys) {
      const hasIndex = this.checkColumnHasIndex(fk.table_name, fk.column_name)
      if (!hasIndex) {
        suggestions.push({
          tableName: fk.table_name,
          columns: [fk.column_name],
          reason: 'Foreign key column should have index',
          priority: 'high'
        })
      }
    }

    // 检查常见的查询模式
    const commonPatterns = [
      { table: 'exercises', columns: ['invitation_code', 'created_at'], reason: 'Common user history query pattern' },
      { table: 'wrong_answers', columns: ['invitation_code', 'created_at'], reason: 'Common error analysis query pattern' },
      { table: 'daily_usage', columns: ['invitation_code', 'date'], reason: 'Daily usage lookup pattern' }
    ]

    for (const pattern of commonPatterns) {
      const hasCompositeIndex = this.checkCompositeIndexExists(pattern.table, pattern.columns)
      if (!hasCompositeIndex) {
        suggestions.push({
          tableName: pattern.table,
          columns: pattern.columns,
          reason: pattern.reason,
          priority: 'medium'
        })
      }
    }

    return suggestions
  }

  // 检查列是否有索引
  private checkColumnHasIndex(tableName: string, columnName: string): boolean {
    try {
      const indexes = this.db.prepare(`PRAGMA index_list('${tableName}')`).all() as Array<{
        seq: number
        name: string
        unique: number
        origin: string
        partial: number
      }>

      for (const index of indexes) {
        const indexInfo = this.db.prepare(`PRAGMA index_info('${index.name}')`).all() as Array<{
          seqno: number
          cid: number
          name: string
        }>
        
        if (indexInfo.some(info => info.name === columnName)) {
          return true
        }
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  // 检查复合索引是否存在
  private checkCompositeIndexExists(tableName: string, columns: string[]): boolean {
    try {
      const indexes = this.db.prepare(`PRAGMA index_list('${tableName}')`).all() as Array<{
        name: string
      }>

      for (const index of indexes) {
        const indexInfo = this.db.prepare(`PRAGMA index_info('${index.name}')`).all() as Array<{
          name: string
        }>
        
        const indexColumns = indexInfo.map(info => info.name)
        if (columns.every(col => indexColumns.includes(col))) {
          return true
        }
      }
      
      return false
    } catch (error) {
      return false
    }
  }

  // 生成性能报告
  generatePerformanceReport(): PerformanceReport {
    console.log('📊 Generating database performance report...')

    const dbSizeResult = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `).get() as {size: number}

    const tableStats = this.getTableStatistics()
    const indexStats = this.analyzeIndexUsage()
    const slowQueries = this.getSlowQueries()
    const recommendations = this.generateRecommendations()
    const healthScore = this.calculateHealthScore()

    return {
      dbSize: dbSizeResult.size,
      tableStats,
      indexStats,
      slowQueries,
      recommendations,
      healthScore
    }
  }

  // 获取慢查询
  private getSlowQueries(): SlowQuery[] {
    return [...this.slowQueries].sort((a, b) => b.executionTime - a.executionTime).slice(0, 10)
  }

  // 生成优化建议
  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    // 索引建议
    const unusedIndexes = this.detectUnusedIndexes()
    if (unusedIndexes.length > 0) {
      recommendations.push(`Consider dropping unused indexes: ${unusedIndexes.join(', ')}`)
    }

    const missingIndexes = this.suggestMissingIndexes()
    for (const suggestion of missingIndexes.slice(0, 3)) {
      recommendations.push(
        `Create index on ${suggestion.tableName}(${suggestion.columns.join(', ')}): ${suggestion.reason}`
      )
    }

    // 表大小建议
    const tableStats = this.getTableStatistics()
    const largeTable = tableStats.find(t => t.rowCount > 10000)
    if (largeTable) {
      recommendations.push(`Consider partitioning large table: ${largeTable.name} (${largeTable.rowCount} rows)`)
    }

    // 慢查询建议
    if (this.slowQueries.length > 0) {
      const avgSlowTime = this.slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / this.slowQueries.length
      recommendations.push(`Optimize slow queries (avg: ${avgSlowTime.toFixed(2)}ms)`)
    }

    // 数据库维护建议
    const dbSizeResult = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `).get() as {size: number}

    if (dbSizeResult.size > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Consider running VACUUM to reclaim space')
    }

    recommendations.push('Run ANALYZE regularly to update query planner statistics')

    return recommendations
  }

  // 计算健康评分
  private calculateHealthScore(): number {
    let score = 100

    // 慢查询惩罚
    const slowQueryCount = this.slowQueries.length
    score -= Math.min(30, slowQueryCount * 2)

    // 未使用索引惩罚
    const unusedIndexes = this.detectUnusedIndexes()
    score -= Math.min(20, unusedIndexes.length * 5)

    // 缺失索引惩罚
    const missingIndexes = this.suggestMissingIndexes()
    const highPriorityMissing = missingIndexes.filter(m => m.priority === 'high').length
    score -= Math.min(25, highPriorityMissing * 10)

    // 表大小惩罚
    const tableStats = this.getTableStatistics()
    const hasLargeTables = tableStats.some(t => t.rowCount > 50000)
    if (hasLargeTables) score -= 10

    return Math.max(0, score)
  }

  // 导出性能数据到文件
  exportPerformanceData(filePath: string): void {
    const report = this.generatePerformanceReport()
    const data = {
      timestamp: new Date().toISOString(),
      report,
      queryHistory: Object.fromEntries(this.queryHistory)
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    console.log(`📁 Performance data exported to: ${filePath}`)
  }

  // 清理资源
  close(): void {
    if (this.db && this.db.open) {
      this.db.close()
    }
  }
}

// 导出便捷函数
export function createPerformanceMonitor(): DatabasePerformanceMonitor {
  return new DatabasePerformanceMonitor()
}

export function runPerformanceAnalysis(): PerformanceReport {
  const monitor = new DatabasePerformanceMonitor()
  const report = monitor.generatePerformanceReport()
  monitor.close()
  return report
}

// 如果直接运行此脚本
if (require.main === module) {
  const monitor = createPerformanceMonitor()
  
  try {
    console.log('🚀 Starting database performance analysis...')
    const report = monitor.generatePerformanceReport()
    
    console.log('\n📊 Performance Report:')
    console.log(`Database Size: ${(report.dbSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Health Score: ${report.healthScore}/100`)
    console.log(`Slow Queries: ${report.slowQueries.length}`)
    console.log(`Index Count: ${report.indexStats.length}`)
    
    console.log('\n📋 Recommendations:')
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`)
    })
    
    // 导出详细报告
    const exportPath = path.join(process.cwd(), 'data', `performance_report_${Date.now()}.json`)
    monitor.exportPerformanceData(exportPath)
    
  } finally {
    monitor.close()
  }
}