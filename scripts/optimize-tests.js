#!/usr/bin/env node

/**
 * Test performance optimization script
 * Analyzes test performance and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');

class TestOptimizer {
  constructor() {
    this.metricsPath = path.join(process.cwd(), 'test-results', 'performance-metrics.json');
    this.coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
  }

  /**
   * Load performance metrics from previous test runs
   */
  loadMetrics() {
    try {
      if (fs.existsSync(this.metricsPath)) {
        const data = fs.readFileSync(this.metricsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load performance metrics:', error.message);
    }
    return null;
  }

  /**
   * Load coverage data
   */
  loadCoverage() {
    try {
      if (fs.existsSync(this.coveragePath)) {
        const data = fs.readFileSync(this.coveragePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load coverage data:', error.message);
    }
    return null;
  }

  /**
   * Analyze test performance and provide recommendations
   */
  analyzePerformance() {
    const metrics = this.loadMetrics();
    const coverage = this.loadCoverage();

    console.log('🔍 Test Performance Analysis');
    console.log('=' .repeat(50));

    if (!metrics) {
      console.log('❌ No performance metrics found. Run tests first to generate metrics.');
      return;
    }

    const { summary } = metrics;
    const recommendations = [];

    // Analyze execution time
    if (summary.averageExecutionTime > 1000) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message: `Average test execution time is ${summary.averageExecutionTime.toFixed(2)}ms. Consider optimizing slow tests.`,
        action: 'Review slowest tests and optimize or split them into smaller units.'
      });
    }

    if (summary.maxExecutionTime > 5000) {
      recommendations.push({
        type: 'performance',
        severity: 'critical',
        message: `Maximum test execution time is ${summary.maxExecutionTime.toFixed(2)}ms, exceeding 5s threshold.`,
        action: 'Identify and optimize the slowest test or increase timeout if necessary.'
      });
    }

    // Analyze memory usage
    const avgMemoryMB = (summary.totalMemoryUsed / summary.totalTests / 1024 / 1024);
    if (avgMemoryMB > 50) {
      recommendations.push({
        type: 'memory',
        severity: 'medium',
        message: `Average memory usage per test is ${avgMemoryMB.toFixed(2)}MB.`,
        action: 'Review memory-heavy tests and ensure proper cleanup.'
      });
    }

    // Analyze test count vs execution time
    const testsPerSecond = summary.totalTests / (summary.averageExecutionTime * summary.totalTests / 1000);
    if (testsPerSecond < 10) {
      recommendations.push({
        type: 'throughput',
        severity: 'medium',
        message: `Test throughput is ${testsPerSecond.toFixed(2)} tests/second.`,
        action: 'Consider increasing parallelization or optimizing test setup/teardown.'
      });
    }

    // Coverage analysis
    if (coverage) {
      const totalCoverage = this.calculateTotalCoverage(coverage);
      if (totalCoverage.lines < 70) {
        recommendations.push({
          type: 'coverage',
          severity: 'high',
          message: `Line coverage is ${totalCoverage.lines.toFixed(2)}%, below 70% threshold.`,
          action: 'Add more unit tests to increase coverage.'
        });
      }
    }

    // Display recommendations
    if (recommendations.length === 0) {
      console.log('✅ No performance issues detected. Tests are running optimally!');
    } else {
      console.log(`\n⚠️  Found ${recommendations.length} optimization opportunities:\n`);
      
      recommendations.forEach((rec, index) => {
        const icon = rec.severity === 'critical' ? '🚨' : rec.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${index + 1}. [${rec.type.toUpperCase()}] ${rec.message}`);
        console.log(`   💡 Action: ${rec.action}\n`);
      });
    }

    // Performance tips
    console.log('💡 General Performance Tips:');
    console.log('   • Use vi.mock() for heavy dependencies');
    console.log('   • Minimize DOM operations in unit tests');
    console.log('   • Use beforeAll/afterAll for expensive setup');
    console.log('   • Consider test.concurrent for independent tests');
    console.log('   • Profile memory usage with --logHeapUsage');
    
    console.log('=' .repeat(50));
  }

  /**
   * Calculate total coverage percentages
   */
  calculateTotalCoverage(coverage) {
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;

    Object.values(coverage).forEach(file => {
      if (file.s) { // statements
        totalLines += Object.keys(file.s).length;
        coveredLines += Object.values(file.s).filter(count => count > 0).length;
      }
      if (file.f) { // functions
        totalFunctions += Object.keys(file.f).length;
        coveredFunctions += Object.values(file.f).filter(count => count > 0).length;
      }
      if (file.b) { // branches
        Object.values(file.b).forEach(branch => {
          totalBranches += branch.length;
          coveredBranches += branch.filter(count => count > 0).length;
        });
      }
    });

    return {
      lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
      functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0
    };
  }

  /**
   * Generate optimization report
   */
  generateReport() {
    const metrics = this.loadMetrics();
    const coverage = this.loadCoverage();
    
    const report = {
      timestamp: new Date().toISOString(),
      performance: metrics?.summary || null,
      coverage: coverage ? this.calculateTotalCoverage(coverage) : null,
      recommendations: []
    };

    const reportPath = path.join(process.cwd(), 'test-results', 'optimization-report.json');
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Optimization report saved to: ${reportPath}`);
  }
}

// Main execution
const optimizer = new TestOptimizer();

const command = process.argv[2];
switch (command) {
  case 'analyze':
    optimizer.analyzePerformance();
    break;
  case 'report':
    optimizer.generateReport();
    break;
  default:
    console.log('Test Performance Optimizer\n');
    console.log('Usage: node scripts/optimize-tests.js <command>\n');
    console.log('Commands:');
    console.log('  analyze  - Analyze test performance and show recommendations');
    console.log('  report   - Generate optimization report JSON file');
    break;
}