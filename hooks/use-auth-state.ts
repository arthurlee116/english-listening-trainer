'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AuthUserInfo {
  id: string
  email: string
  name?: string | null
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthMetadata {
  cacheVersion: number
  lastModified: string
  storedAt: string
}

const USER_STORAGE_KEY = 'elt.auth.user'
const METADATA_STORAGE_KEY = 'elt.auth.metadata'

function readCachedUser(): AuthUserInfo | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY)
    if (!stored) {
      return null
    }

    return JSON.parse(stored) as AuthUserInfo
  } catch (error) {
    console.warn('Failed to parse cached auth user:', error)
    window.localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

function readAuthMetadata(): AuthMetadata | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(METADATA_STORAGE_KEY)
    if (!stored) {
      return null
    }

    return JSON.parse(stored) as AuthMetadata
  } catch (error) {
    console.warn('Failed to parse auth metadata:', error)
    window.localStorage.removeItem(METADATA_STORAGE_KEY)
    return null
  }
}

function writeCache(user: AuthUserInfo, metadata: AuthMetadata): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  window.localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(metadata))
}

function clearCache(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(USER_STORAGE_KEY)
  window.localStorage.removeItem(METADATA_STORAGE_KEY)
}

function isCacheStale(localVersion: number, serverVersion: number, localModified: string, serverModified: string): boolean {
  const versionStale = localVersion !== serverVersion
  const timeStale = new Date(localModified) < new Date(serverModified)
  return versionStale || timeStale
}

export function useAuthState() {
  const initialUser = typeof window !== 'undefined' ? readCachedUser() : null
  const initialMetadata = typeof window !== 'undefined' ? readAuthMetadata() : null

  const [user, setUser] = useState<AuthUserInfo | null>(initialUser)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(initialUser))
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialUser)
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(() => !initialUser)
  const [authRefreshing, setAuthRefreshing] = useState<boolean>(false)
  const [cacheStale, setCacheStale] = useState<boolean>(false)

  const checkAuthStatus = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = typeof window !== 'undefined' ? window.setTimeout(() => controller.abort(), 8000) : null

    try {
      setAuthRefreshing(true)

      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      })

      if (response.ok) {
        const data = await response.json()
        const serverUser = data.user
        const serverMetadata = data.metadata

        // 检查本地缓存是否仍然有效
        const localMetadata = readAuthMetadata()

        if (localMetadata && serverMetadata) {
          const stale = isCacheStale(
            localMetadata.cacheVersion,
            serverMetadata.cacheVersion,
            localMetadata.lastModified,
            serverMetadata.lastModified
          )
          setCacheStale(stale)
        }

        // 更新缓存
        const metadata: AuthMetadata = {
          cacheVersion: serverMetadata?.cacheVersion || 0,
          lastModified: serverMetadata?.lastModified || serverUser.updatedAt,
          storedAt: new Date().toISOString()
        }

        writeCache(serverUser, metadata)

        setUser(serverUser)
        setIsAuthenticated(true)
        setShowAuthDialog(false)
        setCacheStale(false)
      } else {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        clearCache()
        setUser(null)
        setIsAuthenticated(false)
        setShowAuthDialog(true)
        setCacheStale(false)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Auth check aborted due to timeout')
      } else {
        console.error('Auth check failed:', error)
        setCacheStale(false) // 重置状态，避免无限错误
      }
      setUser(null)
      setIsAuthenticated(false)
      setShowAuthDialog(true)
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      setIsLoading(false)
      setAuthRefreshing(false)
    }
  }, [])

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  const handleUserAuthenticated = useCallback((userData: AuthUserInfo, _token: string) => {
    setUser(userData)
    setIsAuthenticated(true)
    setShowAuthDialog(false)
    setAuthRefreshing(false)
    setCacheStale(false)

    // 存储完整的版本化缓存
    const metadata: AuthMetadata = {
      cacheVersion: Date.now(), // 使用时间戳作为初始版本
      lastModified: userData.updatedAt,
      storedAt: new Date().toISOString()
    }

    writeCache(userData, metadata)
  }, [])

  const handleLogout = useCallback(async (): Promise<boolean> => {
    let success = false

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      success = true
    } catch (error) {
      console.error('Logout failed:', error)
    }

    clearCache()
    setUser(null)
    setIsAuthenticated(false)
    setShowAuthDialog(true)
    setAuthRefreshing(false)
    setCacheStale(false)

    return success
  }, [])

  return {
    user,
    isAuthenticated,
    isLoading,
    showAuthDialog,
    authRefreshing, // 认证状态正在刷新
    cacheStale, // 缓存状态过期
    handleUserAuthenticated,
    handleLogout,
    checkAuthStatus,
  }
}
