'use client'

/**
 * Sidebar Overlay Component
 * 
 * Renders a translucent backdrop for mobile sidebar.
 * Clicking the overlay closes the sidebar.
 * Only rendered on small screens when the sidebar is open.
 */

import React, { useEffect } from 'react'
import { useBilingualText } from '@/hooks/use-bilingual-text'

interface SidebarOverlayProps {
  /**
   * Whether the overlay is currently visible
   */
  isOpen: boolean
  
  /**
   * Callback when the overlay is clicked (to close sidebar)
   */
  onClose: () => void
  
  /**
   * Additional CSS classes
   */
  className?: string
}

export function SidebarOverlay({
  isOpen,
  onClose,
  className = '',
}: SidebarOverlayProps) {
  const { t } = useBilingualText()
  
  // Handle Escape key to close overlay
  useEffect(() => {
    if (!isOpen) return
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])
  
  // Don't render if not open
  if (!isOpen) return null
  
  return (
    <div
      className={`
        fixed
        inset-0
        bg-foreground/30
        backdrop-blur-md
        z-30
        md:hidden
        animate-overlay-fade-in
        sidebar-overlay
        ${className}
      `}
      onClick={onClose}
      onTouchEnd={onClose}
      aria-label={t('navigation.overlayAriaLabel')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <span className="sr-only">
        {t('navigation.closeSidebar')}
      </span>
    </div>
  )
}
