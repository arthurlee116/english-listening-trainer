/**
 * 快捷键管理 Hook
 * 提供全局快捷键监听、条件执行和生命周期管理
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { 
  SHORTCUTS, 
  SHORTCUTS_STORAGE_KEYS,
  type ShortcutAction,
  type ShortcutDefinition,
  matchesShortcut,
  isInInputElement,
  isShortcutAvailable
} from '@/lib/shortcuts'

// 快捷键处理器类型
export type ShortcutHandler = (action: ShortcutAction, shortcut: ShortcutDefinition) => void

// Hook 配置选项
export interface UseHotkeysOptions {
  enabled?: boolean
  currentStep?: string
  hasAudio?: boolean
  excludeInputs?: boolean
  onShortcut?: ShortcutHandler
}

// 快捷键状态
export interface HotkeysState {
  enabled: boolean
  availableShortcuts: ShortcutDefinition[]
}

/**
 * 快捷键管理 Hook
 */
export function useHotkeys(options: UseHotkeysOptions = {}): HotkeysState {
  const {
    enabled = true,
    currentStep = 'setup',
    hasAudio = false,
    excludeInputs = true,
    onShortcut
  } = options

  const handlerRef = useRef<ShortcutHandler | undefined>(onShortcut)
  handlerRef.current = onShortcut

  // 全局启用状态（使用state以便即时同步UI），初始值从localStorage加载
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEYS.ENABLED)
      return stored !== null ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  // 监听设置变化以实现即时同步（同页面自定义事件 + 跨标签storage事件）
  useEffect(() => {
    const handleSettingsChanged = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail || {}
        if (typeof detail.enabled === 'boolean') {
          setGlobalEnabled(detail.enabled)
        }
      } catch {
        // ignore
      }
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SHORTCUTS_STORAGE_KEYS.ENABLED && e.newValue != null) {
        try {
          setGlobalEnabled(JSON.parse(e.newValue))
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('shortcut-settings-changed', handleSettingsChanged as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('shortcut-settings-changed', handleSettingsChanged as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // 获取当前可用的快捷键
  const availableShortcuts = useCallback((): ShortcutDefinition[] => {
    return SHORTCUTS.filter(shortcut => 
      isShortcutAvailable(shortcut, currentStep, hasAudio)
    )
  }, [currentStep, hasAudio])

  // 快捷键事件处理器
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 检查是否启用
    if (!enabled || !globalEnabled) {
      return
    }

    // 检查是否在输入元素中（除了 Escape 键）
    if (excludeInputs && isInInputElement(event.target) && event.key !== 'Escape') {
      return
    }

    // 查找匹配的快捷键
    const matchedShortcut = SHORTCUTS.find(shortcut => 
      matchesShortcut(event, shortcut)
    )

    if (!matchedShortcut) {
      return
    }

    // 检查快捷键是否在当前步骤可用
    if (!isShortcutAvailable(matchedShortcut, currentStep, hasAudio)) {
      return
    }

    // 阻止默认行为（如果配置了）
    if (matchedShortcut.preventDefault) {
      event.preventDefault()
      event.stopPropagation()
    }

    // 调用处理器
    if (handlerRef.current) {
      handlerRef.current(matchedShortcut.action, matchedShortcut)
    }
  }, [enabled, excludeInputs, currentStep, hasAudio, globalEnabled])

  // 注册和清理事件监听器
  useEffect(() => {
    if (!enabled || !globalEnabled) {
      return
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleKeyDown, enabled, globalEnabled])

  return {
    enabled: enabled && globalEnabled,
    availableShortcuts: availableShortcuts()
  }
}

/**
 * 快捷键设置管理 Hook
 */
export function useShortcutSettings() {
  const [enabledState, setEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true
    
    try {
      const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEYS.ENABLED)
      return stored !== null ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  const [onboardedState, setOnboardedState] = useState(() => {
    if (typeof window === 'undefined') return true
    
    try {
      const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEYS.ONBOARDED)
      return stored !== null ? JSON.parse(stored) : false
    } catch {
      return false
    }
  })

  const setEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled)
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ENABLED, JSON.stringify(enabled))
        // 触发同页面的即时同步事件，使useHotkeys等能够立即更新
        window.dispatchEvent(new CustomEvent('shortcut-settings-changed', { detail: { enabled } }))
      } catch (error) {
        console.warn('Failed to save shortcut settings:', error)
      }
    }
  }, [])

  const setOnboarded = useCallback((onboarded: boolean) => {
    setOnboardedState(onboarded)
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SHORTCUTS_STORAGE_KEYS.ONBOARDED, JSON.stringify(onboarded))
      } catch (error) {
        console.warn('Failed to save onboarding status:', error)
      }
    }
  }, [])

  return {
    enabled: enabledState,
    setEnabled,
    onboarded: onboardedState,
    setOnboarded
  }
}

/**
 * 简化的快捷键 Hook，用于特定组件
 */
export function useSimpleHotkey(
  key: string,
  modifiers: string[] = [],
  handler: () => void,
  options: {
    enabled?: boolean
    preventDefault?: boolean
    excludeInputs?: boolean
  } = {}
) {
  const {
    enabled = true,
    preventDefault = true,
    excludeInputs = true
  } = options

  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否在输入元素中
      if (excludeInputs && isInInputElement(event.target)) {
        return
      }

      // 检查键匹配
      const keyMatches = event.key === key || 
                        (key === ' ' && event.code === 'Space')
      
      if (!keyMatches) return

      // 检查修饰键
      const hasCtrl = modifiers.includes('ctrl')
      const hasAlt = modifiers.includes('alt')
      const hasShift = modifiers.includes('shift')
      const hasMeta = modifiers.includes('meta')

      const modifiersMatch = (
        event.ctrlKey === hasCtrl &&
        event.altKey === hasAlt &&
        event.shiftKey === hasShift &&
        event.metaKey === hasMeta
      )

      if (!modifiersMatch) return

      if (preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }

      handlerRef.current()
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [key, modifiers, enabled, preventDefault, excludeInputs])
}