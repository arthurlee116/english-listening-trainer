import { describe, expect, it, vi } from 'vitest'
import { isElementVisible } from '../../hooks/use-focus-trap'

describe('isElementVisible', () => {
  it('uses checkVisibility when available', () => {
    const element = document.createElement('div')
    const checkVisibility = vi.fn().mockReturnValue(false)
    element.checkVisibility = checkVisibility

    expect(isElementVisible(element)).toBe(false)
    expect(checkVisibility).toHaveBeenCalledWith({
      checkOpacity: true,
      checkVisibilityCSS: true,
    })
  })

  it('falls back to offsets when size is present', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 12 })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 0 })
    Object.defineProperty(element, 'getClientRects', { configurable: true, value: () => [] })

    expect(isElementVisible(element)).toBe(true)
  })

  it('falls back to client rects when offsets are zero', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 0 })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 0 })
    Object.defineProperty(element, 'getClientRects', {
      configurable: true,
      value: () => [{ width: 4, height: 4 }],
    })

    expect(isElementVisible(element)).toBe(true)
  })

  it('returns false when no size or client rects are present', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 0 })
    Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 0 })
    Object.defineProperty(element, 'getClientRects', { configurable: true, value: () => [] })

    expect(isElementVisible(element)).toBe(false)
  })
})
