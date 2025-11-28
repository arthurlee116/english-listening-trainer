'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface AdminUser {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    practiceSessions: number
  }
}

export function useAdminAuth() {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user.isAdmin) {
          setCurrentUser(data.user)
          setIsAuthenticated(true)
        } else {
          toast({
            title: '权限不足',
            description: '需要管理员权限才能访问此页面',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      toast({
        title: '认证失败',
        description: '请重新登录',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      setCurrentUser(null)
      setIsAuthenticated(false)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [])

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  return {
    currentUser,
    isAuthenticated,
    loading,
    handleLogout
  }
}
