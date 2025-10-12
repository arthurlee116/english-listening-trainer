/**
 * Responsive Testing Utilities
 * Helper functions for testing responsive design across different viewports
 */

export interface ViewportConfig {
  width: number
  height: number
  name: string
}

export const STANDARD_VIEWPORTS: Record<string, ViewportConfig> = {
  desktop1440: { width: 1440, height: 900, name: 'Desktop 1440px' },
  desktop1280: { width: 1280, height: 800, name: 'Desktop 1280px' },
  tablet1024: { width: 1024, height: 768, name: 'Tablet 1024px' },
  mobile768: { width: 768, height: 1024, name: 'Mobile 768px' },
  mobile375: { width: 375, height: 667, name: 'Mobile 375px' }
}

/**
 * Sets the viewport size for testing
 */
export const setViewportSize = (width: number, height: number): void => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  
  // Update matchMedia mock to reflect new viewport
  const mockMatchMedia = (query: string) => ({
    matches: evaluateMediaQuery(query, width, height),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
  
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(mockMatchMedia),
  })
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

/**
 * Evaluates a media query against given dimensions
 */
const evaluateMediaQuery = (query: string, width: number, height: number): boolean => {
  // Simple media query evaluation for common cases
  if (query.includes('max-width')) {
    const maxWidth = parseInt(query.match(/max-width:\s*(\d+)px/)?.[1] || '0')
    return width <= maxWidth
  }
  
  if (query.includes('min-width')) {
    const minWidth = parseInt(query.match(/min-width:\s*(\d+)px/)?.[1] || '0')
    return width >= minWidth
  }
  
  if (query.includes('max-height')) {
    const maxHeight = parseInt(query.match(/max-height:\s*(\d+)px/)?.[1] || '0')
    return height <= maxHeight
  }
  
  if (query.includes('min-height')) {
    const minHeight = parseInt(query.match(/min-height:\s*(\d+)px/)?.[1] || '0')
    return height >= minHeight
  }
  
  return false
}

/**
 * Test helper to run a test across multiple viewports
 */
export const testAcrossViewports = async (
  viewports: ViewportConfig[],
  testFn: (viewport: ViewportConfig) => Promise<void> | void
): Promise<void> => {
  for (const viewport of viewports) {
    setViewportSize(viewport.width, viewport.height)
    await testFn(viewport)
  }
}

/**
 * Checks if an element has responsive classes
 */
export const hasResponsiveClasses = (element: Element, classes: string[]): boolean => {
  const classList = Array.from(element.classList)
  return classes.some(className => classList.includes(className))
}

/**
 * Gets computed styles for responsive testing
 */
export const getResponsiveStyles = (element: Element): CSSStyleDeclaration => {
  return window.getComputedStyle(element)
}

/**
 * Validates that text is readable (has sufficient contrast)
 */
export const validateTextReadability = (element: Element): boolean => {
  const styles = getResponsiveStyles(element)
  const color = styles.color
  const backgroundColor = styles.backgroundColor
  
  // Basic check - ensure text has color and background is not the same
  return color !== backgroundColor && color !== 'rgba(0, 0, 0, 0)'
}

/**
 * Checks if element maintains proper spacing across viewports
 */
export const validateSpacing = (element: Element): boolean => {
  const classList = Array.from(element.classList)
  
  // Check for responsive spacing classes
  const spacingClasses = [
    'p-', 'm-', 'px-', 'py-', 'mx-', 'my-',
    'space-x-', 'space-y-', 'gap-'
  ]
  
  return spacingClasses.some(prefix => 
    classList.some(cls => cls.startsWith(prefix))
  )
}

/**
 * Mock window.matchMedia for testing
 */
export const mockMatchMedia = (): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}