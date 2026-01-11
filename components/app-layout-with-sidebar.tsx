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
    <div className="relative min-h-screen flex overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 -left-24 h-72 w-72 rounded-full bg-[hsl(var(--primary)/0.18)] blur-3xl" />
        <div className="absolute top-24 -right-28 h-96 w-96 rounded-full bg-[hsl(var(--accent)/0.35)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[hsl(var(--secondary)/0.5)] blur-3xl" />
      </div>
      {/* Desktop Sidebar */}
      <div className="relative z-10 hidden md:flex">
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
      <main className="relative z-10 flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
