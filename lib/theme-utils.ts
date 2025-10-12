import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export const themeClasses = {
  background: {
    app: 'bg-background',
    panel: 'bg-background-panel',
    subtle: 'bg-background-subtle',
    content: 'bg-background-content',
  },
  text: {
    primary: 'text-foreground',
    secondary: 'text-foreground-secondary',
    tertiary: 'text-foreground-tertiary',
    muted: 'text-foreground-muted',
  },
  border: {
    default: 'border-border',
    subtle: 'border-border-subtle',
    emphasis: 'border-border-emphasis',
  },
  button: {
    primary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
    secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
    outline: 'border border-slate-600 text-slate-100 hover:bg-slate-800/60',
    ghost: 'text-slate-100 hover:bg-slate-800/60',
    destructive: 'bg-rose-700 text-rose-50 hover:bg-rose-600',
  },
  surface: {
    glass: 'glass-effect',
  },
  icon: {
    primary: 'text-slate-100',
    secondary: 'text-slate-300',
    tertiary: 'text-slate-500',
    interactive: 'text-slate-300 hover:text-white transition-colors',
    nav: 'text-slate-300 hover:text-white transition-colors',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-rose-400',
    info: 'text-sky-400',
  },
} as const

export function getThemeClass(
  component: keyof typeof themeClasses,
  variant: string,
  additionalClasses?: string,
): string {
  const componentClasses = themeClasses[component] as Record<string, string>
  const themeClass = componentClasses[variant] || ''

  return cn(themeClass, additionalClasses)
}

export function createThemeClass(
  darkClass: string,
  baseClasses?: string,
): string {
  return cn(baseClasses, darkClass)
}

export const cssVars = {
  background: 'var(--background)',
  backgroundSubtle: 'var(--background-subtle)',
  backgroundPanel: 'var(--background-panel)',
  foreground: 'var(--foreground)',
  foregroundSecondary: 'var(--foreground-secondary)',
  foregroundTertiary: 'var(--foreground-tertiary)',
  foregroundMuted: 'var(--foreground-muted)',
  primary: 'var(--primary)',
  primaryForeground: 'var(--primary-foreground)',
  secondary: 'var(--secondary)',
  secondaryForeground: 'var(--secondary-foreground)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  accent: 'var(--accent)',
  accentForeground: 'var(--accent-foreground)',
  destructive: 'var(--destructive)',
  destructiveForeground: 'var(--destructive-foreground)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  borderEmphasis: 'var(--border-emphasis)',
  input: 'var(--input)',
  ring: 'var(--ring)',
  radius: 'var(--radius)',
} as const

export function createCSSVarStyles(
  properties: Record<string, keyof typeof cssVars>,
): CSSProperties {
  const styles: CSSProperties = {}

  Object.entries(properties).forEach(([cssProp, varName]) => {
    const cssVar = cssVars[varName]
    if (cssVar) {
      styles[cssProp as any] = `hsl(${cssVar})`
    }
  })

  return styles
}

export const themeComponents = {
  button: (
    variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive',
    size: 'sm' | 'md' | 'lg' = 'md',
  ) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

    const sizeClasses = {
      sm: 'h-9 rounded-md px-3 text-sm',
      md: 'h-10 px-4 py-2 text-sm',
      lg: 'h-11 rounded-md px-8 text-base',
    }

    const variantClasses = {
      primary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
      secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
      outline: 'border border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800/60',
      ghost: 'text-slate-100 hover:bg-slate-800/60',
      destructive: 'bg-rose-700 text-rose-50 hover:bg-rose-600',
    }

    return cn(baseClasses, variantClasses[variant], sizeClasses[size])
  },
  card: (variant: 'default' | 'glass' = 'default') => {
    const baseClasses = 'rounded-lg border shadow-sm'

    const variantClasses = {
      default: 'bg-card text-card-foreground border-border',
      glass: 'glass-effect',
    }

    return cn(baseClasses, variantClasses[variant])
  },
  text: (
    level: 'primary' | 'secondary' | 'tertiary' | 'muted',
    size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' = 'base',
  ) => {
    const levelClasses = {
      primary: 'text-slate-100',
      secondary: 'text-slate-300',
      tertiary: 'text-slate-400',
      muted: 'text-slate-500',
    }

    const sizeClasses = {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
    }

    return cn(levelClasses[level], sizeClasses[size])
  },
}

export const responsiveTheme = {
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
      classes.wide && `xl:${classes.wide}`,
    )
  },
  viewport: (viewport: '768px' | '1024px' | '1280px' | '1440px') => {
    const viewportClasses = {
      '768px': 'max-w-3xl mx-auto px-4',
      '1024px': 'max-w-5xl mx-auto px-6',
      '1280px': 'max-w-6xl mx-auto px-8',
      '1440px': 'max-w-7xl mx-auto px-8',
    }

    return viewportClasses[viewport]
  },
}

export const a11yTheme = {
  focus: (variant: 'default' | 'primary' | 'destructive' = 'default') => {
    const baseClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

    const variantClasses = {
      default: 'focus-visible:ring-ring',
      primary: 'focus-visible:ring-primary',
      destructive: 'focus-visible:ring-destructive',
    }

    return cn(baseClasses, variantClasses[variant])
  },
  highContrast: (element: 'text' | 'border' | 'background') => {
    const contrastClasses = {
      text: 'text-foreground dark:text-foreground',
      border: 'border-border dark:border-border',
      background: 'bg-background dark:bg-background',
    }

    return contrastClasses[element]
  },
}
