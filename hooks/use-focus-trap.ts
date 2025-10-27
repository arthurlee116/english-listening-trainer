'use client'

import { MutableRefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface FocusTrapOptions {
  /**
   * The container whose focusable descendants should be trapped.
   */
  containerRef: MutableRefObject<HTMLElement | null>
  /**
   * Whether the focus trap is active.
   */
  active: boolean
  /**
   * Ref for the element that should regain focus when the trap deactivates.
   */
  returnFocusRef?: MutableRefObject<HTMLElement | null> | null
  /**
   * When true, focus will be put on the container if no focusable children are found.
   */
  fallbackToContainer?: boolean
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  ).filter((el) => {
    const isDisabled =
      el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true'
    const rect = el.getBoundingClientRect()
    const isVisible = rect.width > 0 || rect.height > 0
    return !isDisabled && isVisible
  })
}

export function useFocusTrap({
  containerRef,
  active,
  returnFocusRef,
  fallbackToContainer = true,
}: FocusTrapOptions) {
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) {
      return
    }

    if (typeof document === 'undefined') {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null

    const focusables = getFocusableElements(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    } else if (fallbackToContainer) {
      container.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return
      }

      const currentFocusables = getFocusableElements(container)
      if (currentFocusables.length === 0) {
        event.preventDefault()
        if (fallbackToContainer) {
          container.focus()
        }
        return
      }

      const firstElement = currentFocusables[0]
      const lastElement = currentFocusables[currentFocusables.length - 1]
      const isShiftPressed = event.shiftKey
      const activeElement = document.activeElement as HTMLElement | null

      if (!isShiftPressed && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      } else if (isShiftPressed && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!container.contains(event.target as Node)) {
        const focusablesInside = getFocusableElements(container)
        if (focusablesInside.length > 0) {
          focusablesInside[0].focus()
        } else if (fallbackToContainer) {
          container.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', handleFocusIn)

      const returnTarget =
        returnFocusRef?.current ?? previouslyFocusedElement.current

      if (returnTarget && typeof returnTarget.focus === 'function') {
        returnTarget.focus()
      }
    }
  }, [active, containerRef, fallbackToContainer, returnFocusRef])
}
