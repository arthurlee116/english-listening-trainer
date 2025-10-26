'use client'

import React from 'react'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/providers/language-provider'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { currentLanguage, isChanging, switchLanguage } = useLanguage()

  const handleClick = () => {
    const newLang = currentLanguage === 'zh' ? 'en' : 'zh'
    switchLanguage(newLang)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isChanging}
      aria-label="Switch language 切换语言"
      className={cn(
        'w-10 h-10 rounded-full hover:bg-accent transition-colors',
        isChanging && 'cursor-not-allowed opacity-50'
      )}
    >
      <Globe
        className={cn(
          'w-5 h-5 text-foreground',
          isChanging && 'animate-spin'
        )}
      />
    </Button>
  )
}
