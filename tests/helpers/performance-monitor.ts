import { vi } from 'vitest'

export function setupPerformanceMonitoring(): void {
  // Lightweight no-op harness used by the Vitest setup file.
  // The real implementation can be extended later if needed.
  ;(globalThis as any).__perfMarks = []
  ;(globalThis as any).performance = (globalThis as any).performance || {
    mark: vi.fn(),
    measure: vi.fn(),
    now: () => Date.now(),
  }
}

