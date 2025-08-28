#!/usr/bin/env tsx

/**
 * 数据库迁移脚本
 * 
 * 功能：
 * - 将现有 SQLite 数据库数据迁移到 Prisma 支持的数据库
 * - 数据完整性验证
 * - 支持回滚操作
 * - 进度显示和错误处理
 * 
 * 使用方法：
 * npm run migrate-data
 * npm run migrate-data -- --target=postgresql
 * npm run migrate-data -- --verify-only
 * npm run migrate-data -- --rollback
 */

import { PrismaClient } from '@prisma/client'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { program } from 'commander'

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
}

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logInfo(message: string) {
  log('blue', `[INFO] ${message}`)
}

function logSuccess(message: string) {
  log('green', `[SUCCESS] ${message}`)
}

function logWarning(message: string) {
  log('yellow', `[WARNING] ${message}`)
}

function logError(message: string) {
  log('red', `[ERROR] ${message}`)
}

function logProgress(message: string) {
  log('cyan', `[PROGRESS] ${message}`)
}

// 数据统计接口
interface DataCounts {
  invitations: number
  exercises: number
  daily_usage: number
  wrong_answers: number
  error_tags: number
  user_weakness: number
  user_difficulty: number
  assessment_history: number
}

// 迁移选项
interface MigrationOptions {
  sourceDbPath: string
  targetDbUrl: string
  verifyOnly: boolean
  rollback: boolean
  verbose: boolean
  batchSize: number
}

class DataMigrator {
  private sourceDb: Database.Database | null = null
  private targetDb: PrismaClient | null = null
  private options: MigrationOptions

  constructor(options: MigrationOptions) {
    this.options = options
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    logInfo('初始化数据库连接...')

    // 检查源数据库文件
    if (!fs.existsSync(this.options.sourceDbPath)) {
      throw new Error(`源数据库文件不存在: ${this.options.sourceDbPath}`)
    }

    // 连接源数据库（SQLite）
    this.sourceDb = new Database(this.options.sourceDbPath, { readonly: true })
    logSuccess('SQLite 源数据库连接成功')

    // 连接目标数据库（Prisma）
    this.targetDb = new PrismaClient({
      datasources: { db: { url: this.options.targetDbUrl } }
    })
    
    try {
      await this.targetDb.$connect()
      logSuccess('Prisma 目标数据库连接成功')
    } catch (error) {
      throw new Error(`目标数据库连接失败: ${error}`)
    }
  }

  /**
   * 获取源数据库数据统计
   */
  getSourceDataCounts(): DataCounts {
    if (!this.sourceDb) throw new Error('源数据库未初始化')

    logInfo('统计源数据库数据量...')

    const counts: DataCounts = {
      invitations: this.sourceDb.prepare('SELECT COUNT(*) as count FROM invitations').get()?.count || 0,
      exercises: this.sourceDb.prepare('SELECT COUNT(*) as count FROM exercises').get()?.count || 0,
      daily_usage: this.sourceDb.prepare('SELECT COUNT(*) as count FROM daily_usage').get()?.count || 0,
      wrong_answers: this.sourceDb.prepare('SELECT COUNT(*) as count FROM wrong_answers').get()?.count || 0,
      error_tags: this.sourceDb.prepare('SELECT COUNT(*) as count FROM error_tags').get()?.count || 0,
      user_weakness: this.sourceDb.prepare('SELECT COUNT(*) as count FROM user_weakness').get()?.count || 0,
      user_difficulty: this.sourceDb.prepare('SELECT COUNT(*) as count FROM user_difficulty').get()?.count || 0,
      assessment_history: this.sourceDb.prepare('SELECT COUNT(*) as count FROM assessment_history').get()?.count || 0
    }

    logInfo('源数据库数据统计：')
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} 条记录`)
    })

    return counts
  }

  /**
   * 获取目标数据库数据统计
   */
  async getTargetDataCounts(): Promise<DataCounts> {
    if (!this.targetDb) throw new Error('目标数据库未初始化')

    logInfo('统计目标数据库数据量...')

    const counts: DataCounts = {
      invitations: await this.targetDb.invitation.count(),
      exercises: await this.targetDb.exercise.count(),
      daily_usage: await this.targetDb.dailyUsage.count(),
      wrong_answers: await this.targetDb.wrongAnswer.count(),
      error_tags: await this.targetDb.errorTag.count(),
      user_weakness: await this.targetDb.userWeakness.count(),
      user_difficulty: await this.targetDb.userDifficulty.count(),
      assessment_history: await this.targetDb.assessmentHistory.count()
    }

    logInfo('目标数据库数据统计：')
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} 条记录`)
    })

    return counts
  }

  /**
   * 迁移邀请码表
   */
  async migrateInvitations(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 invitations 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM invitations ORDER BY created_at')
    const invitations = stmt.all()

    let migratedCount = 0

    for (const invitation of invitations) {
      try {
        await this.targetDb.invitation.upsert({
          where: { code: invitation.code },
          create: {
            code: invitation.code,
            createdAt: new Date(invitation.created_at),
            lastActiveAt: new Date(invitation.last_active_at)
          },
          update: {
            lastActiveAt: new Date(invitation.last_active_at)
          }
        })
        migratedCount++

        if (migratedCount % 100 === 0) {
          logProgress(`已迁移 ${migratedCount}/${invitations.length} 个邀请码`)
        }
      } catch (error) {
        logError(`迁移邀请码 ${invitation.code} 失败: ${error}`)
      }
    }

    logSuccess(`邀请码表迁移完成: ${migratedCount}/${invitations.length}`)
    return migratedCount
  }

  /**
   * 迁移练习记录表
   */
  async migrateExercises(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 exercises 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM exercises ORDER BY created_at')
    const exercises = stmt.all()

    let migratedCount = 0

    for (const exercise of exercises) {
      try {
        await this.targetDb.exercise.upsert({
          where: { id: exercise.id },
          create: {
            id: exercise.id,
            invitationCode: exercise.invitation_code,
            exerciseData: exercise.exercise_data,
            difficulty: exercise.difficulty,
            createdAt: new Date(exercise.created_at)
          },
          update: {
            exerciseData: exercise.exercise_data,
            difficulty: exercise.difficulty
          }
        })
        migratedCount++

        if (migratedCount % 50 === 0) {
          logProgress(`已迁移 ${migratedCount}/${exercises.length} 个练习记录`)
        }
      } catch (error) {
        logError(`迁移练习记录 ${exercise.id} 失败: ${error}`)
      }
    }

    logSuccess(`练习记录表迁移完成: ${migratedCount}/${exercises.length}`)
    return migratedCount
  }

  /**
   * 迁移每日使用量表
   */
  async migrateDailyUsage(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 daily_usage 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM daily_usage ORDER BY date DESC')
    const dailyUsages = stmt.all()

    let migratedCount = 0

    for (const usage of dailyUsages) {
      try {
        await this.targetDb.dailyUsage.upsert({
          where: {
            invitationCode_date: {
              invitationCode: usage.invitation_code,
              date: usage.date
            }
          },
          create: {
            invitationCode: usage.invitation_code,
            date: usage.date,
            usageCount: usage.usage_count
          },
          update: {
            usageCount: usage.usage_count
          }
        })
        migratedCount++

        if (migratedCount % 100 === 0) {
          logProgress(`已迁移 ${migratedCount}/${dailyUsages.length} 条使用记录`)
        }
      } catch (error) {
        logError(`迁移使用记录失败: ${error}`)
      }
    }

    logSuccess(`每日使用量表迁移完成: ${migratedCount}/${dailyUsages.length}`)
    return migratedCount
  }

  /**
   * 迁移错题记录表
   */
  async migrateWrongAnswers(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 wrong_answers 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM wrong_answers ORDER BY created_at DESC')
    const wrongAnswers = stmt.all()

    let migratedCount = 0

    for (const wrongAnswer of wrongAnswers) {
      try {
        await this.targetDb.wrongAnswer.upsert({
          where: { id: wrongAnswer.id },
          create: {
            id: wrongAnswer.id,
            invitationCode: wrongAnswer.invitation_code,
            exerciseId: wrongAnswer.exercise_id,
            questionIndex: wrongAnswer.question_index,
            questionData: wrongAnswer.question_data,
            userAnswer: wrongAnswer.user_answer,
            correctAnswer: wrongAnswer.correct_answer,
            transcriptSnippet: wrongAnswer.transcript_snippet,
            topic: wrongAnswer.topic,
            difficulty: wrongAnswer.difficulty,
            language: wrongAnswer.language || 'en-US',
            tags: wrongAnswer.tags,
            errorAnalysis: wrongAnswer.error_analysis,
            extendedErrorAnalysis: wrongAnswer.extended_error_analysis,
            solutionTips: wrongAnswer.solution_tips,
            highlightingAnnotations: wrongAnswer.highlighting_annotations,
            detailedAnalysisStatus: wrongAnswer.detailed_analysis_status || 'pending',
            createdAt: new Date(wrongAnswer.created_at)
          },
          update: {
            questionData: wrongAnswer.question_data,
            userAnswer: wrongAnswer.user_answer,
            correctAnswer: wrongAnswer.correct_answer,
            transcriptSnippet: wrongAnswer.transcript_snippet,
            errorAnalysis: wrongAnswer.error_analysis,
            extendedErrorAnalysis: wrongAnswer.extended_error_analysis,
            solutionTips: wrongAnswer.solution_tips,
            highlightingAnnotations: wrongAnswer.highlighting_annotations,
            detailedAnalysisStatus: wrongAnswer.detailed_analysis_status || 'pending'
          }
        })
        migratedCount++

        if (migratedCount % 25 === 0) {
          logProgress(`已迁移 ${migratedCount}/${wrongAnswers.length} 条错题记录`)
        }
      } catch (error) {
        logError(`迁移错题记录 ${wrongAnswer.id} 失败: ${error}`)
      }
    }

    logSuccess(`错题记录表迁移完成: ${migratedCount}/${wrongAnswers.length}`)
    return migratedCount
  }

  /**
   * 迁移错误标签表
   */
  async migrateErrorTags(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 error_tags 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM error_tags ORDER BY category, tag_name')
    const errorTags = stmt.all()

    let migratedCount = 0

    for (const tag of errorTags) {
      try {
        await this.targetDb.errorTag.upsert({
          where: { tagName: tag.tag_name },
          create: {
            tagName: tag.tag_name,
            tagNameCn: tag.tag_name_cn,
            category: tag.category,
            description: tag.description,
            color: tag.color
          },
          update: {
            tagNameCn: tag.tag_name_cn,
            category: tag.category,
            description: tag.description,
            color: tag.color
          }
        })
        migratedCount++
      } catch (error) {
        logError(`迁移错误标签 ${tag.tag_name} 失败: ${error}`)
      }
    }

    logSuccess(`错误标签表迁移完成: ${migratedCount}/${errorTags.length}`)
    return migratedCount
  }

  /**
   * 迁移用户薄弱点表
   */
  async migrateUserWeakness(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 user_weakness 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM user_weakness ORDER BY invitation_code, frequency DESC')
    const userWeaknesses = stmt.all()

    let migratedCount = 0

    for (const weakness of userWeaknesses) {
      try {
        await this.targetDb.userWeakness.upsert({
          where: {
            invitationCode_tagName: {
              invitationCode: weakness.invitation_code,
              tagName: weakness.tag_name
            }
          },
          create: {
            invitationCode: weakness.invitation_code,
            tagName: weakness.tag_name,
            frequency: weakness.frequency,
            lastOccurrence: new Date(weakness.last_occurrence),
            improvementRate: weakness.improvement_rate
          },
          update: {
            frequency: weakness.frequency,
            lastOccurrence: new Date(weakness.last_occurrence),
            improvementRate: weakness.improvement_rate
          }
        })
        migratedCount++

        if (migratedCount % 50 === 0) {
          logProgress(`已迁移 ${migratedCount}/${userWeaknesses.length} 条薄弱点记录`)
        }
      } catch (error) {
        logError(`迁移薄弱点记录失败: ${error}`)
      }
    }

    logSuccess(`用户薄弱点表迁移完成: ${migratedCount}/${userWeaknesses.length}`)
    return migratedCount
  }

  /**
   * 迁移用户难度表
   */
  async migrateUserDifficulty(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 user_difficulty 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM user_difficulty ORDER BY test_date DESC')
    const userDifficulties = stmt.all()

    let migratedCount = 0

    for (const difficulty of userDifficulties) {
      try {
        await this.targetDb.userDifficulty.upsert({
          where: { invitationCode: difficulty.invitation_code },
          create: {
            invitationCode: difficulty.invitation_code,
            difficultyLevel: difficulty.difficulty_level,
            testDate: new Date(difficulty.test_date),
            scores: difficulty.scores
          },
          update: {
            difficultyLevel: difficulty.difficulty_level,
            testDate: new Date(difficulty.test_date),
            scores: difficulty.scores
          }
        })
        migratedCount++
      } catch (error) {
        logError(`迁移用户难度记录 ${difficulty.invitation_code} 失败: ${error}`)
      }
    }

    logSuccess(`用户难度表迁移完成: ${migratedCount}/${userDifficulties.length}`)
    return migratedCount
  }

  /**
   * 迁移评估历史表
   */
  async migrateAssessmentHistory(): Promise<number> {
    if (!this.sourceDb || !this.targetDb) throw new Error('数据库未初始化')

    logProgress('迁移 assessment_history 表...')

    const stmt = this.sourceDb.prepare('SELECT * FROM assessment_history ORDER BY test_date DESC')
    const assessmentHistories = stmt.all()

    let migratedCount = 0

    for (const history of assessmentHistories) {
      try {
        await this.targetDb.assessmentHistory.create({
          data: {
            invitationCode: history.invitation_code,
            testDate: new Date(history.test_date),
            scores: history.scores,
            finalDifficulty: history.final_difficulty
          }
        })
        migratedCount++

        if (migratedCount % 25 === 0) {
          logProgress(`已迁移 ${migratedCount}/${assessmentHistories.length} 条评估历史`)
        }
      } catch (error) {
        if (error.code !== 'P2002') { // 忽略重复键错误
          logError(`迁移评估历史记录失败: ${error}`)
        }
      }
    }

    logSuccess(`评估历史表迁移完成: ${migratedCount}/${assessmentHistories.length}`)
    return migratedCount
  }

  /**
   * 执行完整数据迁移
   */
  async migrate(): Promise<void> {
    logInfo('开始数据库迁移...')

    const sourceCounts = this.getSourceDataCounts()
    const totalRecords = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0)
    
    if (totalRecords === 0) {
      logWarning('源数据库为空，无需迁移')
      return
    }

    logInfo(`准备迁移 ${totalRecords} 条记录`)

    // 按依赖关系顺序迁移表
    const migrationResults = {
      invitations: await this.migrateInvitations(),
      errorTags: await this.migrateErrorTags(),
      exercises: await this.migrateExercises(),
      dailyUsage: await this.migrateDailyUsage(),
      wrongAnswers: await this.migrateWrongAnswers(),
      userWeakness: await this.migrateUserWeakness(),
      userDifficulty: await this.migrateUserDifficulty(),
      assessmentHistory: await this.migrateAssessmentHistory()
    }

    // 汇总迁移结果
    const totalMigrated = Object.values(migrationResults).reduce((sum, count) => sum + count, 0)
    
    logInfo('\n=== 迁移结果汇总 ===')
    Object.entries(migrationResults).forEach(([table, count]) => {
      console.log(`${table}: ${count} 条记录`)
    })
    console.log(`总计: ${totalMigrated}/${totalRecords} 条记录`)

    if (totalMigrated === totalRecords) {
      logSuccess('✅ 数据迁移完成！所有数据已成功迁移')
    } else {
      logWarning(`⚠️  数据迁移部分完成：${totalMigrated}/${totalRecords} 条记录`)
    }
  }

  /**
   * 验证数据一致性
   */
  async verifyData(): Promise<boolean> {
    logInfo('开始数据一致性验证...')

    const sourceCounts = this.getSourceDataCounts()
    const targetCounts = await this.getTargetDataCounts()

    let allMatch = true

    logInfo('\n=== 数据一致性对比 ===')
    Object.keys(sourceCounts).forEach(table => {
      const sourceCount = sourceCounts[table as keyof DataCounts]
      const targetCount = targetCounts[table as keyof DataCounts]
      const match = sourceCount === targetCount

      if (match) {
        console.log(`✅ ${table}: ${sourceCount} = ${targetCount}`)
      } else {
        console.log(`❌ ${table}: ${sourceCount} ≠ ${targetCount}`)
        allMatch = false
      }
    })

    if (allMatch) {
      logSuccess('✅ 数据一致性验证通过')
    } else {
      logError('❌ 数据一致性验证失败')
    }

    return allMatch
  }

  /**
   * 清空目标数据库
   */
  async clearTargetDatabase(): Promise<void> {
    if (!this.targetDb) throw new Error('目标数据库未初始化')

    logWarning('清空目标数据库...')

    // 按依赖关系逆序删除
    await this.targetDb.assessmentHistory.deleteMany({})
    await this.targetDb.userDifficulty.deleteMany({})
    await this.targetDb.userWeakness.deleteMany({})
    await this.targetDb.wrongAnswer.deleteMany({})
    await this.targetDb.dailyUsage.deleteMany({})
    await this.targetDb.exercise.deleteMany({})
    await this.targetDb.errorTag.deleteMany({})
    await this.targetDb.invitation.deleteMany({})

    logSuccess('目标数据库已清空')
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.sourceDb) {
      this.sourceDb.close()
      logInfo('SQLite 连接已关闭')
    }

    if (this.targetDb) {
      await this.targetDb.$disconnect()
      logInfo('Prisma 连接已断开')
    }
  }
}

// 主程序
async function main() {
  program
    .name('migrate-data')
    .description('数据库迁移工具')
    .option('--source <path>', '源数据库路径', './data/app.db')
    .option('--target <url>', '目标数据库URL', process.env.DATABASE_URL || '')
    .option('--verify-only', '仅验证数据一致性', false)
    .option('--rollback', '回滚操作（清空目标数据库）', false)
    .option('--verbose', '详细输出', false)
    .option('--batch-size <size>', '批处理大小', '100')
    .parse()

  const opts = program.opts()

  if (!opts.target) {
    logError('请设置目标数据库 URL（--target 或 DATABASE_URL 环境变量）')
    process.exit(1)
  }

  const options: MigrationOptions = {
    sourceDbPath: path.resolve(opts.source),
    targetDbUrl: opts.target,
    verifyOnly: opts.verifyOnly,
    rollback: opts.rollback,
    verbose: opts.verbose,
    batchSize: parseInt(opts.batchSize)
  }

  const migrator = new DataMigrator(options)

  try {
    await migrator.initialize()

    if (options.rollback) {
      await migrator.clearTargetDatabase()
      logSuccess('回滚操作完成')
    } else if (options.verifyOnly) {
      const isValid = await migrator.verifyData()
      process.exit(isValid ? 0 : 1)
    } else {
      await migrator.migrate()
      await migrator.verifyData()
    }

  } catch (error) {
    logError(`迁移失败: ${error}`)
    process.exit(1)
  } finally {
    await migrator.close()
  }
}

// 运行主程序
if (require.main === module) {
  main().catch((error) => {
    logError(`程序异常: ${error}`)
    process.exit(1)
  })
}