'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement

    if (!root.classList.contains('dark')) {
      root.classList.add('dark')
    }

    return () => {
      root.classList.add('dark')
    }
  }, [])

  return <>{children}</>
}
