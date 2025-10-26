'use client'

import React, { useState, useEffect } from 'react'
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

export function SidebarToggle({
  collapsed,
  onToggle,
  isMobile = false,
  className = '',
}: SidebarToggleProps) {
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
          h-10
          w-10
          text-sky-400
          hover:bg-slate-800/60
          ${className}
        `}
        onClick={onToggle}
        aria-label={t('navigation.toggleSidebar')}
        aria-expanded={!collapsed}
        aria-controls="main-sidebar"
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
        bg-slate-800
        border
        border-slate-700
        hover:bg-slate-700
        text-sky-400
        ${className}
      `}
      onClick={onToggle}
      aria-label={collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
      aria-expanded={!collapsed}
      aria-controls="main-sidebar"
      aria-pressed={!collapsed}
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
}
