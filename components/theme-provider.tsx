'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'
import { useEffect } from 'react'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    // Listen for theme changes on the html element's class attribute only
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const html = document.documentElement
          const oldValue = mutation.oldValue || ''
          const newValue = html.className
          
          // Only trigger transition if 'dark' class actually changed
          const hadDark = oldValue.includes('dark')
          const hasDark = newValue.includes('dark')
          
          if (hadDark !== hasDark && !html.classList.contains('transitioning')) {
            html.classList.add('transitioning')
            
            // Remove transitioning class after transition completes
            setTimeout(() => {
              html.classList.remove('transitioning')
            }, 200)
          }
        }
      })
    })
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true
    })
    
    return () => observer.disconnect()
  }, [])
  
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
