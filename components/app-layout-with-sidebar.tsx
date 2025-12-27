'use client'

/**
 * App Layout with Sidebar
 * 
 * This component wraps the main application content with the sidebar navigation.
 * It provides the flex layout structure for desktop sidebar + main content area.
 */

import React from 'react'
import { Sidebar } from '@/components/navigation/sidebar'
import { SidebarToggle } from '@/components/navigation/sidebar-toggle'
import { useSidebar } from '@/components/navigation/sidebar-context'
import type { NavigationAction } from '@/lib/types'

interface AppLayoutWithSidebarProps {
  children: React.ReactNode
  /**
   * Callback when a navigation action is triggered from the sidebar
   */
  onNavigate?: (action: NavigationAction) => void
  /**
   * Current active step/page (for highlighting active nav item)
   */
  currentStep?: string
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

export function AppLayoutWithSidebar({
  children,
  onNavigate,
  currentStep,
  assessmentResult,
}: AppLayoutWithSidebarProps) {
  const { collapsed, toggleCollapsed } = useSidebar()

  const handleNavigate = (action: NavigationAction) => {
    if (onNavigate) {
      onNavigate(action)
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex relative">
        <Sidebar
          collapsed={collapsed}
          currentStep={currentStep}
          onNavigate={handleNavigate}
          variant="desktop"
          assessmentResult={assessmentResult}
        />
        <SidebarToggle
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
