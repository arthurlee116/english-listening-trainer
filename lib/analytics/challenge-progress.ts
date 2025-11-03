import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface ChallengeProgressStats {
  completedSessions: number
  targetSessions: number
  completionPercentage: number
  averageAccuracy: number | null
  accuracyTrend: 'improving' | 'declining' | 'stable'
  totalDuration: number
  averageDuration: number | null
  lastSessionAt: Date | null
  difficultyDistribution: Record<string, number>
}

/**
 * 计算挑战的进度统计数据
 * @param challengeId 挑战ID
 * @returns 进度统计数据
 */
export async function getChallengeProgress(challengeId: string): Promise<ChallengeProgressStats> {
  // 获取挑战的基本信息和关联的会话
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      challengeSessions: {
        include: {
          session: true
        },
        orderBy: {
          createdAt: 'asc' // 按时间顺序获取，用于趋势分析
        }
      }
    }
  })

  if (!challenge) {
    throw new Error('Challenge not found')
  }

  const sessions = challenge.challengeSessions.map(cs => cs.session)
  const completedSessions = sessions.length
  const targetSessions = challenge.targetSessionCount
  const completionPercentage = Math.min((completedSessions / targetSessions) * 100, 100)

  // 计算平均准确率
  const validAccuracies = sessions
    .map(s => s.accuracy)
    .filter(acc => acc !== null && acc !== undefined) as number[]

  const averageAccuracy = validAccuracies.length > 0
    ? validAccuracies.reduce((sum, acc) => sum + acc, 0) / validAccuracies.length
    : null

  // 计算准确率趋势
  let accuracyTrend: 'improving' | 'declining' | 'stable' = 'stable'
  if (validAccuracies.length >= 2) {
    const firstHalf = validAccuracies.slice(0, Math.floor(validAccuracies.length / 2))
    const secondHalf = validAccuracies.slice(Math.floor(validAccuracies.length / 2))

    const firstHalfAvg = firstHalf.reduce((sum, acc) => sum + acc, 0) / firstHalf.length
    const secondHalfAvg = secondHalf.reduce((sum, acc) => sum + acc, 0) / secondHalf.length

    const difference = secondHalfAvg - firstHalfAvg
    if (difference > 0.05) { // 5% 改进阈值
      accuracyTrend = 'improving'
    } else if (difference < -0.05) {
      accuracyTrend = 'declining'
    }
  }

  // 计算总时长和平均时长
  const validDurations = sessions
    .map(s => s.duration)
    .filter(dur => dur !== null && dur !== undefined) as number[]

  const totalDuration = validDurations.reduce((sum, dur) => sum + dur, 0)
  const averageDuration = validDurations.length > 0
    ? totalDuration / validDurations.length
    : null

  // 获取最后练习时间
  const lastSessionAt = sessions.length > 0
    ? sessions[sessions.length - 1].createdAt
    : null

  // 统计难度分布
  const difficultyDistribution: Record<string, number> = {}
  sessions.forEach(session => {
    const difficulty = session.difficulty
    difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1
  })

  return {
    completedSessions,
    targetSessions,
    completionPercentage,
    averageAccuracy,
    accuracyTrend,
    totalDuration,
    averageDuration,
    lastSessionAt,
    difficultyDistribution
  }
}

/**
 * 获取用户的挑战统计概览
 * @param userId 用户ID
 * @returns 用户挑战统计
 */
export async function getUserChallengeOverview(userId: string) {
  const challenges = await prisma.challenge.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      targetSessionCount: true,
      completedSessionCount: true,
      createdAt: true,
      _count: {
        select: {
          challengeSessions: true
        }
      }
    }
  })

  const activeChallenges = challenges.filter(c => c.status === 'active').length
  const completedChallenges = challenges.filter(c => c.status === 'completed').length
  const totalSessionsCompleted = challenges.reduce((sum, c) => sum + c.completedSessionCount, 0)

  return {
    totalChallenges: challenges.length,
    activeChallenges,
    completedChallenges,
    totalSessionsCompleted,
    recentChallenges: challenges.slice(0, 5) // 最近5个挑战
  }
}
