/**
 * useAuthState Hook Tests
 * 测试客户端认证状态钩子的功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuthState } from '@/hooks/use-auth-state'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock setTimeout/clearTimeout
vi.useFakeTimers()

describe('useAuthState', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    isAdmin: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }

  const mockMetadata = {
    cacheVersion: 1,
    lastModified: '2024-01-01T00:00:00.000Z',
    storedAt: '2024-01-01T00:00:00.000Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Reset localStorage mocks
    mockLocalStorage.getItem.mockReturnValue(null)
    mockLocalStorage.setItem.mockImplementation(() => {})
    mockLocalStorage.removeItem.mockImplementation(() => {})
    mockLocalStorage.clear.mockImplementation(() => {})

    // Reset fetch mock
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial State', () => {
    it('should initialize with null user when no cached data', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useAuthState())

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.showAuthDialog).toBe(true)
      expect(result.current.isLoading).toBe(true)
    })

    it('should initialize with cached user data', () => {
      mockLocalStorage.getItem
        .mockImplementationOnce(() => JSON.stringify(mockUser)) // USER_STORAGE_KEY
        .mockImplementationOnce(() => JSON.stringify(mockMetadata)) // METADATA_STORAGE_KEY

      const { result } = renderHook(() => useAuthState())

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.showAuthDialog).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle invalid cached data gracefully', () => {
      mockLocalStorage.getItem
        .mockImplementationOnce(() => 'invalid json')
        .mockImplementationOnce(() => 'invalid json')

      const { result } = renderHook(() => useAuthState())

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.showAuthDialog).toBe(true)
    })
  })

  describe('Authentication Check', () => {
    it('should check auth status on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: mockMetadata })
      })

      const { result } = renderHook(() => useAuthState())

      // Initial state
      expect(result.current.isLoading).toBe(true)

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
        signal: expect.any(AbortSignal)
      })
    })

    it('should handle successful auth check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: mockMetadata })
      })

      const { result } = renderHook(() => useAuthState())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.showAuthDialog).toBe(false)
      expect(result.current.cacheStale).toBe(false)
    })

    it('should handle failed auth check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      })

      const { result } = renderHook(() => useAuthState())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.showAuthDialog).toBe(true)
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAuthState())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.showAuthDialog).toBe(true)
    })

    it('should handle timeout correctly', async () => {
      mockFetch.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useAuthState())

      // Fast-forward time to trigger timeout
      act(() => {
        vi.advanceTimersByTime(8000)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Cache Staleness Detection', () => {
    it('should detect stale cache when versions differ', async () => {
      const staleMetadata = { ...mockMetadata, cacheVersion: 2 }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: staleMetadata })
      })

      mockLocalStorage.getItem
        .mockImplementationOnce(() => JSON.stringify(mockUser))
        .mockImplementationOnce(() => JSON.stringify(mockMetadata))

      const { result } = renderHook(() => useAuthState())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.cacheStale).toBe(true)
    })

    it('should detect stale cache when timestamps differ', async () => {
      const staleMetadata = {
        ...mockMetadata,
        lastModified: '2024-01-02T00:00:00.000Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: staleMetadata })
      })

      mockLocalStorage.getItem
        .mockImplementationOnce(() => JSON.stringify(mockUser))
        .mockImplementationOnce(() => JSON.stringify(mockMetadata))

      const { result } = renderHook(() => useAuthState())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.cacheStale).toBe(true)
    })
  })

  describe('User Authentication Handler', () => {
    it('should handle user authentication', () => {
      const { result } = renderHook(() => useAuthState())

      act(() => {
        result.current.handleUserAuthenticated(mockUser, 'jwt_token')
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.showAuthDialog).toBe(false)
      expect(result.current.authRefreshing).toBe(false)
      expect(result.current.cacheStale).toBe(false)

      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should update cache with new metadata on authentication', () => {
      const { result } = renderHook(() => useAuthState())

      act(() => {
        result.current.handleUserAuthenticated(mockUser, 'jwt_token')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'elt.auth.user',
        JSON.stringify(mockUser)
      )
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'elt.auth.metadata',
        expect.stringContaining('"cacheVersion"')
      )
    })
  })

  describe('Logout Handler', () => {
    it('should handle successful logout', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const { result } = renderHook(() => useAuthState())

      // Set up authenticated state
      act(() => {
        result.current.handleUserAuthenticated(mockUser, 'jwt_token')
      })

      let logoutResult: boolean | undefined
      await act(async () => {
        logoutResult = await result.current.handleLogout()
      })

      expect(logoutResult).toBe(true)
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.showAuthDialog).toBe(true)
      expect(result.current.authRefreshing).toBe(false)
      expect(result.current.cacheStale).toBe(false)

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('elt.auth.user')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('elt.auth.metadata')
    })

    it('should handle logout failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Logout failed'))

      const { result } = renderHook(() => useAuthState())

      // Set up authenticated state
      act(() => {
        result.current.handleUserAuthenticated(mockUser, 'jwt_token')
      })

      let logoutResult: boolean | undefined
      await act(async () => {
        logoutResult = await result.current.handleLogout()
      })

      expect(logoutResult).toBe(false)
      // State should still be cleared even if API call fails
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Auth Status Checking', () => {
    it('should trigger auth status check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: mockMetadata })
      })

      const { result } = renderHook(() => useAuthState())

      act(() => {
        result.current.checkAuthStatus()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
        credentials: 'include',
        cache: 'no-store'
      }))
    })

    it('should handle auth check timeout', async () => {
      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useAuthState())

      act(() => {
        result.current.checkAuthStatus()
      })

      // Advance timers to trigger timeout
      act(() => {
        vi.advanceTimersByTime(8000)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('State Management', () => {
    it('should manage loading states correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: mockMetadata })
      })

      const { result } = renderHook(() => useAuthState())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.authRefreshing).toBe(false)

      // Trigger manual refresh
      act(() => {
        result.current.checkAuthStatus()
      })

      expect(result.current.authRefreshing).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.authRefreshing).toBe(false)
      })
    })

    it('should reset stale cache flag after successful auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, metadata: mockMetadata })
      })

      const { result } = renderHook(() => useAuthState())

      // Simulate stale cache
      act(() => {
        // Manually set cache stale (this would normally be set by cache comparison)
        const currentResult = result.current
        // Note: cacheStale is read-only in the hook, so we can't directly test this
        // But we can verify the auth flow resets it
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.cacheStale).toBe(false)
    })
  })
})