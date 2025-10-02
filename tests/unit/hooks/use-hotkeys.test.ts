import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { mockStorage } from '../../helpers/storage-mock'
import {
  useHotkeys,
  useShortcutSettings,
  useSimpleHotkey
} from '../../../hooks/use-hotkeys'
import { SHORTCUTS_STORAGE_KEYS } from '../../../lib/shortcuts'

// Mock the shortcuts module
vi.mock('../../../lib/shortcuts', async () => {
  const actual = await vi.importActual('../../../lib/shortcuts')
  return {
    ...actual,
    SHORTCUTS: [
      {
        id: 'play-pause',
        action: 'play-pause',
        key: ' ',
        modifiers: [],
        descriptionKey: 'shortcuts.playPause',
        availableInSteps: ['listening', 'questions'],
        requiresAudio: true,
        preventDefault: true
      },
      {
        id: 'open-history',
        action: 'open-history',
        key: 'h',
        modifiers: ['shift'],
        descriptionKey: 'shortcuts.openHistory',
        availableInSteps: ['setup', 'results'],
        preventDefault: true
      },
      {
        id: 'close-dialog',
        action: 'close-dialog',
        key: 'Escape',
        modifiers: [],
        descriptionKey: 'shortcuts.closeDialog',
        preventDefault: false
      }
    ]
  }
})

describe('useHotkeys Hook', () => {
  beforeEach(() => {
    mockStorage()
    vi.clearAllMocks()
    
    // Mock document.addEventListener and removeEventListener
    vi.spyOn(document, 'addEventListener')
    vi.spyOn(document, 'removeEventListener')
    

  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('keyboard event listener registration and cleanup', () => {
    it('should register keyboard event listener when enabled', () => {
      const { unmount } = renderHook(() => useHotkeys({ enabled: true }))

      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )

      unmount()

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )
    })

    it('should not register event listener when disabled', () => {
      renderHook(() => useHotkeys({ enabled: false }))

      expect(document.addEventListener).not.toHaveBeenCalled()
    })

    it('should not register event listener when globally disabled', () => {
      localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ENABLED, 'false')

      renderHook(() => useHotkeys({ enabled: true }))

      expect(document.addEventListener).not.toHaveBeenCalled()
    })

    it('should cleanup event listener on unmount', () => {
      const { unmount } = renderHook(() => useHotkeys({ enabled: true }))

      unmount()

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )
    })
  })

  describe('localStorage synchronization and cross-tab communication', () => {
    it('should initialize with localStorage value', () => {
      localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ENABLED, 'false')

      const { result } = renderHook(() => useHotkeys())

      expect(result.current.enabled).toBe(false)
    })

    it('should respond to storage events for cross-tab communication', () => {
      const { result } = renderHook(() => useHotkeys())

      expect(result.current.enabled).toBe(true)

      // Simulate storage event from another tab
      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: SHORTCUTS_STORAGE_KEYS.ENABLED,
          newValue: 'false',
          oldValue: 'true'
        })
        window.dispatchEvent(storageEvent)
      })

      expect(result.current.enabled).toBe(false)
    })

    it('should respond to custom settings changed events', () => {
      const { result } = renderHook(() => useHotkeys())

      expect(result.current.enabled).toBe(true)

      // Simulate custom event for immediate UI updates
      act(() => {
        const customEvent = new CustomEvent('shortcut-settings-changed', {
          detail: { enabled: false }
        })
        window.dispatchEvent(customEvent)
      })

      expect(result.current.enabled).toBe(false)
    })

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ENABLED, 'invalid-json')

      const { result } = renderHook(() => useHotkeys())

      expect(result.current.enabled).toBe(true) // Should default to true
    })
  })

  describe('shortcut filtering based on current step and context', () => {
    it('should filter shortcuts based on current step', () => {
      const { result } = renderHook(() => 
        useHotkeys({ currentStep: 'setup' })
      )

      const availableShortcuts = result.current.availableShortcuts

      // Should include shortcuts available in 'setup' step
      expect(availableShortcuts.some(s => s.id === 'open-history')).toBe(true)
      // Should not include shortcuts not available in 'setup' step
      expect(availableShortcuts.some(s => s.id === 'play-pause')).toBe(false)
    })

    it('should filter shortcuts based on audio availability', () => {
      const { result } = renderHook(() => 
        useHotkeys({ 
          currentStep: 'listening',
          hasAudio: false 
        })
      )

      const availableShortcuts = result.current.availableShortcuts

      // Should not include shortcuts that require audio when hasAudio is false
      expect(availableShortcuts.some(s => s.id === 'play-pause')).toBe(false)
    })

    it('should include shortcuts that require audio when hasAudio is true', () => {
      const { result } = renderHook(() => 
        useHotkeys({ 
          currentStep: 'listening',
          hasAudio: true 
        })
      )

      const availableShortcuts = result.current.availableShortcuts

      // Should include shortcuts that require audio when hasAudio is true
      expect(availableShortcuts.some(s => s.id === 'play-pause')).toBe(true)
    })

    it('should include shortcuts without step restrictions', () => {
      const { result } = renderHook(() => 
        useHotkeys({ currentStep: 'any-step' })
      )

      const availableShortcuts = result.current.availableShortcuts

      // Should include shortcuts without step restrictions (like close-dialog)
      expect(availableShortcuts.some(s => s.id === 'close-dialog')).toBe(true)
    })
  })

  describe('global enable/disable functionality with immediate UI updates', () => {
    it('should update enabled state immediately when settings change', () => {
      const { result } = renderHook(() => useHotkeys())

      expect(result.current.enabled).toBe(true)

      // Simulate immediate settings change
      act(() => {
        const event = new CustomEvent('shortcut-settings-changed', {
          detail: { enabled: false }
        })
        window.dispatchEvent(event)
      })

      expect(result.current.enabled).toBe(false)
    })

    it('should handle malformed custom events gracefully', () => {
      const { result } = renderHook(() => useHotkeys())

      expect(result.current.enabled).toBe(true)

      // Simulate malformed custom event
      act(() => {
        const event = new CustomEvent('shortcut-settings-changed', {
          detail: { invalid: 'data' }
        })
        window.dispatchEvent(event)
      })

      // Should remain unchanged
      expect(result.current.enabled).toBe(true)
    })
  })

  describe('shortcut handler execution', () => {
    it('should call onShortcut handler when valid shortcut is pressed', () => {
      const mockHandler = vi.fn()
      
      renderHook(() => useHotkeys({
        enabled: true,
        currentStep: 'setup',
        onShortcut: mockHandler
      }))

      // Simulate Shift+H keypress (open-history shortcut)
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'h',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalledWith(
        'open-history',
        expect.objectContaining({
          id: 'open-history',
          action: 'open-history'
        })
      )
    })

    it('should not call handler when shortcut is not available in current context', () => {
      const mockHandler = vi.fn()
      
      renderHook(() => useHotkeys({
        enabled: true,
        currentStep: 'setup', // play-pause not available in setup
        hasAudio: true,
        onShortcut: mockHandler
      }))

      // Simulate Space keypress (play-pause shortcut)
      const keyEvent = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space'
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should not call handler when disabled', () => {
      const mockHandler = vi.fn()
      
      renderHook(() => useHotkeys({
        enabled: false,
        currentStep: 'setup',
        onShortcut: mockHandler
      }))

      // Simulate Shift+H keypress
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'h',
        shiftKey: true
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).not.toHaveBeenCalled()
    })
  }) 
 describe('input element exclusion', () => {
    it('should not trigger shortcuts when focused on input elements', () => {
      const mockHandler = vi.fn()
      
      renderHook(() => useHotkeys({
        enabled: true,
        currentStep: 'setup',
        excludeInputs: true,
        onShortcut: mockHandler
      }))

      // Mock an input element as the event target
      const inputElement = document.createElement('input')
      document.body.appendChild(inputElement)

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'h',
        shiftKey: true
      })
      
      // Mock the event target
      Object.defineProperty(keyEvent, 'target', {
        value: inputElement,
        writable: false
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).not.toHaveBeenCalled()

      document.body.removeChild(inputElement)
    })

    it('should trigger Escape shortcut even when focused on input elements', () => {
      const mockHandler = vi.fn()
      
      renderHook(() => useHotkeys({
        enabled: true,
        excludeInputs: true,
        onShortcut: mockHandler
      }))

      // Mock an input element as the event target
      const inputElement = document.createElement('input')
      document.body.appendChild(inputElement)

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Escape'
      })
      
      // Mock the event target
      Object.defineProperty(keyEvent, 'target', {
        value: inputElement,
        writable: false
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalledWith(
        'close-dialog',
        expect.objectContaining({
          id: 'close-dialog',
          action: 'close-dialog'
        })
      )

      document.body.removeChild(inputElement)
    })

    it('should allow shortcuts when excludeInputs is false', () => {
      const mockHandler = vi.fn()
      
      renderHook(() => useHotkeys({
        enabled: true,
        currentStep: 'setup',
        excludeInputs: false,
        onShortcut: mockHandler
      }))

      // Mock an input element as the event target
      const inputElement = document.createElement('input')
      document.body.appendChild(inputElement)

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'h',
        shiftKey: true
      })
      
      // Mock the event target
      Object.defineProperty(keyEvent, 'target', {
        value: inputElement,
        writable: false
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalled()

      document.body.removeChild(inputElement)
    })
  })
})

describe('useShortcutSettings Hook', () => {
  beforeEach(() => {
    mockStorage()
    vi.clearAllMocks()
  })

  describe('settings management', () => {
    it('should initialize with localStorage values', () => {
      localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ENABLED, 'false')
      localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ONBOARDED, 'true')

      const { result } = renderHook(() => useShortcutSettings())

      expect(result.current.enabled).toBe(false)
      expect(result.current.onboarded).toBe(true)
    })

    it('should use default values when localStorage is empty', () => {
      const { result } = renderHook(() => useShortcutSettings())

      expect(result.current.enabled).toBe(true)
      expect(result.current.onboarded).toBe(false)
    })

    it('should update enabled setting and trigger events', () => {
      const { result } = renderHook(() => useShortcutSettings())

      const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent')

      act(() => {
        result.current.setEnabled(false)
      })

      expect(result.current.enabled).toBe(false)
      expect(localStorage.getItem(SHORTCUTS_STORAGE_KEYS.ENABLED)).toBe('false')
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'shortcut-settings-changed',
          detail: { enabled: false }
        })
      )
    })

    it('should update onboarded setting', () => {
      const { result } = renderHook(() => useShortcutSettings())

      act(() => {
        result.current.setOnboarded(true)
      })

      expect(result.current.onboarded).toBe(true)
      expect(localStorage.getItem(SHORTCUTS_STORAGE_KEYS.ONBOARDED)).toBe('true')
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      const { result } = renderHook(() => useShortcutSettings())

      act(() => {
        result.current.setEnabled(false)
      })

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save shortcut settings:', expect.any(Error))

      consoleSpy.mockRestore()
      setItemSpy.mockRestore()
    })
  })
})

describe('useSimpleHotkey Hook', () => {
  beforeEach(() => {
    mockStorage()
    vi.clearAllMocks()
    
    // Mock document.addEventListener and removeEventListener
    vi.spyOn(document, 'addEventListener')
    vi.spyOn(document, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('simple shortcut handling', () => {
    it('should register and handle simple shortcuts', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey('Enter', [], mockHandler))

      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )

      // Simulate Enter keypress
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter'
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should handle shortcuts with modifiers', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey('s', ['ctrl'], mockHandler))

      // Simulate Ctrl+S keypress
      const keyEvent = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should not trigger without correct modifiers', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey('s', ['ctrl'], mockHandler))

      // Simulate S keypress without Ctrl
      const keyEvent = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: false
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should handle space key correctly', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey(' ', [], mockHandler))

      // Simulate Space keypress
      const keyEvent = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space'
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalled()
    })

    it('should respect enabled option', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey('Enter', [], mockHandler, { enabled: false }))

      // Simulate Enter keypress
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter'
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).not.toHaveBeenCalled()
    })

    it('should respect excludeInputs option', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey('Enter', [], mockHandler, { excludeInputs: true }))

      // Mock an input element as the event target
      const inputElement = document.createElement('input')
      document.body.appendChild(inputElement)

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter'
      })
      
      // Mock the event target
      Object.defineProperty(keyEvent, 'target', {
        value: inputElement,
        writable: false
      })

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).not.toHaveBeenCalled()

      document.body.removeChild(inputElement)
    })

    it('should prevent default when preventDefault is true', () => {
      const mockHandler = vi.fn()

      renderHook(() => useSimpleHotkey('Enter', [], mockHandler, { preventDefault: true }))

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter'
      })
      
      const preventDefaultSpy = vi.spyOn(keyEvent, 'preventDefault')
      const stopPropagationSpy = vi.spyOn(keyEvent, 'stopPropagation')

      act(() => {
        document.dispatchEvent(keyEvent)
      })

      expect(mockHandler).toHaveBeenCalled()
      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('should cleanup event listener on unmount', () => {
      const mockHandler = vi.fn()

      const { unmount } = renderHook(() => useSimpleHotkey('Enter', [], mockHandler))

      unmount()

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )
    })
  })
})