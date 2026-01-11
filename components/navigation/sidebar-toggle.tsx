'use client'

import React, { useState, useEffect, forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { useBilingualText } from '@/hooks/use-bilingual-text'

interface SidebarToggleProps {
  /**
   * Whether the sidebar is currently collapsed (desktop)
   */
  collapsed: boolean
  
  /**
   * Callback when the toggle button is clicked
   */
  onToggle: () => void
  
  /**
   * Whether this is for mobile (hamburger icon)
   */
  isMobile?: boolean
  
  /**
   * Additional CSS classes
   */
  className?: string
}

export const SidebarToggle = forwardRef<HTMLButtonElement, SidebarToggleProps>(function SidebarToggle(
  {
    collapsed,
    onToggle,
    isMobile = false,
    className = '',
  },
  ref,
) {
  const { t } = useBilingualText()
  const [isMobileView, setIsMobileView] = useState(false)
  
  useEffect(() => {
    // Detect mobile viewport
    const checkMobile = () => {
      setIsMobileView(window.matchMedia('(max-width: 768px)').matches)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])
  
  // Mobile uses hamburger menu, desktop uses chevrons
  if (isMobileView || isMobile) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`
          h-11
          w-11
          min-h-[44px]
          min-w-[44px]
          text-primary
          hover:bg-accent/80
          ${className}
          sidebar-toggle-button
        `}
        onClick={onToggle}
        aria-label={t('navigation.toggleSidebar')}
        aria-expanded={!collapsed}
        aria-controls="main-sidebar"
        aria-pressed={!collapsed}
        ref={ref}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">
          {t('navigation.toggleSidebar')}
        </span>
      </Button>
    )
  }
  
  // Desktop toggle button
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`
        absolute
        -right-3
        top-4
        z-50
        h-6
        w-6
        rounded-full
        bg-card/90
        border
        border-border/70
        hover:bg-card
        text-foreground
        ${className}
        sidebar-toggle-button
      `}
      onClick={onToggle}
      aria-label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
      aria-expanded={!collapsed}
      aria-controls="main-sidebar"
      aria-pressed={!collapsed}
      ref={ref}
    >
      {collapsed ? (
        <ChevronRight className="h-4 w-4" />
      ) : (
        <ChevronLeft className="h-4 w-4" />
      )}
      <span className="sr-only">
        {collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
      </span>
    </Button>
  )
})
