/**
 * Theme Switching Quality Assurance Tests
 * Tests for smooth theme transitions without flickering
 * Requirements: 8.1, 8.2, 8.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import React from 'react'

let currentTheme = 'light'

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
  useTheme: () => ({
    theme: currentTheme,
    setTheme: vi.fn((newTheme: string) => {
      currentTheme = newTheme
      // Simulate theme change by updating class
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }),
    systemTheme: 'light',
    themes: ['light', 'dark', 'system']
  })
}))

describe('Theme Switching Quality Assurance', () => {
  describe('9.1 Smooth Theme Transitions', () => {
    beforeEach(() => {
      // Reset DOM
      document.documentElement.className = ''
      document.documentElement.removeAttribute('style')
      currentTheme = 'light'
    })

    afterEach(() => {
      // Cleanup
      document.documentElement.className = ''
      vi.clearAllMocks()
    })

    it('should not flicker during light to dark theme switch', async () => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ThemeToggle />
        </ThemeProvider>
      )

      // Track class changes to detect flickering
      const classChanges: string[] = []
      let observer: MutationObserver | null = null
      
      try {
        observer = new MutationObserver((mutations) => {
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

        // Manually trigger theme change
        document.documentElement.classList.add('dark')

        await waitFor(() => {
          // Should have transitioning class during switch
          expect(classChanges.some(cls => cls.includes('transitioning'))).toBe(true)
        }, { timeout: 300 })

        // Verify no rapid class changes (flickering)
        const rapidChanges = classChanges.filter((cls, idx) => {
          if (idx === 0) return false
          return cls !== classChanges[idx - 1]
        })
        
        // Should have smooth transition, not multiple rapid changes
        expect(rapidChanges.length).toBeLessThan(5)
      } finally {
        if (observer) {
          observer.disconnect()
        }
      }
    })

    it('should apply transitioning class during theme switch', async () => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div>Test Content</div>
        </ThemeProvider>
      )

      // Simulate theme change by adding dark class
      document.documentElement.classList.add('dark')

      await waitFor(() => {
        expect(document.documentElement.classList.contains('transitioning')).toBe(true)
      }, { timeout: 100 })

      // Transitioning class should be removed after transition
      await waitFor(() => {
        expect(document.documentElement.classList.contains('transitioning')).toBe(false)
      }, { timeout: 300 })
    })

    it('should maintain smooth transitions for all CSS properties', () => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div className="glass-effect">Test Panel</div>
        </ThemeProvider>
      )

      const panel = screen.getByText('Test Panel')
      const styles = window.getComputedStyle(panel)

      // Verify transition properties are set
      expect(styles.transition).toContain('all')
      expect(styles.transitionDuration).toBeTruthy()
    })

    it('should preserve dark theme functionality during switch', async () => {
      const { rerender } = render(
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="text-primary-light">Dark Theme Text</div>
        </ThemeProvider>
      )

      // Add dark class to simulate dark theme
      document.documentElement.classList.add('dark')

      const textElement = screen.getByText('Dark Theme Text')
      const darkStyles = window.getComputedStyle(textElement)
      const darkColor = darkStyles.color

      // Switch to light theme
      document.documentElement.classList.remove('dark')
      
      rerender(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div className="text-primary-light">Dark Theme Text</div>
        </ThemeProvider>
      )

      await waitFor(() => {
        const lightStyles = window.getComputedStyle(textElement)
        // Colors should be different between themes
        expect(lightStyles.color).not.toBe(darkColor)
      })

      // Switch back to dark
      document.documentElement.classList.add('dark')
      
      rerender(
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="text-primary-light">Dark Theme Text</div>
        </ThemeProvider>
      )

      await waitFor(() => {
        const restoredStyles = window.getComputedStyle(textElement)
        // Dark theme should be restored correctly
        expect(restoredStyles.color).toBe(darkColor)
      })
    })

    it('should handle rapid theme switches without breaking', async () => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ThemeToggle />
        </ThemeProvider>
      )

      const toggleButton = screen.getByRole('button')

      // Rapidly toggle theme multiple times
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Should not throw errors or break
      expect(toggleButton).toBeInTheDocument()
    })

    it('should apply smooth transitions to glass effect components', () => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div className="glass-effect">Glass Panel</div>
        </ThemeProvider>
      )

      const panel = screen.getByText('Glass Panel')
      const styles = window.getComputedStyle(panel)

      // Verify glass effect has transition properties
      expect(styles.transition).toContain('all')
      expect(styles.backdropFilter).toContain('blur')
    })

    it('should apply smooth transitions to button components', () => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <button className="btn-primary-light">Primary Button</button>
        </ThemeProvider>
      )

      const button = screen.getByText('Primary Button')
      const styles = window.getComputedStyle(button)

      // Verify button has transition properties
      expect(styles.transition).toBeTruthy()
      expect(styles.transitionDuration).toBeTruthy()
    })

    it('should not cause layout shift during theme switch', async () => {
      const { container } = render(
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div className="glass-effect" style={{ width: '200px', height: '100px' }}>
            Content
          </div>
        </ThemeProvider>
      )

      const panel = container.querySelector('.glass-effect') as HTMLElement
      const initialRect = panel.getBoundingClientRect()

      // Switch theme
      document.documentElement.classList.add('dark')

      await waitFor(() => {
        const newRect = panel.getBoundingClientRect()
        // Dimensions should remain the same
        expect(newRect.width).toBe(initialRect.width)
        expect(newRect.height).toBe(initialRect.height)
      })
    })
  })
})
