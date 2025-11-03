import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from '@/app/api/challenges/[challengeId]/route'
import { prisma } from '@/lib/__mocks__/prisma'
import { requireAuth } from '@/lib/auth'
import { getChallengeProgress } from '@/lib/analytics/challenge-progress'
import { generateChallengeSummary } from '@/lib/ai/challenge-summary'

// Mock dependencies
vi.mock('@/lib/auth')
vi.mock('@/lib/analytics/challenge-progress')
vi.mock('@/lib/ai/challenge-summary')
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prisma)
}))

describe('/api/challenges/[challengeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return challenge details with stats and sessions', async () => {
      const mockUser = { userId: 'user-123' }
      const mockChallenge = {
        id: 'challenge-1',
        userId: 'user-123',
        topic: 'Business English',
        minDifficulty: 'B1',
        maxDifficulty: 'C1',
        targetSessionCount: 10,
        completedSessionCount: 5,
        status: 'active',
        lastSummaryAt: null,
        summaryText: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        challengeSessions: [
          {
            session: {
              id: 'session-1',
              topic: 'Business meeting',
              difficulty: 'B1',
              accuracy: 0.85,
              score: 85,
              duration: 600,
              createdAt: new Date()
            },
            createdAt: new Date()
          }
        ]
      }
      const mockStats = {
        completedSessions: 5,
        targetSessions: 10,
        completionPercentage: 50,
        averageAccuracy: 0.85,
        accuracyTrend: 'improving' as const,
        totalDuration: 3000,
        averageDuration: 600,
        lastSessionAt: new Date(),
        difficultyDistribution: { B1: 3, B2: 2 }
      }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })
      prisma.challenge.findFirst.mockResolvedValue(mockChallenge)
      vi.mocked(getChallengeProgress).mockResolvedValue(mockStats)

      const request = new Request('http://localhost/api/challenges/challenge-1')
      const response = await GET(request, { params: { challengeId: 'challenge-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.challenge.id).toBe('challenge-1')
      expect(data.stats).toEqual(mockStats)
      expect(data.sessions).toHaveLength(1)
    })

    it('should return 404 for non-existent challenge', async () => {
      const mockUser = { userId: 'user-123' }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })
      prisma.challenge.findFirst.mockResolvedValue(null)

      const request = new Request('http://localhost/api/challenges/challenge-1')
      const response = await GET(request, { params: { challengeId: 'challenge-1' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('挑战不存在或无访问权限')
    })
  })

  describe('PATCH', () => {
    it('should complete challenge and generate summary', async () => {
      const mockUser = { userId: 'user-123' }
      const mockChallenge = {
        id: 'challenge-1',
        userId: 'user-123',
        status: 'active',
        challengeSessions: [{ session: { id: 'session-1' } }]
      }
      const updatedChallenge = {
        id: 'challenge-1',
        status: 'completed',
        lastSummaryAt: new Date(),
        summaryText: 'Great progress!'
      }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })
      prisma.challenge.findFirst.mockResolvedValue(mockChallenge)
      vi.mocked(getChallengeProgress).mockResolvedValue({} as any)
      vi.mocked(generateChallengeSummary).mockResolvedValue('Great progress!')
      prisma.challenge.update.mockResolvedValue(updatedChallenge)

      const request = new Request('http://localhost/api/challenges/challenge-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'complete' }),
        headers: { 'Content-Type': 'application/json' }
      })
      const response = await PATCH(request, { params: { challengeId: 'challenge-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.challenge.status).toBe('completed')
      expect(data.challenge.summaryText).toBe('Great progress!')
    })

    it('should return 400 for invalid action', async () => {
      const mockUser = { userId: 'user-123' }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost/api/challenges/challenge-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'invalid' }),
        headers: { 'Content-Type': 'application/json' }
      })
      const response = await PATCH(request, { params: { challengeId: 'challenge-1' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('无效的操作')
    })

    it('should return 400 for already completed challenge', async () => {
      const mockUser = { userId: 'user-123' }
      const mockChallenge = {
        id: 'challenge-1',
        userId: 'user-123',
        status: 'completed'
      }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })
      prisma.challenge.findFirst.mockResolvedValue(mockChallenge)

      const request = new Request('http://localhost/api/challenges/challenge-1', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'complete' }),
        headers: { 'Content-Type': 'application/json' }
      })
      const response = await PATCH(request, { params: { challengeId: 'challenge-1' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('挑战已完成')
    })
  })
})
