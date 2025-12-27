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
  primary: 'text-slate-900',
  secondary: 'text-slate-700',
  tertiary: 'text-slate-600',
  muted: 'text-slate-500',
}

const iconPalette: Record<IconType, string> = {
  primary: 'text-slate-900',
  secondary: 'text-slate-700',
  tertiary: 'text-slate-500',
  interactive: 'text-slate-600 transition-colors hover:text-slate-900',
  nav: 'text-slate-600 transition-colors hover:text-slate-900',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  error: 'text-rose-600',
  info: 'text-sky-600',
  loading: 'text-sky-600',
}

const borderPalette: Record<Emphasis, string> = {
  default: 'border-slate-200',
  emphasis: 'border-slate-300',
  strong: 'border-slate-400',
}

const separatorPalette: Record<Emphasis, string> = {
  default: 'border-slate-200',
  emphasis: 'border-slate-300',
  strong: 'border-slate-400',
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
