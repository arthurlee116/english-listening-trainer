/**
 * Navigation System Entry Point
 * 
 * This module exports all navigation-related utilities and configurations.
 */

export {
  NAVIGATION_ITEMS,
  USER_MENU_ITEMS,
  NAVIGATION_SECTIONS,
  NAVIGATION_ICONS,
  filterNavigationItems,
  getNavigationItemById,
} from "./config"

export type {
  NavigationItem,
  NavigationAction,
  NavigationActionType,
  SetStateAction,
  CallbackAction,
  ExternalAction,
  NavigationSection,
} from "@/lib/types"
