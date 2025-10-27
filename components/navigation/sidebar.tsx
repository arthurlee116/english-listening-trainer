'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { useAuthState } from '@/hooks/use-auth-state'
import { useLanguage } from '@/components/providers/language-provider'
import { 
  NAVIGATION_SECTIONS, 
  filterNavigationItems 
} from '@/lib/navigation/config'
import type { NavigationItem, NavigationAction } from '@/lib/types'
import { User } from 'lucide-react'

export interface SidebarProps {
  /**
   * Whether the sidebar is collapsed
   */
  collapsed: boolean
  
  /**
   * Current active step/page
   */
  currentStep?: string
  
  /**
   * Callback when a navigation item is clicked
   */
  onNavigate: (action: NavigationAction) => void
  
  /**
   * Variant for different rendering contexts
   */
  variant?: 'desktop' | 'mobile'
  
  /**
   * Additional CSS classes
   */
  className?: string
  
  /**
   * User assessment result for personalized difficulty display
   */
  assessmentResult?: {
    difficultyRange: {
      min: number
      max: number
      name: string
      nameEn: string
    }
  } | null
  
  /**
   * Callback for language switch
   */
  onLanguageSwitch?: () => void
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>((
  {
    collapsed,
    currentStep,
    onNavigate,
    variant = 'desktop',
    className = '',
    assessmentResult,
    onLanguageSwitch,
  },
  ref,
) => {
  const { user, isAuthenticated } = useAuthState()
  const { t } = useBilingualText()
  const { currentLanguage, switchLanguage } = useLanguage()
  
  const isMobile = variant === 'mobile'
  
  // Track animation state for elastic effect
  const [animationClass, setAnimationClass] = useState<string>('')
  
  useEffect(() => {
    if (isMobile) {
      // Mobile uses translateX animation
      setAnimationClass('animate-sidebar-expand')
    } else {
      // Desktop uses width animation
      setAnimationClass(
        collapsed ? 'animate-sidebar-width-collapse' : 'animate-sidebar-width-expand'
      )
    }
  }, [collapsed, isMobile])
  
  // Filter navigation items based on auth state
  const filteredSections = NAVIGATION_SECTIONS.map(section => ({
    ...section,
    items: filterNavigationItems(
      section.items,
      isAuthenticated,
      user?.isAdmin || false
    ),
  }))
  
  const handleItemClick = (item: NavigationItem) => {
    // Special handling for language switch
    if (item.id === 'language') {
      const newLang = currentLanguage === 'zh' ? 'en' : 'zh'
      switchLanguage(newLang)
      onLanguageSwitch?.()
      return
    }
    
    onNavigate(item.action)
  }
  
  // Determine sidebar width classes (base state, animation overrides)
  const widthClass = collapsed 
    ? 'w-16' 
    : isMobile 
      ? 'w-64' 
      : 'w-64'
  
  const safeAreaStyles = isMobile
    ? {
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(env(safe-area-inset-right, 0px))',
      }
    : undefined

  return (
    <aside
      id="main-sidebar"
      ref={ref}
      className={`
        ${widthClass}
        ${animationClass}
        flex
        flex-col
        bg-slate-900/50
        backdrop-blur
        border-r
        border-slate-700
        ${isMobile ? 'fixed inset-y-0 left-0 z-40' : 'relative'}
        ${className}
        sidebar-surface
      `}
      aria-label={t('navigation.sidebarAriaLabel')}
      role={isMobile ? 'dialog' : undefined}
      aria-modal={isMobile ? 'true' : undefined}
      tabIndex={isMobile ? -1 : undefined}
      style={safeAreaStyles}
    >
      {/* User Info Section (if authenticated) */}
      {isAuthenticated && user && !collapsed && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-slate-900/60 text-sky-400 border-slate-700">
              <User className="mr-1 h-3 w-3" />
              <span className="truncate max-w-[150px]">
                {user.name || user.email}
              </span>
            </Badge>
            {user.isAdmin && (
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
          
          {/* Personalized Difficulty Display */}
          {assessmentResult && (
            <div className="text-xs text-slate-400">
              <span className="text-sky-400">
                {t('labels.personalizedDifficulty')}:
              </span>{' '}
              {assessmentResult.difficultyRange.min}-{assessmentResult.difficultyRange.max}
            </div>
          )}
        </div>
      )}
      
      {/* User Icon Only (collapsed state) */}
      {isAuthenticated && user && collapsed && (
        <div className="p-4 border-b border-slate-700 flex justify-center">
          <User className="h-5 w-5 text-sky-400" />
        </div>
      )}
      
      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-4">
        {filteredSections.map((section) => {
          // Don't render empty sections
          if (section.items.length === 0) return null
          
          return (
            <div key={section.id} className="mb-6">
              {/* Section Label */}
              {!collapsed && (
                <h3 className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t(section.labelKey)}
                </h3>
              )}
              
              {/* Navigation Items */}
              <div className="space-y-1 px-2">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = currentStep === item.id || 
                    (item.action.type === 'setState' && item.action.targetState === currentStep)
                  
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      size={collapsed ? 'icon' : 'sm'}
                      className={`
                        w-full
                        sidebar-nav-button
                        ${collapsed ? 'justify-center' : 'justify-start'}
                        ${isActive 
                          ? 'bg-slate-800/80 text-sky-400' 
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-sky-400'
                        }
                      `}
                      onClick={() => handleItemClick(item)}
                      aria-label={collapsed ? t(item.translationKey) : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? t(item.translationKey) : undefined}
                    >
                      <Icon className={`h-4 w-4 ${collapsed ? '' : 'mr-2'}`} />
                      {!collapsed && (
                        <span className="truncate">
                          {t(item.translationKey)}
                        </span>
                      )}
                    </Button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
})

Sidebar.displayName = 'Sidebar'
