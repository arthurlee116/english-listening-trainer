import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables for E2E tests
process.env.CEREBRAS_API_KEY = 'test-api-key-e2e'
process.env.DATABASE_URL = 'file:./test-e2e.db'
// Note: NODE_ENV is read-only in some environments, set via test runner config

// Mock Next.js modules that are commonly problematic in tests
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
}))

// Mock Next.js navigation (App Router)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock server-only module
vi.mock('server-only', () => ({}))

// Mock Web APIs that might not be available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn()
}

// Mock URL.createObjectURL and revokeObjectURL for file download tests
global.URL.createObjectURL = vi.fn()
global.URL.revokeObjectURL = vi.fn()

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

console.error = vi.fn((message, ...args) => {
  // Only show actual errors, not React warnings in tests
  if (typeof message === 'string' && message.includes('Warning:')) {
    return
  }
  originalConsoleError(message, ...args)
})

console.warn = vi.fn((message, ...args) => {
  // Filter out common test warnings
  if (typeof message === 'string' && (
    message.includes('componentWillReceiveProps') ||
    message.includes('componentWillUpdate') ||
    message.includes('ReactDOM.render')
  )) {
    return
  }
  originalConsoleWarn(message, ...args)
})

// Mock timers for consistent test behavior
vi.useFakeTimers({
  shouldAdvanceTime: true,
})

// Note: Test timeout should be configured in vitest.config.ts
// Default E2E test timeout is set to 30 seconds