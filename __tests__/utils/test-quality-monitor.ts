/**
 * 测试质量监控体系 - 基于设计文档的覆盖率监控、质量门禁、性能优化
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * 覆盖率阈值配置
 */
export interface CoverageThresholds {
  /** 行覆盖率阈值 */
  lines: number
  /** 分支覆盖率阈值 */
  branches: number
  /** 函数覆盖率阈值 */
  functions: number
  /** 语句覆盖率阈值 */
  statements: number
}

/**
 * 质量门禁配置
 */
export interface QualityGateConfig {
  /** 覆盖率阈值 */
  coverage: CoverageThresholds
  /** 最大测试执行时间（毫秒） */
  maxTestDuration: number
  /** 最大失败测试数量 */
  maxFailedTests: number
  /** 是否启用性能检查 */
  enablePerformanceCheck: boolean
}

/**
 * 测试执行结果
 */
export interface TestExecutionResult {
  /** 测试是否通过 */
  passed: boolean
  /** 总测试数量 */
  totalTests: number
  /** 通过的测试数量 */
  passedTests: number
  /** 失败的测试数量 */
  failedTests: number
  /** 跳过的测试数量 */
  skippedTests: number
  /** 执行时间（毫秒） */
  duration: number
  /** 覆盖率信息 */
  coverage?: CoverageReport
}

/**
 * 覆盖率报告
 */
export interface CoverageReport {
  /** 行覆盖率 */
  lines: { covered: number; total: number; percentage: number }
  /** 分支覆盖率 */
  branches: { covered: number; total: number; percentage: number }
  /** 函数覆盖率 */
  functions: { covered: number; total: number; percentage: number }
  /** 语句覆盖率 */
  statements: { covered: number; total: number; percentage: number }
}

/**
 * 质量监控报告
 */
export interface QualityReport {
  /** 报告生成时间 */
  timestamp: string
  /** 质量门禁是否通过 */
  qualityGatePassed: boolean
  /** 测试执行结果 */
  testResults: TestExecutionResult
  /** 质量问题列表 */
  issues: QualityIssue[]
  /** 改进建议 */
  recommendations: string[]
  /** 趋势分析 */
  trends?: QualityTrends
}

/**
 * 质量问题
 */
export interface QualityIssue {
  /** 问题类型 */
  type: 'coverage' | 'performance' | 'reliability' | 'maintainability'
  /** 严重程度 */
  severity: 'critical' | 'major' | 'minor' | 'info'
  /** 问题描述 */
  description: string
  /** 影响范围 */
  scope: string
  /** 修复建议 */
  suggestion: string
}

/**
 * 质量趋势
 */
export interface QualityTrends {
  /** 覆盖率趋势 */
  coverageTrend: 'improving' | 'stable' | 'declining'
  /** 性能趋势 */
  performanceTrend: 'improving' | 'stable' | 'declining'
  /** 可靠性趋势 */
  reliabilityTrend: 'improving' | 'stable' | 'declining'
}

/**
 * 测试质量监控器
 */
export class TestQualityMonitor {
  private config: QualityGateConfig
  private reportHistory: QualityReport[] = []

  constructor(config: Partial<QualityGateConfig> = {}) {
    this.config = {
      coverage: {
        lines: 85,
        branches: 80,
        functions: 90,
        statements: 85
      },
      maxTestDuration: 300000, // 5分钟
      maxFailedTests: 0,
      enablePerformanceCheck: true,
      ...config
    }
  }

  /**
   * 执行测试并生成质量报告
   */
  async runQualityCheck(): Promise<QualityReport> {
    console.log('🔍 Starting quality check...')
    
    const startTime = Date.now()
    
    try {
      // 执行测试
      const testResults = await this.runTests()
      
      // 生成覆盖率报告
      const coverage = await this.generateCoverageReport()
      testResults.coverage = coverage
      
      // 分析质量问题
      const issues = this.analyzeQualityIssues(testResults)
      
      // 生成改进建议
      const recommendations = this.generateRecommendations(issues, testResults)
      
      // 计算质量门禁结果
      const qualityGatePassed = this.evaluateQualityGate(testResults, issues)
      
      // 分析趋势
      const trends = this.analyzeTrends()
      
      const report: QualityReport = {
        timestamp: new Date().toISOString(),
        qualityGatePassed,
        testResults,
        issues,
        recommendations,
        trends
      }
      
      // 保存报告历史
      this.saveReport(report)
      
      // 输出结果
      this.printReport(report)
      
      return report
      
    } catch (error) {
      console.error('❌ Quality check failed:', error)
      throw error
    }
  }

  /**
   * 执行测试
   */
  private async runTests(): Promise<TestExecutionResult> {
    console.log('🧪 Running tests...')
    
    const startTime = Date.now()
    
    try {
      // 执行Vitest
      const output = execSync('npm run test -- --coverage --reporter=json', { 
        encoding: 'utf8',
        timeout: this.config.maxTestDuration
      })
      
      const duration = Date.now() - startTime
      
      // 解析测试结果
      const result = this.parseTestOutput(output, duration)
      
      console.log(`✅ Tests completed in ${duration}ms`)
      return result
      
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      // 即使测试失败也要解析结果
      const result = this.parseTestOutput(error.stdout || '', duration)
      result.passed = false
      
      console.log(`❌ Tests failed after ${duration}ms`)
      return result
    }
  }

  /**
   * 解析测试输出
   */
  private parseTestOutput(output: string, duration: number): TestExecutionResult {
    try {
      // 尝试解析JSON输出
      const lines = output.split('\n')
      const jsonLine = lines.find(line => line.startsWith('{') && line.includes('testResults'))
      
      if (jsonLine) {
        const data = JSON.parse(jsonLine)
        return {
          passed: data.success || false,
          totalTests: data.numTotalTests || 0,
          passedTests: data.numPassedTests || 0,
          failedTests: data.numFailedTests || 0,
          skippedTests: data.numPendingTests || 0,
          duration
        }
      }
    } catch (error) {
      console.warn('Failed to parse test output:', error)
    }
    
    // fallback解析
    return {
      passed: !output.includes('FAILED'),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration
    }
  }

  /**
   * 生成覆盖率报告
   */
  private async generateCoverageReport(): Promise<CoverageReport> {
    console.log('📊 Generating coverage report...')
    
    try {
      const coverageFile = join(process.cwd(), 'coverage/coverage-summary.json')
      
      if (!existsSync(coverageFile)) {
        console.warn('Coverage file not found, generating...')
        execSync('npm run test -- --coverage --reporter=verbose', { encoding: 'utf8' })
      }
      
      const coverageData = JSON.parse(readFileSync(coverageFile, 'utf8'))
      const total = coverageData.total
      
      return {
        lines: {
          covered: total.lines.covered,
          total: total.lines.total,
          percentage: total.lines.pct
        },
        branches: {
          covered: total.branches.covered,
          total: total.branches.total,
          percentage: total.branches.pct
        },
        functions: {
          covered: total.functions.covered,
          total: total.functions.total,
          percentage: total.functions.pct
        },
        statements: {
          covered: total.statements.covered,
          total: total.statements.total,
          percentage: total.statements.pct
        }
      }
    } catch (error) {
      console.warn('Failed to generate coverage report:', error)
      return {
        lines: { covered: 0, total: 0, percentage: 0 },
        branches: { covered: 0, total: 0, percentage: 0 },
        functions: { covered: 0, total: 0, percentage: 0 },
        statements: { covered: 0, total: 0, percentage: 0 }
      }
    }
  }

  /**
   * 分析质量问题
   */
  private analyzeQualityIssues(testResults: TestExecutionResult): QualityIssue[] {
    const issues: QualityIssue[] = []
    
    // 检查测试失败
    if (testResults.failedTests > this.config.maxFailedTests) {
      issues.push({
        type: 'reliability',
        severity: 'critical',
        description: `${testResults.failedTests} tests are failing`,
        scope: '全局',
        suggestion: '修复失败的测试以确保代码质量'
      })
    }
    
    // 检查覆盖率
    if (testResults.coverage) {
      const { coverage } = testResults
      
      if (coverage.lines.percentage < this.config.coverage.lines) {
        issues.push({
          type: 'coverage',
          severity: 'major',
          description: `Line coverage (${coverage.lines.percentage}%) below threshold (${this.config.coverage.lines}%)`,
          scope: '代码覆盖率',
          suggestion: '增加测试用例以提高行覆盖率'
        })
      }
      
      if (coverage.branches.percentage < this.config.coverage.branches) {
        issues.push({
          type: 'coverage',
          severity: 'major',
          description: `Branch coverage (${coverage.branches.percentage}%) below threshold (${this.config.coverage.branches}%)`,
          scope: '分支覆盖率',
          suggestion: '添加测试用例覆盖更多分支逻辑'
        })
      }
      
      if (coverage.functions.percentage < this.config.coverage.functions) {
        issues.push({
          type: 'coverage',
          severity: 'major',
          description: `Function coverage (${coverage.functions.percentage}%) below threshold (${this.config.coverage.functions}%)`,
          scope: '函数覆盖率',
          suggestion: '为未测试的函数添加测试用例'
        })
      }
    }
    
    // 检查性能
    if (this.config.enablePerformanceCheck && testResults.duration > this.config.maxTestDuration * 0.8) {
      issues.push({
        type: 'performance',
        severity: 'minor',
        description: `Test execution time (${testResults.duration}ms) approaching limit (${this.config.maxTestDuration}ms)`,
        scope: '测试性能',
        suggestion: '优化测试执行速度，考虑并行化或减少测试数据量'
      })
    }
    
    return issues
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(issues: QualityIssue[], testResults: TestExecutionResult): string[] {
    const recommendations: string[] = []
    
    // 基于问题类型生成建议
    const issueTypes = new Set(issues.map(issue => issue.type))
    
    if (issueTypes.has('coverage')) {
      recommendations.push('建议使用测试数据工厂生成更多测试场景')
      recommendations.push('考虑添加边界条件和异常情况的测试')
      recommendations.push('使用Mock工厂提高测试隔离性')
    }
    
    if (issueTypes.has('performance')) {
      recommendations.push('启用并行测试执行以提高速度')
      recommendations.push('优化测试数据生成，减少不必要的复杂性')
      recommendations.push('考虑使用测试场景模板减少重复代码')
    }
    
    if (issueTypes.has('reliability')) {
      recommendations.push('检查失败测试的根本原因')
      recommendations.push('确保Mock配置的一致性')
      recommendations.push('添加重试机制处理偶发性失败')
    }
    
    // 基于测试数量生成建议
    if (testResults.totalTests < 50) {
      recommendations.push('考虑增加更多测试用例以提高代码质量')
    }
    
    if (testResults.totalTests > 500) {
      recommendations.push('考虑重构测试结构，提高测试组织性')
    }
    
    return recommendations
  }

  /**
   * 评估质量门禁
   */
  private evaluateQualityGate(testResults: TestExecutionResult, issues: QualityIssue[]): boolean {
    // 检查测试通过率
    if (!testResults.passed || testResults.failedTests > this.config.maxFailedTests) {
      return false
    }
    
    // 检查关键问题
    const criticalIssues = issues.filter(issue => issue.severity === 'critical')
    if (criticalIssues.length > 0) {
      return false
    }
    
    // 检查覆盖率
    if (testResults.coverage) {
      const { coverage } = testResults
      if (
        coverage.lines.percentage < this.config.coverage.lines ||
        coverage.branches.percentage < this.config.coverage.branches ||
        coverage.functions.percentage < this.config.coverage.functions ||
        coverage.statements.percentage < this.config.coverage.statements
      ) {
        return false
      }
    }
    
    // 检查性能
    if (testResults.duration > this.config.maxTestDuration) {
      return false
    }
    
    return true
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(): QualityTrends | undefined {
    if (this.reportHistory.length < 2) {
      return undefined
    }
    
    const recent = this.reportHistory.slice(-3)
    const coverageValues = recent.map(r => r.testResults.coverage?.lines.percentage || 0)
    const performanceValues = recent.map(r => r.testResults.duration)
    const reliabilityValues = recent.map(r => r.testResults.passedTests / Math.max(r.testResults.totalTests, 1))
    
    return {
      coverageTrend: this.calculateTrend(coverageValues),
      performanceTrend: this.calculateTrend(performanceValues.map(v => -v)), // 性能值越小越好
      reliabilityTrend: this.calculateTrend(reliabilityValues)
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable'
    
    const changes = []
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1])
    }
    
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length
    
    if (avgChange > 1) return 'improving'
    if (avgChange < -1) return 'declining'
    return 'stable'
  }

  /**
   * 保存报告
   */
  private saveReport(report: QualityReport): void {
    this.reportHistory.push(report)
    
    // 只保留最近10次报告
    if (this.reportHistory.length > 10) {
      this.reportHistory = this.reportHistory.slice(-10)
    }
    
    // 保存到文件
    const reportFile = join(process.cwd(), 'test-results/quality-report.json')
    try {
      writeFileSync(reportFile, JSON.stringify(report, null, 2))
      console.log(`📋 Quality report saved to ${reportFile}`)
    } catch (error) {
      console.warn('Failed to save quality report:', error)
    }
  }

  /**
   * 打印报告
   */
  private printReport(report: QualityReport): void {
    console.log('\n' + '='.repeat(60))
    console.log('📋 QUALITY REPORT')
    console.log('='.repeat(60))
    
    // 质量门禁结果
    const gateStatus = report.qualityGatePassed ? '✅ PASSED' : '❌ FAILED'
    console.log(`Quality Gate: ${gateStatus}`)
    
    // 测试结果
    console.log(`\n🧪 Test Results:`)
    console.log(`  Total: ${report.testResults.totalTests}`)
    console.log(`  Passed: ${report.testResults.passedTests}`)
    console.log(`  Failed: ${report.testResults.failedTests}`)
    console.log(`  Duration: ${report.testResults.duration}ms`)
    
    // 覆盖率
    if (report.testResults.coverage) {
      const { coverage } = report.testResults
      console.log(`\n📊 Coverage:`)
      console.log(`  Lines: ${coverage.lines.percentage}%`)
      console.log(`  Branches: ${coverage.branches.percentage}%`)
      console.log(`  Functions: ${coverage.functions.percentage}%`)
      console.log(`  Statements: ${coverage.statements.percentage}%`)
    }
    
    // 质量问题
    if (report.issues.length > 0) {
      console.log(`\n⚠️  Issues (${report.issues.length}):`)
      report.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`)
        console.log(`     💡 ${issue.suggestion}`)
      })
    }
    
    // 建议
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`)
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`)
      })
    }
    
    // 趋势
    if (report.trends) {
      console.log(`\n📈 Trends:`)
      console.log(`  Coverage: ${this.getTrendEmoji(report.trends.coverageTrend)} ${report.trends.coverageTrend}`)
      console.log(`  Performance: ${this.getTrendEmoji(report.trends.performanceTrend)} ${report.trends.performanceTrend}`)
      console.log(`  Reliability: ${this.getTrendEmoji(report.trends.reliabilityTrend)} ${report.trends.reliabilityTrend}`)
    }
    
    console.log('='.repeat(60))
  }

  /**
   * 获取趋势表情符号
   */
  private getTrendEmoji(trend: string): string {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      default: return '➡️'
    }
  }

  /**
   * 获取配置
   */
  getConfig(): QualityGateConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<QualityGateConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取报告历史
   */
  getReportHistory(): QualityReport[] {
    return [...this.reportHistory]
  }
}

/**
 * 创建质量监控器实例
 */
export function createQualityMonitor(config?: Partial<QualityGateConfig>): TestQualityMonitor {
  return new TestQualityMonitor(config)
}

/**
 * 默认质量监控器配置
 */
export const defaultQualityConfig: QualityGateConfig = {
  coverage: {
    lines: 85,
    branches: 80,
    functions: 90,
    statements: 85
  },
  maxTestDuration: 300000,
  maxFailedTests: 0,
  enablePerformanceCheck: true
}