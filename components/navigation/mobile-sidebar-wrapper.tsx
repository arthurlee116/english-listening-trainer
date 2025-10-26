'use client'

/**
 * Mobile Sidebar Wrapper
 * 
 * Provides mobile sidebar with overlay and hamburger menu trigger.
 * This component should be included in the main layout for mobile support.
 */

import React from 'react'
import { Sidebar } from './sidebar'
import { SidebarOverlay } from './sidebar-overlay'
import { SidebarToggle } from './sidebar-toggle'
import { useSidebar } from './sidebar-context'
import type { NavigationAction } from '@/lib/types'

interface MobileSidebarWrapperProps {
  /**
   * Current active step/page
   */
  currentStep?: string
  
  /**
   * Callback when a navigation item is clicked
   */
  onNavigate: (action: NavigationAction) => void
  
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
}

export function MobileSidebarWrapper({
  currentStep,
  onNavigate,
  assessmentResult,
}: MobileSidebarWrapperProps) {
  const { mobileOpen, toggleMobileOpen, setMobileOpen } = useSidebar()
  
  const handleNavigate = (action: NavigationAction) => {
    // Close mobile sidebar after navigation
    setMobileOpen(false)
    onNavigate(action)
  }
  
  return (
    <>
      {/* Hamburger Menu Toggle (visible only on mobile) */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <SidebarToggle
          collapsed={!mobileOpen}
          onToggle={toggleMobileOpen}
          isMobile={true}
        />
      </div>
      
      {/* Overlay */}
      <SidebarOverlay
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      
      {/* Mobile Sidebar */}
      {mobileOpen && (
        <Sidebar
          collapsed={false}
          currentStep={currentStep}
          onNavigate={handleNavigate}
          variant="mobile"
          assessmentResult={assessmentResult}
        />
      )}
    </>
  )
}
