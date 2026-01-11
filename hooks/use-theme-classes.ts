'use client'

import { cn } from '@/lib/utils'

type TextLevel = 'primary' | 'secondary' | 'tertiary' | 'muted'
type IconType =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'interactive'
  | 'nav'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'loading'
type Emphasis = 'default' | 'emphasis' | 'strong'

const textPalette: Record<TextLevel, string> = {
  primary: 'text-foreground',
  secondary: 'text-foreground-secondary',
  tertiary: 'text-foreground-tertiary',
  muted: 'text-foreground-muted',
}

const iconPalette: Record<IconType, string> = {
  primary: 'text-foreground',
  secondary: 'text-foreground-secondary',
  tertiary: 'text-foreground-tertiary',
  interactive: 'text-foreground-secondary transition-colors hover:text-foreground',
  nav: 'text-foreground-tertiary transition-colors hover:text-foreground',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-rose-600',
  info: 'text-primary',
  loading: 'text-primary',
}

const borderPalette: Record<Emphasis, string> = {
  default: 'border-border',
  emphasis: 'border-border-emphasis',
  strong: 'border-border-emphasis',
}

const separatorPalette: Record<Emphasis, string> = {
  default: 'border-border',
  emphasis: 'border-border-emphasis',
  strong: 'border-border-emphasis',
}

export function useThemeClasses() {
  const themeClass = (lightClass: string, _darkClass?: string) => lightClass

  const textClass = (level: TextLevel) => textPalette[level]

  const iconClass = (type: IconType) => iconPalette[type]

  const borderClass = (emphasis: Emphasis = 'default') => borderPalette[emphasis]

  const separatorClass = (emphasis: Emphasis = 'default') => separatorPalette[emphasis]

  return {
    isLight: true,
    isDark: false,
    themeClass,
    textClass,
    iconClass,
    borderClass,
    separatorClass,
  }
}

export function combineThemeClasses(baseClasses: string, themeClasses: string) {
  return cn(baseClasses, themeClasses)
}
