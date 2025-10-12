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
  primary: 'text-slate-100',
  secondary: 'text-slate-300',
  tertiary: 'text-slate-400',
  muted: 'text-slate-500',
}

const iconPalette: Record<IconType, string> = {
  primary: 'text-slate-100',
  secondary: 'text-slate-300',
  tertiary: 'text-slate-500',
  interactive: 'text-slate-300 transition-colors hover:text-white',
  nav: 'text-slate-300 transition-colors hover:text-white',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
  info: 'text-sky-400',
  loading: 'text-sky-400',
}

const borderPalette: Record<Emphasis, string> = {
  default: 'border-slate-700',
  emphasis: 'border-slate-500',
  strong: 'border-slate-400',
}

const separatorPalette: Record<Emphasis, string> = {
  default: 'border-slate-800',
  emphasis: 'border-slate-700',
  strong: 'border-slate-600',
}

export function useThemeClasses() {
  const themeClass = (_lightClass: string, darkClass?: string) => darkClass ?? ''

  const textClass = (level: TextLevel) => textPalette[level]

  const iconClass = (type: IconType) => iconPalette[type]

  const borderClass = (emphasis: Emphasis = 'default') => borderPalette[emphasis]

  const separatorClass = (emphasis: Emphasis = 'default') => separatorPalette[emphasis]

  return {
    isLight: false,
    isDark: true,
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
