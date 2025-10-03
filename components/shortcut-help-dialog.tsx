"use client"

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Keyboard, Info } from 'lucide-react'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { BilingualText } from '@/components/ui/bilingual-text'
import { 
  SHORTCUTS, 
  formatShortcut, 
  isShortcutAvailable,
  type ShortcutDefinition 
} from '@/lib/shortcuts'

interface ShortcutHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStep?: string
  hasAudio?: boolean
}

export function ShortcutHelpDialog({ 
  open, 
  onOpenChange, 
  currentStep = 'setup',
  hasAudio = false 
}: ShortcutHelpDialogProps) {
  const { t } = useBilingualText()

  // 获取步骤显示名称
  const getStepDisplayName = (steps: string[] | undefined): string => {
    if (!steps || steps.length === 0) {
      return t('shortcuts.allSteps')
    }

    const stepNames = steps.map(step => {
      switch (step) {
        case 'setup':
          return t('shortcuts.setupStep')
        case 'listening':
          return t('shortcuts.listeningStep')
        case 'questions':
          return t('shortcuts.questionsStep')
        case 'results':
          return t('shortcuts.resultsStep')
        default:
          return step
      }
    })

    return stepNames.join(', ')
  }

  // 获取快捷键状态
  const getShortcutStatus = (shortcut: ShortcutDefinition) => {
    const isAvailable = isShortcutAvailable(shortcut, currentStep, hasAudio)
    return {
      isAvailable,
      variant: (isAvailable ? 'default' : 'secondary') as 'default' | 'secondary',
      opacity: isAvailable ? 'opacity-100' : 'opacity-50'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            <BilingualText translationKey="shortcuts.title" />
          </DialogTitle>
          <DialogDescription>
            <BilingualText translationKey="shortcuts.description" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 当前状态信息 */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              当前步骤: {getStepDisplayName([currentStep])}
              {hasAudio && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  • 音频可用
                </span>
              )}
            </span>
          </div>

          {/* 快捷键表格 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">
                  <BilingualText translationKey="shortcuts.shortcutKey" />
                </TableHead>
                <TableHead>
                  <BilingualText translationKey="shortcuts.action" />
                </TableHead>
                <TableHead>
                  <BilingualText translationKey="shortcuts.availability" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SHORTCUTS.map((shortcut) => {
                const status = getShortcutStatus(shortcut)
                return (
                  <TableRow 
                    key={shortcut.id} 
                    className={status.opacity}
                  >
                    <TableCell>
                      <Badge 
                        variant={status.variant}
                        className="font-mono text-xs"
                      >
                        {formatShortcut(shortcut)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BilingualText translationKey={shortcut.descriptionKey} />
                        {shortcut.requiresAudio && (
                          <span className="text-xs text-gray-500">
                            <BilingualText translationKey="shortcuts.requiresAudio" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {getStepDisplayName(shortcut.availableInSteps)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* 使用提示 */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-sm mb-2">使用提示:</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 快捷键在输入框中不会触发（除了 Esc 键）</li>
              <li>• 灰色显示的快捷键在当前步骤不可用</li>
              <li>• 某些快捷键需要音频加载完成后才能使用</li>
              <li>• 可以在设置中禁用快捷键功能</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 快捷键入门引导对话框
interface ShortcutOnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function ShortcutOnboardingDialog({ 
  open, 
  onOpenChange, 
  onComplete 
}: ShortcutOnboardingDialogProps) {
  // Removed empty destructuring: const { } = useBilingualText()

  const handleComplete = () => {
    onComplete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <BilingualText translationKey="shortcuts.onboardingTitle" />
          </DialogTitle>
          <DialogDescription className="text-left">
            <BilingualText translationKey="shortcuts.onboardingDescription" />
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BilingualText translationKey="shortcuts.onboardingGotIt" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}