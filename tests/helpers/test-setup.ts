import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { setupPerformanceMonitoring } from './performance-monitor'

// Mock localStorage with actual storage implementation
const createStorageMock = () => {
  const store = new Map<string, string>()
  
  return {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    get length() {
      return store.size
    },
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys())
      return keys[index] || null
    }),
  }
}

const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock window.matchMedia
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

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback: ResizeObserverCallback) {
    // Store callback for potential future use
  }
}

// Mock HTMLMediaElement
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockImplementation(() => Promise.resolve()),
})

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  writable: true,
  value: vi.fn(),
})

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-url')
global.URL.revokeObjectURL = vi.fn()

// Mock pointer capture methods for Radix UI compatibility
Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  writable: true,
  value: vi.fn().mockReturnValue(false),
})

Object.defineProperty(Element.prototype, 'setPointerCapture', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  writable: true,
  value: vi.fn(),
})

// Mock scrollIntoView for Radix UI compatibility
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  sessionStorageMock.clear()
})

// Setup performance monitoring for all tests
setupPerformanceMonitoring()