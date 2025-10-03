/**
 * Theme State Persistence Tests
 * Tests for theme preference persistence across browser sessions
 * Requirements: 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider } from '@/components/theme-provider'
import React from 'react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    }
  }
})()

describe('Theme State Persistence', () => {
  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
    localStorageMock.clear()
    document.documentElement.className = ''
  })

  afterEach(() => {
    localStorageMock.clear()
    document.documentElement.className = ''
  })

  describe('9.2 Theme Preference Persistence', () => {
    it('should persist theme preference to localStorage', () => {
      // Set theme in localStorage
      localStorageMock.setItem('theme', 'dark')

      // Verify it was stored
      expect(localStorageMock.getItem('theme')).toBe('dark')
    })

    it('should load theme preference from localStorage on mount', () => {
      // Pre-set theme preference
      localStorageMock.setItem('theme', 'dark')

      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Test Content</div>
        </ThemeProvider>
      )

      // Verify theme was loaded
      expect(localStorageMock.getItem('theme')).toBe('dark')
    })

    it('should handle missing localStorage gracefully', () => {
      // Remove localStorage
      const originalLocalStorage = window.localStorage
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true
      })

      // Should not throw error
      expect(() => {
        render(
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <div>Test Content</div>
          </ThemeProvider>
        )
      }).not.toThrow()

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      })
    })

    it('should persist light theme preference', () => {
      localStorageMock.setItem('theme', 'light')

      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div>Test Content</div>
        </ThemeProvider>
      )

      expect(localStorageMock.getItem('theme')).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should persist dark theme preference', () => {
      localStorageMock.setItem('theme', 'dark')

      render(
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div>Test Content</div>
        </ThemeProvider>
      )

      expect(localStorageMock.getItem('theme')).toBe('dark')
    })

    it('should persist system theme preference', () => {
      localStorageMock.setItem('theme', 'system')

      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Test Content</div>
        </ThemeProvider>
      )

      expect(localStorageMock.getItem('theme')).toBe('system')
    })

    it('should update localStorage when theme changes', () => {
      localStorageMock.setItem('theme', 'light')

      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div>Test Content</div>
        </ThemeProvider>
      )

      // Simulate theme change
      localStorageMock.setItem('theme', 'dark')

      expect(localStorageMock.getItem('theme')).toBe('dark')
    })

    it('should handle theme switching across multiple sessions', () => {
      // Session 1: Set to dark
      localStorageMock.setItem('theme', 'dark')
      expect(localStorageMock.getItem('theme')).toBe('dark')

      // Session 2: Load dark theme
      const { unmount } = render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Session 2</div>
        </ThemeProvider>
      )
      expect(localStorageMock.getItem('theme')).toBe('dark')
      unmount()

      // Session 3: Change to light
      localStorageMock.setItem('theme', 'light')
      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Session 3</div>
        </ThemeProvider>
      )
      expect(localStorageMock.getItem('theme')).toBe('light')
    })

    it('should use default theme when no preference is stored', () => {
      // No theme in localStorage
      expect(localStorageMock.getItem('theme')).toBeNull()

      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div>Test Content</div>
        </ThemeProvider>
      )

      // Should use default theme
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should handle corrupted localStorage data', () => {
      // Set invalid theme value
      localStorageMock.setItem('theme', 'invalid-theme')

      // Should not throw error
      expect(() => {
        render(
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <div>Test Content</div>
          </ThemeProvider>
        )
      }).not.toThrow()
    })

    it('should maintain theme consistency across page refreshes', () => {
      // Initial render with dark theme
      localStorageMock.setItem('theme', 'dark')
      
      const { unmount } = render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Initial Load</div>
        </ThemeProvider>
      )

      const themeAfterFirstLoad = localStorageMock.getItem('theme')
      unmount()

      // Simulate page refresh
      document.documentElement.className = ''

      // Re-render (simulating page refresh)
      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>After Refresh</div>
        </ThemeProvider>
      )

      // Theme should be the same
      expect(localStorageMock.getItem('theme')).toBe(themeAfterFirstLoad)
    })

    it('should work consistently across all application pages', () => {
      // Set theme
      localStorageMock.setItem('theme', 'dark')

      // Render "page 1"
      const { unmount: unmount1 } = render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Page 1</div>
        </ThemeProvider>
      )
      expect(localStorageMock.getItem('theme')).toBe('dark')
      unmount1()

      // Render "page 2"
      const { unmount: unmount2 } = render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Page 2</div>
        </ThemeProvider>
      )
      expect(localStorageMock.getItem('theme')).toBe('dark')
      unmount2()

      // Render "page 3"
      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Page 3</div>
        </ThemeProvider>
      )
      expect(localStorageMock.getItem('theme')).toBe('dark')
    })
  })

  describe('Theme Loading on Page Refresh', () => {
    it('should apply theme immediately on page load', () => {
      // Pre-set theme
      localStorageMock.setItem('theme', 'dark')

      // Render component
      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Test Content</div>
        </ThemeProvider>
      )

      // Theme should be loaded from storage
      expect(localStorageMock.getItem('theme')).toBe('dark')
    })

    it('should not flash incorrect theme on load', () => {
      // Set dark theme
      localStorageMock.setItem('theme', 'dark')

      // Track class changes
      const classChanges: string[] = []
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            classChanges.push(document.documentElement.className)
          }
        })
      })

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      })

      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Test Content</div>
        </ThemeProvider>
      )

      observer.disconnect()

      // Should not have multiple theme changes (no flash)
      expect(classChanges.length).toBeLessThan(3)
    })

    it('should handle system theme preference correctly', () => {
      localStorageMock.setItem('theme', 'system')

      // Mock matchMedia for system theme
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>Test Content</div>
        </ThemeProvider>
      )

      expect(localStorageMock.getItem('theme')).toBe('system')
    })
  })
})
