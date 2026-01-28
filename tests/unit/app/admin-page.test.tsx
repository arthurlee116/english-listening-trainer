import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AdminPage from '@/app/admin/page'

const mockUseAdminAuth = vi.fn()
const mockUseAdminData = vi.fn()

vi.mock('@/hooks/admin/use-admin-auth', () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}))

vi.mock('@/hooks/admin/use-admin-data', () => ({
  useAdminData: () => mockUseAdminData(),
}))

describe('AdminPage', () => {
  it('renders loading state', () => {
    mockUseAdminAuth.mockReturnValue({
      loading: true,
      isAuthenticated: false,
      currentUser: null,
      handleLogout: vi.fn(),
    })
    mockUseAdminData.mockReturnValue({
      loadAllData: vi.fn(),
    })

    render(<AdminPage />)
    expect(screen.getByText('正在验证管理员权限...')).toBeInTheDocument()
  })

  it('renders unauthorized state', () => {
    mockUseAdminAuth.mockReturnValue({
      loading: false,
      isAuthenticated: false,
      currentUser: null,
      handleLogout: vi.fn(),
    })
    mockUseAdminData.mockReturnValue({
      loadAllData: vi.fn(),
    })

    render(<AdminPage />)
    expect(screen.getByText('权限不足')).toBeInTheDocument()
  })

  it('renders admin dashboard when authenticated', async () => {
    const user = userEvent.setup()
    const loadAllData = vi.fn()

    mockUseAdminAuth.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      currentUser: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', isAdmin: true },
      handleLogout: vi.fn(),
    })
    mockUseAdminData.mockReturnValue({
      loadAllData,
      loading: false,
      stats: { totalUsers: 1, totalSessions: 2, activeUsers: 1, averageAccuracy: 0.7 },
      users: [
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'User',
          isAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { practiceSessions: 3 },
        }
      ],
      recentSessions: [
        {
          id: 'session-1',
          difficulty: 'B1',
          language: 'en-US',
          topic: 'Test topic',
          accuracy: 0.8,
          score: 10,
          duration: 120,
          createdAt: new Date().toISOString(),
          user: { email: 'user@example.com', name: 'User' },
        }
      ],
      effectReport: {
        meta: { note: 'Demo', isSynthetic: true },
        summary: {
          totalUsers: 1,
          improvedUsers: 1,
          improvedRate: 1,
          averageSessions: 3,
          averageAccuracyBefore: 0.6,
          averageAccuracyAfter: 0.8,
        },
        rows: [
          {
            anonymousId: 'U001',
            sessionsCount: 3,
            usageDays: 7,
            levelBefore: 'A2',
            levelAfter: 'B1',
            accuracyBefore: 0.6,
            accuracyAfter: 0.8,
            errorRateBefore: 0.4,
            errorRateAfter: 0.2,
            improved: true,
          }
        ],
      },
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(loadAllData).toHaveBeenCalled()
    })

    expect(screen.getByText('用户管理系统')).toBeInTheDocument()
    expect(screen.getByText('用户列表 (1)')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '练习记录' }))
    expect(screen.getByText('最近练习记录')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '效果统计' }))
    expect(screen.getByText('学习效果统计')).toBeInTheDocument()
  })
})
