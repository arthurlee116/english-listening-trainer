'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuthState } from '@/hooks/use-auth-state'
import { toast } from '@/hooks/use-toast'

export type Language = 'zh' | 'en'

interface LanguageContextType {
  currentLanguage: Language
  isChanging: boolean
  switchLanguage: (lang: Language) => Promise<void>
  isReady: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'elt.language'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, checkAuthStatus } = useAuthState()
  const [currentLanguage, setCurrentLanguage] = useState<Language>('zh')
  const [isChanging, setIsChanging] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null)

  // 初始化语言
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached === 'zh' || cached === 'en') {
        setCurrentLanguage(cached)
      }
    } catch (error) {
      console.warn('Failed to read language preference from localStorage:', error)
    } finally {
      setIsReady(true)
    }
  }, [])

  // 监听用户登录状态，应用数据库偏好
  useEffect(() => {
    // 如果有挂起的语言更新，不应用数据库偏好，避免覆盖正在提交的更改
    if (pendingLanguage !== null) return

    // 仅在挂起状态为 null 且服务端偏好与本地不一致时才更新
    if (user?.preferredLanguage && (user.preferredLanguage === 'zh' || user.preferredLanguage === 'en')) {
      if (currentLanguage !== user.preferredLanguage) {
        setCurrentLanguage(user.preferredLanguage)
        try {
          localStorage.setItem(STORAGE_KEY, user.preferredLanguage)
        } catch (error) {
          console.warn('Failed to save language preference to localStorage:', error)
        }
      }
    }
  }, [user?.preferredLanguage, currentLanguage, pendingLanguage])

  // 切换语言函数
  const switchLanguage = useCallback(async (newLang: Language) => {
    if (newLang === currentLanguage) return

    const previousLang = currentLanguage

    try {
      setIsChanging(true)
      
      // 标记挂起的语言更新，避免后续 effect 覆盖
      setPendingLanguage(newLang)
      
      // 立即更新 UI
      setCurrentLanguage(newLang)
      
      // 写入 localStorage
      try {
        localStorage.setItem(STORAGE_KEY, newLang)
      } catch (error) {
        console.warn('Failed to save language preference to localStorage:', error)
      }

      // 如果已登录，调用 API 更新数据库
      if (isAuthenticated) {
        const response = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ preferredLanguage: newLang }),
        })

        if (!response.ok) {
          throw new Error('Failed to update language preference')
        }

        // 刷新用户信息以获取最新的服务端状态
        await checkAuthStatus({ initial: false })

        // 清空挂起状态
        setPendingLanguage(null)

        // 成功提示
        toast({
          title: newLang === 'zh' ? '语言已切换' : 'Language switched',
          description: newLang === 'zh' ? '已切换到中文' : 'Switched to English',
        })
      } else {
        // 未登录状态也要清空挂起状态
        setPendingLanguage(null)
      }
    } catch (error) {
      console.error('Failed to switch language:', error)
      
      // 回滚
      setCurrentLanguage(previousLang)
      try {
        localStorage.setItem(STORAGE_KEY, previousLang)
      } catch (storageError) {
        console.warn('Failed to restore language preference in localStorage:', storageError)
      }

      // 清空挂起状态
      setPendingLanguage(null)

      // 错误提示
      toast({
        variant: 'destructive',
        title: previousLang === 'zh' ? '语言设置更新失败' : 'Failed to update language preference',
        description: previousLang === 'zh' 
          ? '网络连接超时，语言设置未保存' 
          : 'Network timeout, preference not saved',
      })
    } finally {
      setIsChanging(false)
    }
  }, [currentLanguage, isAuthenticated])

  const value = useMemo(
    () => ({
      currentLanguage,
      isChanging,
      switchLanguage,
      isReady,
    }),
    [currentLanguage, isChanging, switchLanguage, isReady]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
