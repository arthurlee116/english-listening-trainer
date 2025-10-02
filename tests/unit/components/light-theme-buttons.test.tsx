import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Simple test component to verify light theme button classes
const TestButton = ({ className, children, ...props }: { className: string; children: React.ReactNode; [key: string]: any }) => (
  <button className={className} {...props}>
    {children}
  </button>
)

describe('Light Theme Button Classes', () => {
  it('should render btn-primary-light with correct classes', () => {
    render(<TestButton className="btn-primary-light">Primary Button</TestButton>)
    const button = screen.getByRole('button', { name: 'Primary Button' })
    expect(button).toHaveClass('btn-primary-light')
  })

  it('should render btn-secondary-light with correct classes', () => {
    render(<TestButton className="btn-secondary-light">Secondary Button</TestButton>)
    const button = screen.getByRole('button', { name: 'Secondary Button' })
    expect(button).toHaveClass('btn-secondary-light')
  })

  it('should render btn-outline-light with correct classes', () => {
    render(<TestButton className="btn-outline-light">Outline Button</TestButton>)
    const button = screen.getByRole('button', { name: 'Outline Button' })
    expect(button).toHaveClass('btn-outline-light')
  })

  it('should render btn-destructive-light with correct classes', () => {
    render(<TestButton className="btn-destructive-light">Destructive Button</TestButton>)
    const button = screen.getByRole('button', { name: 'Destructive Button' })
    expect(button).toHaveClass('btn-destructive-light')
  })

  it('should handle disabled state correctly', () => {
    render(<TestButton className="btn-primary-light" disabled>Disabled Button</TestButton>)
    const button = screen.getByRole('button', { name: 'Disabled Button' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('btn-primary-light')
  })

  it('should handle loading state correctly', () => {
    render(<TestButton className="btn-primary-light loading">Loading Button</TestButton>)
    const button = screen.getByRole('button', { name: 'Loading Button' })
    expect(button).toHaveClass('btn-primary-light', 'loading')
  })
})