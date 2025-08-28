/**
 * 数据库适配器 - 统一不同数据库的操作接口
 * 支持 SQLite (better-sqlite3) 和 Prisma (PostgreSQL/MySQL)
 */

import { PrismaClient } from '@prisma/client'
import { dbOperations as sqliteOperations } from './db'
import type { Exercise } from './types'

// 数据库类型枚举
export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql'

// 统一的数据库操作接口
export interface DatabaseAdapter {
  // 邀请码相关
  verifyInvitationCode(code: string): Promise<boolean>
  createInvitationCode(code: string): Promise<boolean>
  createMultipleInvitationCodes(codes: string[]): Promise<number>
  getAllInvitationCodes(): Promise<Array<{code: string, created_at: string, last_active_at: string}>>
  deleteInvitationCode(code: string): Promise<boolean>

  // 使用次数相关
  getTodayUsageCount(invitationCode: string): Promise<number>
  incrementUsageCount(invitationCode: string): Promise<boolean>

  // 练习记录相关
  saveExercise(exercise: Exercise, invitationCode: string, difficulty?: number): Promise<boolean>
  getExerciseHistory(invitationCode: string, limit?: number): Promise<Exercise[]>

  // 错题记录相关
  saveWrongAnswer(wrongAnswer: any): Promise<boolean>
  getWrongAnswers(invitation_code: string, filters?: any): Promise<Array<any>>
  getUserTagStats(invitation_code: string): Promise<Array<any>>

  // 难度评估相关
  checkUserDifficultyAssessment(invitation_code: string): Promise<any>
  saveDifficultyAssessment(invitation_code: string, scores: number[], finalDifficulty: number): Promise<boolean>
  getUserDifficultyLevel(invitation_code: string): Promise<number | null>

  // 统计数据相关
  getUsageStats(): Promise<Array<any>>
  getDailyUsageStats(): Promise<Array<any>>
  
  // 连接管理
  isConnected(): Promise<boolean>
  disconnect(): Promise<void>
}

// SQLite 适配器 (使用现有的 better-sqlite3)
export class SQLiteAdapter implements DatabaseAdapter {
  async verifyInvitationCode(code: string): Promise<boolean> {
    return sqliteOperations.verifyInvitationCode(code)
  }

  async createInvitationCode(code: string): Promise<boolean> {
    return sqliteOperations.createInvitationCode(code)
  }

  async createMultipleInvitationCodes(codes: string[]): Promise<number> {
    return sqliteOperations.createMultipleInvitationCodes(codes)
  }

  async getAllInvitationCodes(): Promise<Array<{code: string, created_at: string, last_active_at: string}>> {
    return sqliteOperations.getAllInvitationCodes()
  }

  async deleteInvitationCode(code: string): Promise<boolean> {
    return sqliteOperations.deleteInvitationCode(code)
  }

  async getTodayUsageCount(invitationCode: string): Promise<number> {
    return sqliteOperations.getTodayUsageCount(invitationCode)
  }

  async incrementUsageCount(invitationCode: string): Promise<boolean> {
    return sqliteOperations.incrementUsageCount(invitationCode)
  }

  async saveExercise(exercise: Exercise, invitationCode: string, difficulty?: number): Promise<boolean> {
    return sqliteOperations.saveExercise(exercise, invitationCode, difficulty)
  }

  async getExerciseHistory(invitationCode: string, limit = 10): Promise<Exercise[]> {
    return sqliteOperations.getExerciseHistory(invitationCode, limit)
  }

  async saveWrongAnswer(wrongAnswer: any): Promise<boolean> {
    return sqliteOperations.saveWrongAnswer(wrongAnswer)
  }

  async getWrongAnswers(invitation_code: string, filters?: any): Promise<Array<any>> {
    return sqliteOperations.getWrongAnswers(invitation_code, filters)
  }

  async getUserTagStats(invitation_code: string): Promise<Array<any>> {
    return sqliteOperations.getUserTagStats(invitation_code)
  }

  async checkUserDifficultyAssessment(invitation_code: string): Promise<any> {
    return sqliteOperations.checkUserDifficultyAssessment(invitation_code)
  }

  async saveDifficultyAssessment(invitation_code: string, scores: number[], finalDifficulty: number): Promise<boolean> {
    return sqliteOperations.saveDifficultyAssessment(invitation_code, scores, finalDifficulty)
  }

  async getUserDifficultyLevel(invitation_code: string): Promise<number | null> {
    return sqliteOperations.getUserDifficultyLevel(invitation_code)
  }

  async getUsageStats(): Promise<Array<any>> {
    return sqliteOperations.getUsageStats()
  }

  async getDailyUsageStats(): Promise<Array<any>> {
    return sqliteOperations.getDailyUsageStats()
  }

  async isConnected(): Promise<boolean> {
    try {
      sqliteOperations.getAllInvitationCodes()
      return true
    } catch {
      return false
    }
  }

  async disconnect(): Promise<void> {
    // SQLite 连接由单例管理，无需手动断开
  }
}

// Prisma 适配器 (用于 PostgreSQL/MySQL)
export class PrismaAdapter implements DatabaseAdapter {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async verifyInvitationCode(code: string): Promise<boolean> {
    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { code }
      })
      
      if (invitation) {
        // 更新最后活跃时间
        await this.prisma.invitation.update({
          where: { code },
          data: { lastActiveAt: new Date() }
        })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async createInvitationCode(code: string): Promise<boolean> {
    try {
      await this.prisma.invitation.create({
        data: { code }
      })
      return true
    } catch {
      return false
    }
  }

  async createMultipleInvitationCodes(codes: string[]): Promise<number> {
    try {
      const result = await this.prisma.invitation.createMany({
        data: codes.map(code => ({ code })),
        skipDuplicates: true
      })
      return result.count
    } catch {
      return 0
    }
  }

  async getAllInvitationCodes(): Promise<Array<{code: string, created_at: string, last_active_at: string}>> {
    try {
      const invitations = await this.prisma.invitation.findMany({
        orderBy: { createdAt: 'desc' }
      })
      
      return invitations.map(inv => ({
        code: inv.code,
        created_at: inv.createdAt.toISOString(),
        last_active_at: inv.lastActiveAt.toISOString()
      }))
    } catch {
      return []
    }
  }

  async deleteInvitationCode(code: string): Promise<boolean> {
    try {
      await this.prisma.invitation.delete({
        where: { code }
      })
      return true
    } catch {
      return false
    }
  }

  async getTodayUsageCount(invitationCode: string): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const usage = await this.prisma.dailyUsage.findUnique({
        where: {
          invitationCode_date: {
            invitationCode,
            date: today
          }
        }
      })
      return usage?.usageCount || 0
    } catch {
      return 0
    }
  }

  async incrementUsageCount(invitationCode: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const currentCount = await this.getTodayUsageCount(invitationCode)
      
      if (currentCount >= 5) {
        return false
      }

      await this.prisma.dailyUsage.upsert({
        where: {
          invitationCode_date: {
            invitationCode,
            date: today
          }
        },
        create: {
          invitationCode,
          date: today,
          usageCount: 1
        },
        update: {
          usageCount: { increment: 1 }
        }
      })
      return true
    } catch {
      return false
    }
  }

  async saveExercise(exercise: Exercise, invitationCode: string, difficulty?: number): Promise<boolean> {
    try {
      await this.prisma.exercise.create({
        data: {
          id: exercise.id,
          invitationCode,
          exerciseData: JSON.stringify(exercise),
          difficulty
        }
      })
      return true
    } catch {
      return false
    }
  }

  async getExerciseHistory(invitationCode: string, limit = 10): Promise<Exercise[]> {
    try {
      const exercises = await this.prisma.exercise.findMany({
        where: { invitationCode },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
      
      return exercises.map(ex => JSON.parse(ex.exerciseData))
    } catch {
      return []
    }
  }

  async saveWrongAnswer(wrongAnswer: any): Promise<boolean> {
    try {
      await this.prisma.wrongAnswer.create({
        data: {
          id: wrongAnswer.id,
          invitationCode: wrongAnswer.invitation_code,
          exerciseId: wrongAnswer.exercise_id,
          questionIndex: wrongAnswer.question_index,
          questionData: JSON.stringify(wrongAnswer.question_data),
          userAnswer: wrongAnswer.user_answer,
          correctAnswer: wrongAnswer.correct_answer,
          transcriptSnippet: wrongAnswer.transcript_snippet,
          topic: wrongAnswer.topic,
          difficulty: wrongAnswer.difficulty,
          language: wrongAnswer.language || 'en-US',
          tags: JSON.stringify(wrongAnswer.tags),
          errorAnalysis: wrongAnswer.error_analysis
        }
      })
      
      // 更新用户薄弱点统计
      if (wrongAnswer.tags && Array.isArray(wrongAnswer.tags)) {
        for (const tag of wrongAnswer.tags) {
          await this.prisma.userWeakness.upsert({
            where: {
              invitationCode_tagName: {
                invitationCode: wrongAnswer.invitation_code,
                tagName: tag
              }
            },
            create: {
              invitationCode: wrongAnswer.invitation_code,
              tagName: tag,
              frequency: 1,
              lastOccurrence: new Date()
            },
            update: {
              frequency: { increment: 1 },
              lastOccurrence: new Date()
            }
          })
        }
      }
      
      return true
    } catch {
      return false
    }
  }

  async getWrongAnswers(invitation_code: string, filters?: any): Promise<Array<any>> {
    try {
      const wrongAnswers = await this.prisma.wrongAnswer.findMany({
        where: {
          invitationCode: invitation_code,
          ...(filters?.tags && { tags: { contains: JSON.stringify(filters.tags) } })
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset
      })
      
      return wrongAnswers.map(wa => ({
        ...wa,
        question_data: JSON.parse(wa.questionData),
        tags: JSON.parse(wa.tags)
      }))
    } catch {
      return []
    }
  }

  async getUserTagStats(invitation_code: string): Promise<Array<any>> {
    try {
      const stats = await this.prisma.userWeakness.findMany({
        where: { invitationCode: invitation_code },
        include: {
          // 这里需要根据实际的 ErrorTag 关联来获取标签详情
          // 由于 Prisma schema 中没有直接关联，这里简化处理
        },
        orderBy: [
          { frequency: 'desc' },
          { lastOccurrence: 'desc' }
        ]
      })
      
      return stats.map(stat => ({
        tag_name: stat.tagName,
        count: stat.frequency,
        last_occurrence: stat.lastOccurrence.toISOString()
      }))
    } catch {
      return []
    }
  }

  async checkUserDifficultyAssessment(invitation_code: string): Promise<any> {
    try {
      const assessment = await this.prisma.userDifficulty.findUnique({
        where: { invitationCode: invitation_code }
      })
      
      if (assessment) {
        return {
          hasAssessment: true,
          difficultyLevel: assessment.difficultyLevel,
          testDate: assessment.testDate.toISOString()
        }
      }
      
      return { hasAssessment: false }
    } catch {
      return { hasAssessment: false }
    }
  }

  async saveDifficultyAssessment(invitation_code: string, scores: number[], finalDifficulty: number): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 创建或更新用户难度记录
        await tx.userDifficulty.upsert({
          where: { invitationCode: invitation_code },
          create: {
            invitationCode: invitation_code,
            difficultyLevel: finalDifficulty,
            scores: JSON.stringify(scores)
          },
          update: {
            difficultyLevel: finalDifficulty,
            scores: JSON.stringify(scores),
            testDate: new Date()
          }
        })
        
        // 添加历史记录
        await tx.assessmentHistory.create({
          data: {
            invitationCode: invitation_code,
            scores: JSON.stringify(scores),
            finalDifficulty
          }
        })
      })
      
      return true
    } catch {
      return false
    }
  }

  async getUserDifficultyLevel(invitation_code: string): Promise<number | null> {
    try {
      const assessment = await this.prisma.userDifficulty.findUnique({
        where: { invitationCode: invitation_code }
      })
      return assessment?.difficultyLevel || null
    } catch {
      return null
    }
  }

  async getUsageStats(): Promise<Array<any>> {
    try {
      const stats = await this.prisma.exercise.groupBy({
        by: ['invitationCode'],
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: { _count: { id: 'desc' } }
      })
      
      return stats.map(stat => ({
        invitation_code: stat.invitationCode,
        total_exercises: stat._count.id,
        last_exercise: stat._max.createdAt?.toISOString()
      }))
    } catch {
      return []
    }
  }

  async getDailyUsageStats(): Promise<Array<any>> {
    try {
      const stats = await this.prisma.dailyUsage.findMany({
        orderBy: [
          { date: 'desc' },
          { usageCount: 'desc' }
        ],
        take: 50
      })
      
      return stats.map(stat => ({
        invitation_code: stat.invitationCode,
        date: stat.date,
        usage_count: stat.usageCount
      }))
    } catch {
      return []
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

// 数据库适配器工厂
export function createDatabaseAdapter(): DatabaseAdapter {
  const databaseType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase() as DatabaseType
  
  switch (databaseType) {
    case 'postgresql':
    case 'mysql':
      console.log(`✅ Using Prisma adapter for ${databaseType}`)
      return new PrismaAdapter()
    
    case 'sqlite':
    default:
      console.log('✅ Using SQLite adapter (better-sqlite3)')
      return new SQLiteAdapter()
  }
}

// 全局数据库适配器实例
export const databaseAdapter = createDatabaseAdapter()

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('🔄 Disconnecting database...')
  await databaseAdapter.disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('🔄 Disconnecting database...')
  await databaseAdapter.disconnect()
  process.exit(0)
})