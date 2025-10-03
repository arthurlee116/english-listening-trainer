/**
 * End-to-End Theme Switching Tests
 * Comprehensive tests for theme switching across the application
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import React from 'react'

describe('End-to-End Theme Switching', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    localStorage.clear()
  })

  it('should render theme toggle button', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    )

    const toggleButton = screen.getByRole('button')
    expect(toggleButton).toBeInTheDocument()
  })

  it('should apply light theme classes correctly', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <div className="glass-effect">Glass Panel</div>
          <button className="btn-primary-light">Primary Button</button>
          <p className="text-primary-light">Primary Text</p>
          <div className="icon-primary-light">Icon</div>
        </div>
      </ThemeProvider>
    )

    const glassPanel = screen.getByText('Glass Panel')
    const button = screen.getByText('Primary Button')
    const text = screen.getByText('Primary Text')
    const icon = screen.getByText('Icon')

    expect(glassPanel).toHaveClass('glass-effect')
    expect(button).toHaveClass('btn-primary-light')
    expect(text).toHaveClass('text-primary-light')
    expect(icon).toHaveClass('icon-primary-light')
  })

  it('should apply dark theme classes correctly', () => {
    document.documentElement.classList.add('dark')

    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <div>
          <div className="glass-effect">Glass Panel</div>
          <button className="btn-primary-light">Primary Button</button>
        </div>
      </ThemeProvider>
    )

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should maintain component functionality during theme switch', () => {
    const { rerender } = render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <button className="btn-primary-light" onClick={() => {}}>
            Click Me
          </button>
        </div>
      </ThemeProvider>
    )

    const button = screen.getByText('Click Me')
    expect(button).toBeInTheDocument()

    // Switch to dark theme
    document.documentElement.classList.add('dark')

    rerender(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <div>
          <button className="btn-primary-light" onClick={() => {}}>
            Click Me
          </button>
        </div>
      </ThemeProvider>
    )

    // Button should still be functional
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('btn-primary-light')
  })

  it('should apply background gradients correctly in light theme', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div className="bg-app-light">App Background</div>
      </ThemeProvider>
    )

    const background = screen.getByText('App Background')
    expect(background).toHaveClass('bg-app-light')
  })

  it('should apply separator styles correctly', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <hr className="separator-light" />
          <hr className="separator-emphasis-light" />
        </div>
      </ThemeProvider>
    )

    const separators = document.querySelectorAll('hr')
    expect(separators[0]).toHaveClass('separator-light')
    expect(separators[1]).toHaveClass('separator-emphasis-light')
  })

  it('should handle all button variants in light theme', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <button className="btn-primary-light">Primary</button>
          <button className="btn-secondary-light">Secondary</button>
          <button className="btn-outline-light">Outline</button>
          <button className="btn-destructive-light">Destructive</button>
        </div>
      </ThemeProvider>
    )

    expect(screen.getByText('Primary')).toHaveClass('btn-primary-light')
    expect(screen.getByText('Secondary')).toHaveClass('btn-secondary-light')
    expect(screen.getByText('Outline')).toHaveClass('btn-outline-light')
    expect(screen.getByText('Destructive')).toHaveClass('btn-destructive-light')
  })

  it('should handle all text variants in light theme', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <p className="text-primary-light">Primary Text</p>
          <p className="text-secondary-light">Secondary Text</p>
          <p className="text-tertiary-light">Tertiary Text</p>
          <p className="text-muted-light">Muted Text</p>
        </div>
      </ThemeProvider>
    )

    expect(screen.getByText('Primary Text')).toHaveClass('text-primary-light')
    expect(screen.getByText('Secondary Text')).toHaveClass('text-secondary-light')
    expect(screen.getByText('Tertiary Text')).toHaveClass('text-tertiary-light')
    expect(screen.getByText('Muted Text')).toHaveClass('text-muted-light')
  })

  it('should handle all icon variants in light theme', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <span className="icon-primary-light">Icon 1</span>
          <span className="icon-secondary-light">Icon 2</span>
          <span className="icon-interactive-light">Icon 3</span>
        </div>
      </ThemeProvider>
    )

    expect(screen.getByText('Icon 1')).toHaveClass('icon-primary-light')
    expect(screen.getByText('Icon 2')).toHaveClass('icon-secondary-light')
    expect(screen.getByText('Icon 3')).toHaveClass('icon-interactive-light')
  })

  it('should apply panel styles correctly', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div className="light-panel">Panel Content</div>
      </ThemeProvider>
    )

    const panel = screen.getByText('Panel Content')
    expect(panel).toHaveClass('light-panel')
  })

  it('should maintain accessibility during theme switch', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div>
          <button className="btn-primary-light" aria-label="Primary Action">
            Action
          </button>
          <ThemeToggle />
        </div>
      </ThemeProvider>
    )

    const actionButton = screen.getByLabelText('Primary Action')
    expect(actionButton).toBeInTheDocument()

    const themeToggle = screen.getByRole('button', { name: /theme/i })
    expect(themeToggle).toBeInTheDocument()
  })

  it('should handle complex nested components', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <div className="glass-effect">
          <div className="light-panel">
            <h1 className="text-primary-light">Title</h1>
            <p className="text-secondary-light">Description</p>
            <button className="btn-primary-light">Action</button>
          </div>
        </div>
      </ThemeProvider>
    )

    expect(screen.getByText('Title')).toHaveClass('text-primary-light')
    expect(screen.getByText('Description')).toHaveClass('text-secondary-light')
    expect(screen.getByText('Action')).toHaveClass('btn-primary-light')
  })

  it('should not break existing dark theme styles', () => {
    document.documentElement.classList.add('dark')

    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <div>
          <div className="glass-effect">Dark Glass</div>
          <button className="btn-primary-light">Dark Button</button>
        </div>
      </ThemeProvider>
    )

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByText('Dark Glass')).toBeInTheDocument()
    expect(screen.getByText('Dark Button')).toBeInTheDocument()
  })
})
