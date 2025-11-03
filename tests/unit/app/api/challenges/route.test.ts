import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/challenges/route'
import { prisma } from '@/lib/__mocks__/prisma'
import { requireAuth } from '@/lib/auth'
import { getChallengeProgress } from '@/lib/analytics/challenge-progress'

// Mock dependencies
vi.mock('@/lib/auth')
vi.mock('@/lib/analytics/challenge-progress')
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prisma)
}))

describe('/api/challenges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return challenges list for authenticated user', async () => {
      const mockUser = { userId: 'user-123' }
      const mockChallenges = [
        {
          id: 'challenge-1',
          userId: 'user-123',
          topic: 'Business English',
          minDifficulty: 'B1',
          maxDifficulty: 'C1',
          targetSessionCount: 10,
          completedSessionCount: 5,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      const mockStats = {
        completedSessions: 5,
        targetSessions: 10,
        completionPercentage: 50,
        averageAccuracy: 0.85,
        accuracyTrend: 'improving' as const,
        totalDuration: 1800,
        averageDuration: 360,
        lastSessionAt: new Date(),
        difficultyDistribution: { B1: 3, B2: 2 }
      }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })
      prisma.challenge.findMany.mockResolvedValue(mockChallenges)
      vi.mocked(getChallengeProgress).mockResolvedValue(mockStats)

      const request = new Request('http://localhost/api/challenges')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.challenges).toHaveLength(1)
      expect(data.challenges[0]).toEqual({
        ...mockChallenges[0],
        stats: mockStats
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      vi.mocked(requireAuth).mockResolvedValue({ error: 'Unauthorized' })

      const request = new Request('http://localhost/api/challenges')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST', () => {
    it('should create challenge successfully', async () => {
      const mockUser = { userId: 'user-123' }
      const challengeData = {
        topic: 'Academic Writing',
        minDifficulty: 'B2',
        maxDifficulty: 'C1',
        targetSessionCount: 8
      }
      const createdChallenge = {
        id: 'challenge-new',
        ...challengeData,
        userId: mockUser.userId,
        completedSessionCount: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })
      prisma.challenge.create.mockResolvedValue(createdChallenge)

      const request = new Request('http://localhost/api/challenges', {
        method: 'POST',
        body: JSON.stringify(challengeData),
        headers: { 'Content-Type': 'application/json' }
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.challenge.id).toBe('challenge-new')
      expect(data.challenge.topic).toBe('Academic Writing')
      expect(prisma.challenge.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.userId,
          ...challengeData,
          completedSessionCount: 0,
          status: 'active'
        }
      })
    })

    it('should return 400 for invalid data', async () => {
      const mockUser = { userId: 'user-123' }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost/api/challenges', {
        method: 'POST',
        body: JSON.stringify({ topic: '' }), // Invalid: missing required fields
        headers: { 'Content-Type': 'application/json' }
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('挑战参数不完整')
    })

    it('should return 400 for invalid difficulty range', async () => {
      const mockUser = { userId: 'user-123' }

      vi.mocked(requireAuth).mockResolvedValue({ user: mockUser })

      const request = new Request('http://localhost/api/challenges', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Test Topic',
          minDifficulty: 'INVALID',
          maxDifficulty: 'B2',
          targetSessionCount: 5
        }),
        headers: { 'Content-Type': 'application/json' }
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('无效的难度级别')
    })
  })
})
