/**
 * Navigation Configuration
 * 
 * This file defines the shared navigation structure for the sidebar layout.
 * All navigation items are centralized here for consistency across components.
 * 
 * @see lib/types.ts for NavigationItem type definitions
 * @see lib/i18n/translations/components.json for translation keys
 */

import type { LucideIcon } from "lucide-react"
import {
  Sparkles,
  History,
  Book,
  Settings,
  LogOut,
  User,
  Globe,
} from "lucide-react"
import type { NavigationItem } from "@/lib/types"

/**
 * Main navigation items configuration
 * 
 * Each item represents a primary action or page in the application.
 * Items are rendered in the order they appear in this array.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: "practice",
    translationKey: "navigation.practice",
    icon: Sparkles,
    action: {
      type: "setState",
      targetState: "setup",
    },
    requiresAuth: false,
    adminOnly: false,
  },
  {
    id: "assessment",
    translationKey: "navigation.assessment",
    icon: Sparkles,
    action: {
      type: "setState",
      targetState: "assessment",
    },
    requiresAuth: false,
    adminOnly: false,
  },
  {
    id: "history",
    translationKey: "navigation.practiceHistory",
    icon: History,
    action: {
      type: "setState",
      targetState: "history",
    },
    requiresAuth: false,
    adminOnly: false,
  },
  {
    id: "wrong-answers",
    translationKey: "navigation.wrongAnswers",
    icon: Book,
    action: {
      type: "setState",
      targetState: "wrong-answers",
    },
    requiresAuth: false,
    adminOnly: false,
  },
]

/**
 * User menu navigation items
 * 
 * These items are typically shown in a separate section for user-specific actions.
 * Includes admin-only and authenticated-only items.
 */
export const USER_MENU_ITEMS: NavigationItem[] = [
  {
    id: "language",
    translationKey: "navigation.language",
    icon: Globe,
    action: {
      type: "callback",
      callbackName: "handleLanguageSwitch",
    },
    requiresAuth: false,
    adminOnly: false,
  },
  {
    id: "admin",
    translationKey: "navigation.admin",
    icon: Settings,
    action: {
      type: "external",
      href: "/admin",
      openInNewTab: true,
    },
    requiresAuth: true,
    adminOnly: true,
  },
  {
    id: "logout",
    translationKey: "navigation.logout",
    icon: LogOut,
    action: {
      type: "callback",
      callbackName: "handleLogout",
    },
    requiresAuth: true,
    adminOnly: false,
  },
]

/**
 * Navigation sections for organized display
 * 
 * Groups navigation items into logical sections for better UX.
 */
export const NAVIGATION_SECTIONS = [
  {
    id: "main",
    labelKey: "navigation.mainSection",
    items: NAVIGATION_ITEMS,
  },
  {
    id: "user",
    labelKey: "navigation.userSection",
    items: USER_MENU_ITEMS,
  },
] as const

/**
 * Icon map for quick lookup
 * 
 * Useful for components that need to render icons dynamically.
 */
export const NAVIGATION_ICONS: Record<string, LucideIcon> = {
  assessment: Sparkles,
  history: History,
  wrongAnswers: Book,
  admin: Settings,
  logout: LogOut,
  user: User,
  language: Globe,
} as const

/**
 * Helper function to filter navigation items based on user state
 * 
 * @param items - Array of navigation items to filter
 * @param isAuthenticated - Whether the user is authenticated
 * @param isAdmin - Whether the user is an admin
 * @returns Filtered array of navigation items
 */
export function filterNavigationItems(
  items: NavigationItem[],
  isAuthenticated: boolean,
  isAdmin: boolean
): NavigationItem[] {
  return items.filter((item) => {
    // Filter out items that require auth when user is not authenticated
    if (item.requiresAuth && !isAuthenticated) {
      return false
    }
    
    // Filter out admin-only items when user is not an admin
    if (item.adminOnly && !isAdmin) {
      return false
    }
    
    return true
  })
}

/**
 * Helper function to get navigation item by id
 * 
 * @param id - Navigation item id
 * @returns Navigation item or undefined if not found
 */
export function getNavigationItemById(id: string): NavigationItem | undefined {
  const allItems = [...NAVIGATION_ITEMS, ...USER_MENU_ITEMS]
  return allItems.find((item) => item.id === id)
}
