import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getChallengeProgress, getUserChallengeOverview } from '@/lib/analytics/challenge-progress'
import { prisma } from '@/lib/__mocks__/prisma'

// Mock prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => prisma)
}))

describe('challenge-progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getChallengeProgress', () => {
    it('should calculate progress stats correctly', async () => {
      const mockChallenge = {
        id: 'challenge-1',
        targetSessionCount: 10,
        completedSessionCount: 5,
        challengeSessions: [
          {
            session: {
              accuracy: 0.85,
              duration: 600
            }
          },
          {
            session: {
              accuracy: 0.90,
              duration: 720
            }
          },
          {
            session: {
              accuracy: 0.80,
              duration: 480
            }
          },
          {
            session: {
              accuracy: null,
              duration: 600
            }
          },
          {
            session: {
              accuracy: 0.75,
              duration: null
            }
          }
        ]
      }

      prisma.challenge.findUnique.mockResolvedValue(mockChallenge as any)

      const result = await getChallengeProgress('challenge-1')

      expect(result.completedSessions).toBe(5)
      expect(result.targetSessions).toBe(10)
      expect(result.completionPercentage).toBe(50)
      expect(result.averageAccuracy).toBeCloseTo(0.825) // (0.85 + 0.90 + 0.80 + 0.75) / 4
      expect(result.totalDuration).toBe(2400) // 600 + 720 + 480 + 600 + 0
      expect(result.averageDuration).toBe(480) // 2400 / 5
    })

    it('should handle empty sessions', async () => {
      const mockChallenge = {
        id: 'challenge-1',
        targetSessionCount: 5,
        completedSessionCount: 0,
        challengeSessions: []
      }

      prisma.challenge.findUnique.mockResolvedValue(mockChallenge as any)

      const result = await getChallengeProgress('challenge-1')

      expect(result.completedSessions).toBe(0)
      expect(result.averageAccuracy).toBeNull()
      expect(result.averageDuration).toBeNull()
      expect(result.lastSessionAt).toBeNull()
    })

    it('should detect improving accuracy trend', async () => {
      const mockChallenge = {
        id: 'challenge-1',
        challengeSessions: [
          { session: { accuracy: 0.70 } },
          { session: { accuracy: 0.75 } },
          { session: { accuracy: 0.85 } },
          { session: { accuracy: 0.90 } }
        ]
      }

      prisma.challenge.findUnique.mockResolvedValue(mockChallenge as any)

      const result = await getChallengeProgress('challenge-1')

      expect(result.accuracyTrend).toBe('improving')
    })

    it('should detect declining accuracy trend', async () => {
      const mockChallenge = {
        id: 'challenge-1',
        challengeSessions: [
          { session: { accuracy: 0.90 } },
          { session: { accuracy: 0.85 } },
          { session: { accuracy: 0.75 } },
          { session: { accuracy: 0.70 } }
        ]
      }

      prisma.challenge.findUnique.mockResolvedValue(mockChallenge as any)

      const result = await getChallengeProgress('challenge-1')

      expect(result.accuracyTrend).toBe('declining')
    })

    it('should calculate difficulty distribution', async () => {
      const mockChallenge = {
        id: 'challenge-1',
        challengeSessions: [
          { session: { difficulty: 'B1' } },
          { session: { difficulty: 'B1' } },
          { session: { difficulty: 'B2' } },
          { session: { difficulty: 'B2' } },
          { session: { difficulty: 'B2' } }
        ]
      }

      prisma.challenge.findUnique.mockResolvedValue(mockChallenge as any)

      const result = await getChallengeProgress('challenge-1')

      expect(result.difficultyDistribution).toEqual({
        B1: 2,
        B2: 3
      })
    })
  })

  describe('getUserChallengeOverview', () => {
    it('should return user challenge statistics', async () => {
      const mockChallenges = [
        {
          id: 'challenge-1',
          status: 'active',
          targetSessionCount: 10,
          completedSessionCount: 5,
          createdAt: new Date()
        },
        {
          id: 'challenge-2',
          status: 'completed',
          targetSessionCount: 8,
          completedSessionCount: 8,
          createdAt: new Date()
        }
      ]

      prisma.challenge.findMany.mockResolvedValue(mockChallenges as any)

      const result = await getUserChallengeOverview('user-123')

      expect(result.totalChallenges).toBe(2)
      expect(result.activeChallenges).toBe(1)
      expect(result.completedChallenges).toBe(1)
      expect(result.totalSessionsCompleted).toBe(13)
    })
  })
})
