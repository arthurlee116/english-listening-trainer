import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers/render-utils'

// Simple component for testing
const TestComponent = () => {
  return <div>Integration test working</div>
}

describe('Basic Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render a simple component', () => {
    renderWithProviders(<TestComponent />, { skipI18nInit: true })
    expect(screen.getByText('Integration test working')).toBeInTheDocument()
  })

  it('should handle localStorage operations', () => {
    // Use the actual localStorage mock
    const mockStorage = window.localStorage as any
    mockStorage.setItem.mockReturnValue(undefined)
    mockStorage.getItem.mockReturnValue('test-value')
    
    localStorage.setItem('test-key', 'test-value')
    expect(localStorage.getItem('test-key')).toBe('test-value')
  })

  it('should verify test environment is working', () => {
    expect(true).toBe(true)
  })
})