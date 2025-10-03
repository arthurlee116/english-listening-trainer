/**
 * Performance monitoring utilities for test execution
 * Tracks execution time, memory usage, and provides fail-fast strategies
 */

interface TestPerformanceMetrics {
  testName: string;
  executionTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  timestamp: number;
}

interface PerformanceThresholds {
  maxExecutionTime: number; // milliseconds
  maxMemoryUsage: number;   // bytes
  failFastOnCritical: boolean;
}

class TestPerformanceMonitor {
  private metrics: TestPerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private startTimes: Map<string, number> = new Map();
  private criticalTests: Set<string> = new Set();

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      maxExecutionTime: 5000, // 5 seconds per requirement 8.1
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      failFastOnCritical: true,
      ...thresholds
    };

    // Define critical tests that should fail fast
    this.criticalTests.add('storage');
    this.criticalTests.add('achievement');
    this.criticalTests.add('focus-metrics');
    this.criticalTests.add('auth');
  }

  /**
   * Start monitoring a test
   */
  startTest(testName: string): void {
    this.startTimes.set(testName, performance.now());
    
    // Force garbage collection if available (for more accurate memory measurements)
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * End monitoring a test and record metrics
   */
  endTest(testName: string): TestPerformanceMetrics {
    const startTime = this.startTimes.get(testName);
    if (!startTime) {
      throw new Error(`Test ${testName} was not started with startTest()`);
    }

    const executionTime = performance.now() - startTime;
    const memoryUsage = process.memoryUsage();

    const metrics: TestPerformanceMetrics = {
      testName,
      executionTime,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      timestamp: Date.now()
    };

    this.metrics.push(metrics);
    this.startTimes.delete(testName);

    // Check thresholds and fail fast if needed
    this.checkThresholds(metrics);

    return metrics;
  }

  /**
   * Check if metrics exceed thresholds and fail fast for critical tests
   */
  private checkThresholds(metrics: TestPerformanceMetrics): void {
    const isCritical = Array.from(this.criticalTests).some(critical => 
      metrics.testName.toLowerCase().includes(critical)
    );

    // Check execution time threshold
    if (metrics.executionTime > this.thresholds.maxExecutionTime) {
      const message = `Test "${metrics.testName}" exceeded execution time threshold: ${metrics.executionTime}ms > ${this.thresholds.maxExecutionTime}ms`;
      
      if (isCritical && this.thresholds.failFastOnCritical) {
        throw new Error(`CRITICAL TEST FAILURE: ${message}`);
      } else {
        console.warn(`⚠️  PERFORMANCE WARNING: ${message}`);
      }
    }

    // Check memory usage threshold
    if (metrics.memoryUsage.heapUsed > this.thresholds.maxMemoryUsage) {
      const message = `Test "${metrics.testName}" exceeded memory usage threshold: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB > ${(this.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`;
      
      if (isCritical && this.thresholds.failFastOnCritical) {
        throw new Error(`CRITICAL TEST FAILURE: ${message}`);
      } else {
        console.warn(`⚠️  MEMORY WARNING: ${message}`);
      }
    }
  }

  /**
   * Get performance summary for all tests
   */
  getSummary(): {
    totalTests: number;
    averageExecutionTime: number;
    maxExecutionTime: number;
    totalMemoryUsed: number;
    slowestTests: TestPerformanceMetrics[];
    memoryHeaviestTests: TestPerformanceMetrics[];
  } {
    if (this.metrics.length === 0) {
      return {
        totalTests: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        totalMemoryUsed: 0,
        slowestTests: [],
        memoryHeaviestTests: []
      };
    }

    const totalExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0);
    const maxExecutionTime = Math.max(...this.metrics.map(m => m.executionTime));
    const totalMemoryUsed = this.metrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0);

    // Get top 5 slowest tests
    const slowestTests = [...this.metrics]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5);

    // Get top 5 memory-heaviest tests
    const memoryHeaviestTests = [...this.metrics]
      .sort((a, b) => b.memoryUsage.heapUsed - a.memoryUsage.heapUsed)
      .slice(0, 5);

    return {
      totalTests: this.metrics.length,
      averageExecutionTime: totalExecutionTime / this.metrics.length,
      maxExecutionTime,
      totalMemoryUsed,
      slowestTests,
      memoryHeaviestTests
    };
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const summary = this.getSummary();
    
    console.log('\n📊 Test Performance Report');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Average Execution Time: ${summary.averageExecutionTime.toFixed(2)}ms`);
    console.log(`Max Execution Time: ${summary.maxExecutionTime.toFixed(2)}ms`);
    console.log(`Total Memory Used: ${(summary.totalMemoryUsed / 1024 / 1024).toFixed(2)}MB`);

    if (summary.slowestTests.length > 0) {
      console.log('\n🐌 Slowest Tests:');
      summary.slowestTests.forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.testName}: ${test.executionTime.toFixed(2)}ms`);
      });
    }

    if (summary.memoryHeaviestTests.length > 0) {
      console.log('\n🧠 Memory-Heaviest Tests:');
      summary.memoryHeaviestTests.forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.testName}: ${(test.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      });
    }

    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    if (summary.maxExecutionTime > this.thresholds.maxExecutionTime) {
      console.log('  - Consider optimizing slow tests or increasing timeout thresholds');
    }
    if (summary.totalMemoryUsed > this.thresholds.maxMemoryUsage * summary.totalTests) {
      console.log('  - Consider optimizing memory usage in tests');
    }
    if (summary.averageExecutionTime > 1000) {
      console.log('  - Average test execution time is high, consider parallelization');
    }
    
    console.log('=' .repeat(50));
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.startTimes.clear();
  }

  /**
   * Export metrics to JSON for CI reporting
   */
  exportMetrics(): string {
    return JSON.stringify({
      summary: this.getSummary(),
      metrics: this.metrics,
      thresholds: this.thresholds,
      timestamp: Date.now()
    }, null, 2);
  }
}

// Global performance monitor instance
export const performanceMonitor = new TestPerformanceMonitor();

/**
 * Vitest setup hook for performance monitoring
 */
export function setupPerformanceMonitoring() {
  // Hook into Vitest lifecycle
  if (typeof beforeEach !== 'undefined') {
    beforeEach((context) => {
      const testName = context.task?.name || 'unknown-test';
      performanceMonitor.startTest(testName);
    });
  }

  if (typeof afterEach !== 'undefined') {
    afterEach((context) => {
      const testName = context.task?.name || 'unknown-test';
      try {
        performanceMonitor.endTest(testName);
      } catch (error) {
        // Test wasn't started, ignore
      }
    });
  }

  // Print report after all tests
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      performanceMonitor.printReport();
      
      // Export metrics for CI if in CI environment
      if (process.env.CI) {
        const fs = require('fs');
        const path = require('path');
        const metricsPath = path.join(process.cwd(), 'test-results', 'performance-metrics.json');
        
        // Ensure directory exists
        const dir = path.dirname(metricsPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(metricsPath, performanceMonitor.exportMetrics());
        console.log(`📁 Performance metrics exported to: ${metricsPath}`);
      }
    });
  }
}

/**
 * Decorator for monitoring individual test functions
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  testName: string,
  testFn: T
): T {
  return ((...args: any[]) => {
    performanceMonitor.startTest(testName);
    try {
      const result = testFn(...args);
      
      // Handle async functions
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          performanceMonitor.endTest(testName);
        });
      } else {
        performanceMonitor.endTest(testName);
        return result;
      }
    } catch (error) {
      performanceMonitor.endTest(testName);
      throw error;
    }
  }) as T;
}

export default TestPerformanceMonitor;