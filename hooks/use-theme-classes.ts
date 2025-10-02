'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Hook for conditionally applying light theme classes based on current theme
 * Provides theme-aware class utilities for components
 */
export function useThemeClasses() {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by returning neutral classes until mounted
  if (!mounted) {
    return {
      isLight: false,
      isDark: false,
      themeClass: (lightClass: string, darkClass?: string) => '',
      buttonClass: (variant: 'primary' | 'secondary' | 'outline' | 'destructive') => '',
      textClass: (level: 'primary' | 'secondary' | 'tertiary' | 'muted') => '',
      iconClass: (type: 'primary' | 'secondary' | 'tertiary' | 'interactive' | 'nav') => '',
      glassClass: () => 'glass-effect',
      panelClass: () => 'light-panel',
      separatorClass: (emphasis?: 'default' | 'emphasis' | 'strong') => '',
      borderClass: (emphasis?: 'default' | 'emphasis' | 'strong') => '',
    }
  }

  const isLight = resolvedTheme === 'light'
  const isDark = resolvedTheme === 'dark'

  /**
   * Conditionally apply classes based on theme
   * @param lightClass - Class to apply in light theme
   * @param darkClass - Class to apply in dark theme (optional)
   */
  const themeClass = (lightClass: string, darkClass?: string) => {
    if (isLight) return lightClass
    if (isDark && darkClass) return darkClass
    return ''
  }

  /**
   * Get theme-appropriate button classes
   * @param variant - Button variant type
   */
  const buttonClass = (variant: 'primary' | 'secondary' | 'outline' | 'destructive') => {
    if (!isLight) return '' // Use default button styling for dark theme
    
    switch (variant) {
      case 'primary':
        return 'btn-primary-light'
      case 'secondary':
        return 'btn-secondary-light'
      case 'outline':
        return 'btn-outline-light'
      case 'destructive':
        return 'btn-destructive-light'
      default:
        return ''
    }
  }

  /**
   * Get theme-appropriate text classes
   * @param level - Text hierarchy level
   */
  const textClass = (level: 'primary' | 'secondary' | 'tertiary' | 'muted') => {
    if (!isLight) return '' // Use default text styling for dark theme
    
    switch (level) {
      case 'primary':
        return 'text-primary-light'
      case 'secondary':
        return 'text-secondary-light'
      case 'tertiary':
        return 'text-tertiary-light'
      case 'muted':
        return 'text-muted-light'
      default:
        return ''
    }
  }

  /**
   * Get theme-appropriate icon classes
   * @param type - Icon type/usage context
   */
  const iconClass = (type: 'primary' | 'secondary' | 'tertiary' | 'interactive' | 'nav' | 'success' | 'warning' | 'error' | 'info' | 'loading') => {
    if (!isLight) return '' // Use default icon styling for dark theme
    
    switch (type) {
      case 'primary':
        return 'icon-primary-light'
      case 'secondary':
        return 'icon-secondary-light'
      case 'tertiary':
        return 'icon-tertiary-light'
      case 'interactive':
        return 'icon-interactive-light'
      case 'nav':
        return 'icon-nav-light'
      case 'success':
        return 'icon-success-light'
      case 'warning':
        return 'icon-warning-light'
      case 'error':
        return 'icon-error-light'
      case 'info':
        return 'icon-info-light'
      case 'loading':
        return 'icon-loading-light'
      default:
        return ''
    }
  }

  /**
   * Get glass effect class (already theme-aware in CSS)
   */
  const glassClass = () => 'glass-effect'

  /**
   * Get panel class (already theme-aware in CSS)
   */
  const panelClass = () => 'light-panel'

  /**
   * Get theme-appropriate separator classes
   * @param emphasis - Separator emphasis level
   */
  const separatorClass = (emphasis: 'default' | 'emphasis' | 'strong' = 'default') => {
    if (!isLight) return '' // Use default separator styling for dark theme
    
    switch (emphasis) {
      case 'default':
        return 'separator-light'
      case 'emphasis':
        return 'separator-emphasis-light'
      case 'strong':
        return 'separator-strong-light'
      default:
        return 'separator-light'
    }
  }

  /**
   * Get theme-appropriate border classes
   * @param emphasis - Border emphasis level
   */
  const borderClass = (emphasis: 'default' | 'emphasis' | 'strong' = 'default') => {
    if (!isLight) return '' // Use default border styling for dark theme
    
    switch (emphasis) {
      case 'default':
        return 'border-light'
      case 'emphasis':
        return 'border-emphasis-light'
      case 'strong':
        return 'border-strong-light'
      default:
        return 'border-light'
    }
  }

  return {
    isLight,
    isDark,
    themeClass,
    buttonClass,
    textClass,
    iconClass,
    glassClass,
    panelClass,
    separatorClass,
    borderClass,
  }
}

/**
 * Utility function to combine theme classes with existing classes
 * @param baseClasses - Base CSS classes
 * @param themeClasses - Theme-specific classes
 */
export function combineThemeClasses(baseClasses: string, themeClasses: string) {
  return cn(baseClasses, themeClasses)
}