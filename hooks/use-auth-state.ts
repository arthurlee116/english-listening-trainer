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
const AUTH_CHECK_TIMEOUT_MS = 8000

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

  const checkAuthStatus = useCallback(async (options: { initial?: boolean } = {}) => {
    const { initial = false } = options
    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      if (!initial) {
        setAuthRefreshing(true)
        setIsLoading(true)
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error('Request timed out'))
        }, AUTH_CHECK_TIMEOUT_MS)
      })

      const fetchPromise = fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      })

      const response = await Promise.race([
        fetchPromise,
        timeoutPromise,
      ]) as Response | undefined

      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('Invalid auth response')
      }

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (response.ok) {
        if (typeof response.json !== 'function') {
          throw new Error('Invalid auth response structure')
        }
        const data = await response.json()
        const serverUser = data.user
        const serverMetadata = data.metadata

        // 检查本地缓存是否仍然有效
        const localMetadata = readAuthMetadata()
        let isStale = false

        if (localMetadata && serverMetadata) {
          isStale = isCacheStale(
            localMetadata.cacheVersion,
            serverMetadata.cacheVersion,
            localMetadata.lastModified,
            serverMetadata.lastModified
          )
          setCacheStale(isStale)
        } else {
          setCacheStale(false)
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
        if (!isStale) {
          setCacheStale(false)
        }
      } else {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        clearCache()
        setUser(null)
        setIsAuthenticated(false)
        setShowAuthDialog(true)
        setCacheStale(false)
      }
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request timed out')) {
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
    checkAuthStatus({ initial: true })
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
    clearCache()
    setUser(null)
    setIsAuthenticated(false)
    setShowAuthDialog(true)
    setAuthRefreshing(false)
    setCacheStale(false)

    let success = false

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      if (response && typeof (response as Response).ok === 'boolean') {
        success = Boolean((response as Response).ok)
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }

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
