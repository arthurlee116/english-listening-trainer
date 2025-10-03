/**
 * 快捷键系统配置
 * 支持跨平台快捷键显示和处理
 */

// 快捷键动作类型
export type ShortcutAction = 
  | 'play-pause'
  | 'open-history'
  | 'open-wrong-answers'
  | 'toggle-specialized-mode'
  | 'close-dialog'
  | 'show-help'
  | 'return-home'

// 快捷键定义接口
export interface ShortcutDefinition {
  id: string
  action: ShortcutAction
  key: string
  modifiers: string[]
  descriptionKey: string
  availableInSteps?: string[]
  requiresAudio?: boolean
  preventDefault?: boolean
}

// 平台检测
export const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

// 修饰键映射
export const MODIFIER_KEYS = {
  ctrl: isMac ? '⌘' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: isMac ? '⇧' : 'Shift',
  meta: isMac ? '⌘' : 'Win'
} as const

// 快捷键配置
export const SHORTCUTS: ShortcutDefinition[] = [
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
    id: 'open-wrong-answers',
    action: 'open-wrong-answers',
    key: 'w',
    modifiers: ['shift'],
    descriptionKey: 'shortcuts.openWrongAnswers',
    availableInSteps: ['setup', 'results'],
    preventDefault: true
  },
  {
    id: 'toggle-specialized-mode',
    action: 'toggle-specialized-mode',
    key: 's',
    modifiers: ['shift'],
    descriptionKey: 'shortcuts.toggleSpecializedMode',
    availableInSteps: ['setup'],
    preventDefault: true
  },
  {
    id: 'close-dialog',
    action: 'close-dialog',
    key: 'Escape',
    modifiers: [],
    descriptionKey: 'shortcuts.closeDialog',
    preventDefault: false
  },
  {
    id: 'show-help',
    action: 'show-help',
    key: '?',
    modifiers: ['shift'],
    descriptionKey: 'shortcuts.showHelp',
    preventDefault: true
  },
  {
    id: 'return-home',
    action: 'return-home',
    key: 'h',
    modifiers: ['ctrl'],
    descriptionKey: 'shortcuts.returnHome',
    availableInSteps: ['history', 'wrong-answers', 'assessment', 'results'],
    preventDefault: true
  }
]

// 快捷键显示格式化
export function formatShortcut(shortcut: ShortcutDefinition): string {
  const modifierText = shortcut.modifiers
    .map(mod => MODIFIER_KEYS[mod as keyof typeof MODIFIER_KEYS])
    .join(' + ')
  
  const keyText = shortcut.key === ' ' ? 'Space' : 
                  shortcut.key === 'Escape' ? 'Esc' :
                  shortcut.key.toUpperCase()
  
  return modifierText ? `${modifierText} + ${keyText}` : keyText
}

// 检查快捷键是否匹配
export function matchesShortcut(
  event: KeyboardEvent, 
  shortcut: ShortcutDefinition
): boolean {
  // 检查主键
  const keyMatches = event.key === shortcut.key || 
                    (shortcut.key === ' ' && event.code === 'Space') ||
                    (shortcut.key === 'Escape' && event.key === 'Escape')
  
  if (!keyMatches) return false
  
  // 检查修饰键
  const hasCtrl = shortcut.modifiers.includes('ctrl')
  const hasAlt = shortcut.modifiers.includes('alt')
  const hasShift = shortcut.modifiers.includes('shift')
  const hasMeta = shortcut.modifiers.includes('meta')
  
  return (
    event.ctrlKey === hasCtrl &&
    event.altKey === hasAlt &&
    event.shiftKey === hasShift &&
    event.metaKey === hasMeta
  )
}

// 检查是否在输入元素中
export function isInInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  
  const tagName = target.tagName.toLowerCase()
  const isInput = tagName === 'input' || tagName === 'textarea'
  const isContentEditable = target.getAttribute('contenteditable') === 'true'
  
  return isInput || isContentEditable
}

// 快捷键可用性检查
export function isShortcutAvailable(
  shortcut: ShortcutDefinition,
  currentStep: string,
  hasAudio: boolean = false
): boolean {
  // 检查步骤限制
  if (shortcut.availableInSteps && !shortcut.availableInSteps.includes(currentStep)) {
    return false
  }
  
  // 检查音频要求
  if (shortcut.requiresAudio && !hasAudio) {
    return false
  }
  
  return true
}

// LocalStorage 键
export const SHORTCUTS_STORAGE_KEYS = {
  ENABLED: 'english-listening-shortcuts-enabled',
  ONBOARDED: 'english-listening-shortcuts-onboarded'
} as const

// 默认设置
export const DEFAULT_SHORTCUTS_SETTINGS = {
  enabled: true,
  showOnboarding: true
} as const