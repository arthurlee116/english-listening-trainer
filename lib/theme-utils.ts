/**
 * Theme utility functions for consistent theme-aware styling
 * Provides utilities for working with light theme classes and CSS custom properties
 */

import { cn } from '@/lib/utils'

/**
 * Theme-aware class mapping for consistent styling
 */
export const themeClasses = {
  // Background classes
  background: {
    app: 'bg-background',
    panel: 'bg-background-panel',
    subtle: 'bg-background-subtle',
    content: 'bg-background-content',
  },
  
  // Text classes with light theme optimization
  text: {
    primary: 'text-foreground',
    secondary: 'text-foreground-secondary', 
    tertiary: 'text-foreground-tertiary',
    muted: 'text-foreground-muted',
  },
  
  // Border classes
  border: {
    default: 'border-border',
    subtle: 'border-border-subtle',
    emphasis: 'border-border-emphasis',
  },
  
  // Button classes (using brand colors)
  button: {
    primary: 'bg-brand-lightPrimary text-primary-foreground',
    secondary: 'bg-brand-lightSecondary text-secondary-foreground',
    outline: 'bg-background border-border-emphasis',
    destructive: 'bg-destructive-light text-destructive-foreground',
  },
  
  // Glass effect classes
  glass: {
    default: 'glass-effect',
    panel: 'light-panel',
  },
  
  // Icon classes for light theme visibility
  icon: {
    primary: 'text-brand-lightText',
    secondary: 'text-brand-lightTextSecondary',
    tertiary: 'text-brand-lightTextTertiary',
    muted: 'text-brand-lightTextMuted',
    interactive: 'text-brand-lightText hover:text-brand-lightPrimary',
    nav: 'text-brand-lightTextSecondary hover:text-brand-lightText',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  }
} as const

/**
 * Generate theme-aware classes based on component type and variant
 * @param component - Component type (button, text, icon, etc.)
 * @param variant - Variant within the component type
 * @param additionalClasses - Additional classes to merge
 */
export function getThemeClass(
  component: keyof typeof themeClasses,
  variant: string,
  additionalClasses?: string
): string {
  const componentClasses = themeClasses[component] as Record<string, string>
  const themeClass = componentClasses[variant] || ''
  
  return cn(themeClass, additionalClasses)
}

/**
 * Create a theme-aware class string with fallbacks
 * @param lightClass - Class for light theme
 * @param darkClass - Class for dark theme (optional)
 * @param baseClasses - Base classes that apply to both themes
 */
export function createThemeClass(
  lightClass: string,
  darkClass?: string,
  baseClasses?: string
): string {
  const classes = [baseClasses, lightClass]
  
  if (darkClass) {
    classes.push(`dark:${darkClass}`)
  }
  
  return cn(...classes.filter(Boolean))
}

/**
 * CSS custom property utilities for theme integration
 */
export const cssVars = {
  // Background variables
  background: 'var(--background)',
  backgroundSubtle: 'var(--background-subtle)',
  backgroundPanel: 'var(--background-panel)',
  
  // Text variables
  foreground: 'var(--foreground)',
  foregroundSecondary: 'var(--foreground-secondary)',
  foregroundTertiary: 'var(--foreground-tertiary)',
  foregroundMuted: 'var(--foreground-muted)',
  
  // Primary color variables
  primary: 'var(--primary)',
  primaryLight: 'var(--primary-light)',
  primaryBorder: 'var(--primary-border)',
  primaryForeground: 'var(--primary-foreground)',
  
  // Border variables
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  borderEmphasis: 'var(--border-emphasis)',
  
  // Button variables
  buttonSecondaryBg: 'var(--button-secondary-bg)',
  buttonSecondaryBorder: 'var(--button-secondary-border)',
  buttonDestructiveBg: 'var(--button-destructive-bg)',
  buttonDestructiveBorder: 'var(--button-destructive-border)',
  
  // Glass effect variables
  glassBlur: 'var(--glass-blur)',
  glassOpacity: 'var(--glass-opacity)',
  glassBorderOpacity: 'var(--glass-border-opacity)',
  
  // Transition variables
  transitionDuration: 'var(--transition-duration)',
} as const

/**
 * Generate inline styles using CSS custom properties
 * @param properties - Object mapping CSS properties to custom property names
 */
export function createCSSVarStyles(
  properties: Record<string, keyof typeof cssVars>
): React.CSSProperties {
  const styles: React.CSSProperties = {}
  
  Object.entries(properties).forEach(([cssProp, varName]) => {
    const cssVar = cssVars[varName]
    if (cssVar) {
      styles[cssProp as any] = `hsl(${cssVar})`
    }
  })
  
  return styles
}

/**
 * Theme-aware component class generators
 */
export const themeComponents = {
  /**
   * Generate button classes based on variant and theme
   */
  button: (variant: 'primary' | 'secondary' | 'outline' | 'destructive', size?: 'sm' | 'md' | 'lg') => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
    
    const sizeClasses = {
      sm: 'h-9 rounded-md px-3 text-sm',
      md: 'h-10 px-4 py-2 text-sm',
      lg: 'h-11 rounded-md px-8 text-base'
    }
    
    const variantClasses = {
      primary: 'bg-brand-lightPrimary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-brand-lightSecondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border border-brand-lightBorder bg-background hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive-light text-destructive-foreground hover:bg-destructive/90'
    }
    
    return cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size || 'md']
    )
  },
  
  /**
   * Generate card classes with theme-aware styling
   */
  card: (variant?: 'default' | 'glass' | 'panel') => {
    const baseClasses = 'rounded-lg border shadow-sm'
    
    const variantClasses = {
      default: 'bg-card text-card-foreground border-border',
      glass: 'glass-effect',
      panel: 'light-panel'
    }
    
    return cn(baseClasses, variantClasses[variant || 'default'])
  },
  
  /**
   * Generate text classes with proper hierarchy
   */
  text: (level: 'primary' | 'secondary' | 'tertiary' | 'muted', size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl') => {
    const levelClasses = {
      primary: 'text-brand-lightText',
      secondary: 'text-brand-lightTextSecondary',
      tertiary: 'text-brand-lightTextTertiary',
      muted: 'text-brand-lightTextMuted'
    }
    
    const sizeClasses = {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl'
    }
    
    return cn(levelClasses[level], sizeClasses[size || 'base'])
  }
}

/**
 * Responsive theme utilities
 */
export const responsiveTheme = {
  /**
   * Generate responsive classes for different screen sizes
   */
  responsive: (classes: {
    mobile?: string
    tablet?: string
    desktop?: string
    wide?: string
  }) => {
    return cn(
      classes.mobile,
      classes.tablet && `md:${classes.tablet}`,
      classes.desktop && `lg:${classes.desktop}`,
      classes.wide && `xl:${classes.wide}`
    )
  },
  
  /**
   * Generate viewport-specific theme classes
   */
  viewport: (viewport: '768px' | '1024px' | '1280px' | '1440px') => {
    const viewportClasses = {
      '768px': 'max-w-3xl mx-auto px-4',
      '1024px': 'max-w-5xl mx-auto px-6',
      '1280px': 'max-w-6xl mx-auto px-8',
      '1440px': 'max-w-7xl mx-auto px-8'
    }
    
    return viewportClasses[viewport]
  }
}

/**
 * Accessibility-focused theme utilities
 */
export const a11yTheme = {
  /**
   * Generate focus-visible classes with proper contrast
   */
  focus: (variant?: 'default' | 'primary' | 'destructive') => {
    const baseClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
    
    const variantClasses = {
      default: 'focus-visible:ring-ring',
      primary: 'focus-visible:ring-primary',
      destructive: 'focus-visible:ring-destructive'
    }
    
    return cn(baseClasses, variantClasses[variant || 'default'])
  },
  
  /**
   * Generate high contrast classes for accessibility
   */
  highContrast: (element: 'text' | 'border' | 'background') => {
    const contrastClasses = {
      text: 'text-foreground contrast-more:text-black dark:contrast-more:text-white',
      border: 'border-border contrast-more:border-black dark:contrast-more:border-white',
      background: 'bg-background contrast-more:bg-white dark:contrast-more:bg-black'
    }
    
    return contrastClasses[element]
  }
}