'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement

    root.classList.remove('dark')
    if (!root.classList.contains('light')) {
      root.classList.add('light')
    }

    return () => {
      root.classList.remove('dark')
      root.classList.add('light')
    }
  }, [])

  return <>{children}</>
}
