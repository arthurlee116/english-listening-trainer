'use client'

/**
 * Sidebar Layout Context
 * 
 * Provides shared state for sidebar collapse/expand across the application.
 * This context persists the sidebar state in localStorage for user preference.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface SidebarContextValue {
  /**
   * Whether the sidebar is currently collapsed (desktop)
   */
  collapsed: boolean
  
  /**
   * Toggle the sidebar collapsed state
   */
  toggleCollapsed: () => void
  
  /**
   * Set the sidebar collapsed state directly
   */
  setCollapsed: (collapsed: boolean) => void
  
  /**
   * Whether the mobile sidebar is currently open
   */
  mobileOpen: boolean
  
  /**
   * Toggle the mobile sidebar open state
   */
  toggleMobileOpen: () => void
  
  /**
   * Set the mobile sidebar open state directly
   */
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

const SIDEBAR_STORAGE_KEY = 'elt.sidebar.collapsed'

interface SidebarProviderProps {
  children: React.ReactNode
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  // Initialize from localStorage (default to false/expanded on first visit)
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }
    
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
      return stored === 'true'
    } catch {
      return false
    }
  })
  
  // Mobile sidebar state (always starts closed)
  const [mobileOpen, setMobileOpenState] = useState<boolean>(false)
  
  // Persist to localStorage whenever collapsed state changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    } catch (error) {
      console.warn('Failed to persist sidebar state:', error)
    }
  }, [collapsed])
  
  // Control body overflow when mobile sidebar is open
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])
  
  const toggleCollapsed = useCallback(() => {
    setCollapsedState(prev => !prev)
  }, [])
  
  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
  }, [])
  
  const toggleMobileOpen = useCallback(() => {
    setMobileOpenState(prev => !prev)
  }, [])
  
  const setMobileOpen = useCallback((value: boolean) => {
    setMobileOpenState(value)
  }, [])
  
  const value: SidebarContextValue = {
    collapsed,
    toggleCollapsed,
    setCollapsed,
    mobileOpen,
    toggleMobileOpen,
    setMobileOpen,
  }
  
  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  
  return context
}
