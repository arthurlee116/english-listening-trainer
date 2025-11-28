'use client'

import { useCallback, useState } from 'react'
import type { AdminUser } from './use-admin-auth'
import { useToast } from '@/hooks/use-toast'

export interface PracticeSession {
  id: string
  difficulty: string
  language: string
  topic: string
  accuracy: number | null
  score: number | null
  duration: number | null
  createdAt: string
  user: {
    email: string
    name: string | null
  }
}

export interface SystemStats {
  totalUsers: number
  totalSessions: number
  activeUsers: number
  averageAccuracy: number
}

export function useAdminData() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [recentSessions, setRecentSessions] = useState<PracticeSession[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      } else {
        toast({
          title: '加载失败',
          description: '无法加载用户列表',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      toast({
        title: '加载失败',
        description: '网络错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadRecentSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sessions', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setRecentSessions(data.sessions)
      }
    } catch (error) {
      console.error('Failed to load recent sessions:', error)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }, [])

  const loadAllData = useCallback(() => {
    loadUsers()
    loadRecentSessions()
    loadStats()
  }, [loadUsers, loadRecentSessions, loadStats])

  return {
    users,
    recentSessions,
    stats,
    loading,
    loadAllData
  }
}
