'use client'

/**
 * Mobile Sidebar Wrapper
 * 
 * Provides mobile sidebar with overlay and hamburger menu trigger.
 * This component should be included in the main layout for mobile support.
 */

import React, { useRef } from 'react'
import { Sidebar } from './sidebar'
import { SidebarOverlay } from './sidebar-overlay'
import { SidebarToggle } from './sidebar-toggle'
import { useSidebar } from './sidebar-context'
import type { NavigationAction } from '@/lib/types'
import { useFocusTrap } from '@/hooks/use-focus-trap'

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
  const sidebarRef = useRef<HTMLElement | null>(null)
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  
  useFocusTrap({
    containerRef: sidebarRef,
    active: mobileOpen,
    returnFocusRef: toggleButtonRef,
  })
  
  const handleNavigate = (action: NavigationAction) => {
    // Close mobile sidebar after navigation
    setMobileOpen(false)
    onNavigate(action)
  }
  
  return (
    <>
      {/* Hamburger Menu Toggle (visible only on mobile) */}
      <div
        className="md:hidden fixed z-50"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          left: 'calc(env(safe-area-inset-left, 0px) + 1rem)',
        }}
      >
        <SidebarToggle
          collapsed={!mobileOpen}
          onToggle={toggleMobileOpen}
          isMobile={true}
          ref={toggleButtonRef}
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
          ref={sidebarRef}
        />
      )}
    </>
  )
}
