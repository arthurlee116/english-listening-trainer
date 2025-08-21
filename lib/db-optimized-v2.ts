/**
 * 优化版数据库操作模块 V2
 * 实现索引优化、查询性能提升、数据结构改进
 */

import Database, { Transaction } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { Exercise } from './types'

const dbPath = path.join(process.cwd(), 'data', 'app.db')

// 确保数据目录存在
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 优化的数据库连接配置
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  timeout: 10000,
  fileMustExist: false
})

// 配置数据库性能选项
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('cache_size = 2000')
db.pragma('temp_store = memory')
db.pragma('mmap_size = 268435456') // 256MB
db.pragma('foreign_keys = ON')

// 性能监控接口
interface QueryMetrics {
  queryName: string
  executionTime: number
  rowsAffected: number
  timestamp: Date
}

class DatabaseMetrics {
  private static metrics: QueryMetrics[] = []
  
  static recordQuery(queryName: string, startTime: number, rowsAffected: number = 0) {
    this.metrics.push({
      queryName,
      executionTime: Date.now() - startTime,
      rowsAffected,
      timestamp: new Date()
    })
    
    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }
  
  static getMetrics() {
    return this.metrics
  }
  
  static getSlowQueries(thresholdMs: number = 100) {
    return this.metrics.filter(m => m.executionTime > thresholdMs)
  }
}

// 查询性能装饰器
function measureQuery(queryName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = function (...args: any[]) {
      const startTime = Date.now()
      const result = originalMethod.apply(this, args)
      
      const rowsAffected = result?.changes || result?.length || 0
      DatabaseMetrics.recordQuery(queryName, startTime, rowsAffected)
      
      return result
    }
    
    return descriptor
  }
}

// 优化的数据库操作类
export class OptimizedDbOperations {
  private prepared: Map<string, any> = new Map()

  constructor() {
    this.initializeOptimizedDatabase()
    this.prepareStatements()
  }

  // 初始化优化的数据库结构
  private initializeOptimizedDatabase(): void {
    const initTransaction = db.transaction(() => {
      // 创建优化的邀请码表
      db.exec(`
        CREATE TABLE IF NOT EXISTS invitations (
          code TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1,
          max_daily_usage INTEGER DEFAULT 5,
          total_usage_count INTEGER DEFAULT 0
        )
      `)

      // 创建优化的练习记录表
      db.exec(`
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          invitation_code TEXT NOT NULL,
          exercise_data TEXT NOT NULL,
          difficulty TEXT NOT NULL CHECK (difficulty IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
          topic TEXT NOT NULL,
          question_count INTEGER DEFAULT 0,
          correct_count INTEGER DEFAULT 0,
          score REAL DEFAULT 0.0,
          duration_seconds INTEGER DEFAULT 0,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE
        )
      `)

      // 创建优化的每日使用表
      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invitation_code TEXT NOT NULL,
          date TEXT NOT NULL,
          date_int INTEGER NOT NULL, -- YYYYMMDD格式，便于索引
          usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0 AND usage_count <= 20),
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE,
          UNIQUE (invitation_code, date)
        )
      `)

      // 创建规范化的错题标签关联表
      db.exec(`
        CREATE TABLE IF NOT EXISTS wrong_answer_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wrong_answer_id TEXT NOT NULL,
          tag_name TEXT NOT NULL,
          confidence_score REAL DEFAULT 1.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (wrong_answer_id) REFERENCES wrong_answers (id) ON DELETE CASCADE,
          FOREIGN KEY (tag_name) REFERENCES error_tags (tag_name) ON DELETE CASCADE,
          UNIQUE(wrong_answer_id, tag_name)
        )
      `)

      // 创建优化的错题记录表
      db.exec(`
        CREATE TABLE IF NOT EXISTS wrong_answers (
          id TEXT PRIMARY KEY,
          invitation_code TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          question_index INTEGER NOT NULL,
          question_data TEXT NOT NULL,
          user_answer TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          transcript_snippet TEXT,
          topic TEXT,
          difficulty TEXT CHECK (difficulty IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
          error_analysis TEXT,
          extended_error_analysis TEXT,
          solution_tips TEXT,
          highlighting_annotations TEXT,
          detailed_analysis_status TEXT DEFAULT 'pending' 
            CHECK (detailed_analysis_status IN ('pending', 'generating', 'completed', 'failed')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
        )
      `)

      // 创建用户统计汇总表（物化视图）
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_statistics (
          invitation_code TEXT PRIMARY KEY,
          total_exercises INTEGER DEFAULT 0,
          total_wrong_answers INTEGER DEFAULT 0,
          accuracy_rate REAL DEFAULT 0.0,
          most_difficult_topic TEXT,
          most_frequent_error_tag TEXT,
          avg_score REAL DEFAULT 0.0,
          total_study_time INTEGER DEFAULT 0,
          last_activity_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE
        )
      `)

      // 创建标签统计表
      db.exec(`
        CREATE TABLE IF NOT EXISTS tag_statistics (
          tag_name TEXT,
          invitation_code TEXT,
          occurrence_count INTEGER DEFAULT 0,
          last_occurrence DATETIME,
          improvement_trend REAL DEFAULT 0.0,
          PRIMARY KEY (tag_name, invitation_code),
          FOREIGN KEY (tag_name) REFERENCES error_tags (tag_name) ON DELETE CASCADE,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE
        )
      `)

      this.createOptimizedIndexes()
      this.createTriggers()
    })

    initTransaction()
    console.log('✅ Optimized database structure initialized')
  }

  // 创建优化的索引
  private createOptimizedIndexes(): void {
    // 复合索引 - 高频查询优化
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_invitations_verification 
      ON invitations(code, is_active, last_active_at);
      
      CREATE INDEX IF NOT EXISTS idx_exercises_user_date 
      ON exercises(invitation_code, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_exercises_difficulty_topic 
      ON exercises(difficulty, topic, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_daily_usage_optimization 
      ON daily_usage(invitation_code, date_int, usage_count);
      
      CREATE INDEX IF NOT EXISTS idx_wrong_answers_user_date 
      ON wrong_answers(invitation_code, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_wrong_answers_status_cover 
      ON wrong_answers(detailed_analysis_status, invitation_code, created_at);
      
      CREATE INDEX IF NOT EXISTS idx_wrong_answers_analysis 
      ON wrong_answers(exercise_id, difficulty, topic);
    `)

    // 新表索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wat_wrong_answer 
      ON wrong_answer_tags(wrong_answer_id);
      
      CREATE INDEX IF NOT EXISTS idx_wat_tag_name 
      ON wrong_answer_tags(tag_name);
      
      CREATE INDEX IF NOT EXISTS idx_wat_confidence 
      ON wrong_answer_tags(tag_name, confidence_score DESC);
      
      CREATE INDEX IF NOT EXISTS idx_user_stats_activity 
      ON user_statistics(last_activity_date DESC);
      
      CREATE INDEX IF NOT EXISTS idx_tag_stats_count 
      ON tag_statistics(invitation_code, occurrence_count DESC);
    `)

    console.log('✅ Optimized indexes created')
  }

  // 创建自动维护触发器
  private createTriggers(): void {
    // 自动更新时间戳
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_invitations_timestamp 
        AFTER UPDATE ON invitations
        BEGIN
          UPDATE invitations SET updated_at = CURRENT_TIMESTAMP WHERE code = NEW.code;
        END;
        
      CREATE TRIGGER IF NOT EXISTS update_exercises_timestamp 
        AFTER UPDATE ON exercises
        BEGIN
          UPDATE exercises SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        
      CREATE TRIGGER IF NOT EXISTS update_wrong_answers_timestamp 
        AFTER UPDATE ON wrong_answers
        BEGIN
          UPDATE wrong_answers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `)

    // 自动更新用户统计
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_user_stats_on_exercise
        AFTER INSERT ON exercises
        BEGIN
          INSERT OR REPLACE INTO user_statistics (
            invitation_code, total_exercises, avg_score, last_activity_date, updated_at
          ) 
          SELECT 
            NEW.invitation_code,
            COUNT(*),
            AVG(score),
            MAX(created_at),
            CURRENT_TIMESTAMP
          FROM exercises 
          WHERE invitation_code = NEW.invitation_code;
        END;
        
      CREATE TRIGGER IF NOT EXISTS update_user_stats_on_wrong_answer
        AFTER INSERT ON wrong_answers
        BEGIN
          UPDATE user_statistics 
          SET 
            total_wrong_answers = (
              SELECT COUNT(*) FROM wrong_answers 
              WHERE invitation_code = NEW.invitation_code
            ),
            accuracy_rate = CASE 
              WHEN total_exercises > 0 THEN 
                1.0 - (CAST(total_wrong_answers AS REAL) / (total_exercises * 5.0))
              ELSE 0.0 
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE invitation_code = NEW.invitation_code;
        END;
    `)

    // 自动更新标签统计
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_tag_stats_on_wrong_answer_tag
        AFTER INSERT ON wrong_answer_tags
        BEGIN
          INSERT OR REPLACE INTO tag_statistics (
            tag_name, invitation_code, occurrence_count, last_occurrence
          )
          SELECT 
            NEW.tag_name,
            (SELECT invitation_code FROM wrong_answers WHERE id = NEW.wrong_answer_id),
            COUNT(*),
            MAX(wat.created_at)
          FROM wrong_answer_tags wat
          JOIN wrong_answers wa ON wat.wrong_answer_id = wa.id
          WHERE wat.tag_name = NEW.tag_name 
            AND wa.invitation_code = (SELECT invitation_code FROM wrong_answers WHERE id = NEW.wrong_answer_id);
        END;
    `)

    console.log('✅ Database triggers created')
  }

  // 预编译常用查询语句
  private prepareStatements(): void {
    this.prepared.set('verifyInvitation', db.prepare(`
      SELECT code, is_active, max_daily_usage, total_usage_count 
      FROM invitations 
      WHERE code = ? AND is_active = 1
    `))

    this.prepared.set('getTodayUsage', db.prepare(`
      SELECT usage_count 
      FROM daily_usage 
      WHERE invitation_code = ? AND date_int = ?
    `))

    this.prepared.set('incrementUsage', db.prepare(`
      INSERT INTO daily_usage (invitation_code, date, date_int, usage_count, last_updated) 
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(invitation_code, date) 
      DO UPDATE SET 
        usage_count = usage_count + 1,
        last_updated = CURRENT_TIMESTAMP
    `))

    this.prepared.set('getExerciseHistory', db.prepare(`
      SELECT id, difficulty, topic, score, completed_at, question_count, correct_count
      FROM exercises 
      WHERE invitation_code = ? 
        AND (completed_at < ? OR (completed_at = ? AND id < ?))
      ORDER BY completed_at DESC, id DESC
      LIMIT ?
    `))

    this.prepared.set('getWrongAnswersOptimized', db.prepare(`
      WITH wrong_answer_details AS (
        SELECT 
          wa.id,
          wa.question_data,
          wa.user_answer,
          wa.correct_answer,
          wa.transcript_snippet,
          wa.topic,
          wa.difficulty,
          wa.error_analysis,
          wa.extended_error_analysis,
          wa.solution_tips,
          wa.created_at,
          GROUP_CONCAT(et.tag_name_cn) as tag_names,
          GROUP_CONCAT(et.color) as tag_colors,
          GROUP_CONCAT(wat.confidence_score) as confidence_scores
        FROM wrong_answers wa
        LEFT JOIN wrong_answer_tags wat ON wa.id = wat.wrong_answer_id
        LEFT JOIN error_tags et ON wat.tag_name = et.tag_name
        WHERE wa.invitation_code = ?
          AND (wa.created_at < ? OR (wa.created_at = ? AND wa.id < ?))
        GROUP BY wa.id
        ORDER BY wa.created_at DESC, wa.id DESC
        LIMIT ?
      )
      SELECT * FROM wrong_answer_details
    `))

    this.prepared.set('getUserStatistics', db.prepare(`
      SELECT * FROM user_statistics WHERE invitation_code = ?
    `))

    console.log('✅ Prepared statements compiled')
  }

  // 验证邀请码 - 优化版
  @measureQuery('verifyInvitation')
  verifyInvitationCode(code: string): boolean {
    try {
      const result = this.prepared.get('verifyInvitation').get(code)
      
      if (result) {
        // 更新最后活跃时间
        db.prepare('UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP WHERE code = ?').run(code)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to verify invitation code:', error)
      return false
    }
  }

  // 增加使用次数 - 优化版
  @measureQuery('incrementUsage')
  incrementUsageCount(invitationCode: string): { success: boolean; todayUsage: number; remainingUsage: number } {
    const transaction = db.transaction(() => {
      const today = new Date().toISOString().split('T')[0]
      const todayInt = parseInt(today.replace(/-/g, ''))
      
      // 获取当前使用次数和限制
      const invitation = this.prepared.get('verifyInvitation').get(invitationCode)
      if (!invitation) {
        return { success: false, todayUsage: 0, remainingUsage: 0 }
      }
      
      const currentUsage = this.prepared.get('getTodayUsage').get(invitationCode, todayInt)
      const currentCount = currentUsage?.usage_count || 0
      const maxUsage = invitation.max_daily_usage || 5
      
      if (currentCount >= maxUsage) {
        return { success: false, todayUsage: currentCount, remainingUsage: 0 }
      }

      // 原子性增加使用次数
      this.prepared.get('incrementUsage').run(invitationCode, today, todayInt)

      const newCount = currentCount + 1
      return { 
        success: true, 
        todayUsage: newCount, 
        remainingUsage: Math.max(0, maxUsage - newCount) 
      }
    })

    return transaction()
  }

  // 保存练习记录 - 优化版
  @measureQuery('saveExercise')
  saveExercise(exercise: Exercise, invitationCode: string): boolean {
    const transaction = db.transaction(() => {
      // 数据验证
      if (!exercise.id || !exercise.difficulty || !exercise.topic) {
        throw new Error('Exercise data validation failed')
      }

      // 计算统计数据
      const questionCount = exercise.questions?.length || 0
      const correctCount = exercise.questions?.filter(q => q.isCorrect)?.length || 0
      const score = questionCount > 0 ? (correctCount / questionCount) : 0

      // 保存练习记录
      db.prepare(`
        INSERT INTO exercises (
          id, invitation_code, exercise_data, difficulty, topic,
          question_count, correct_count, score, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        exercise.id,
        invitationCode,
        JSON.stringify(exercise),
        exercise.difficulty,
        exercise.topic,
        questionCount,
        correctCount,
        score,
        exercise.duration || 0
      )

      return true
    })

    return transaction()
  }

  // 保存错题记录 - 优化版（规范化存储）
  @measureQuery('saveWrongAnswer')
  saveWrongAnswerOptimized(wrongAnswer: {
    id: string
    invitation_code: string
    exercise_id: string
    question_index: number
    question_data: any
    user_answer: string
    correct_answer: string
    transcript_snippet?: string
    topic: string
    difficulty: string
    tags: Array<{tag_name: string, confidence?: number}>
    error_analysis?: string
  }): boolean {
    const transaction = db.transaction(() => {
      // 保存错题记录（不包含tags）
      db.prepare(`
        INSERT INTO wrong_answers (
          id, invitation_code, exercise_id, question_index, 
          question_data, user_answer, correct_answer, 
          transcript_snippet, topic, difficulty, error_analysis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wrongAnswer.id,
        wrongAnswer.invitation_code,
        wrongAnswer.exercise_id,
        wrongAnswer.question_index,
        JSON.stringify(wrongAnswer.question_data),
        wrongAnswer.user_answer,
        wrongAnswer.correct_answer,
        wrongAnswer.transcript_snippet,
        wrongAnswer.topic,
        wrongAnswer.difficulty,
        wrongAnswer.error_analysis
      )

      // 保存标签关联（规范化存储）
      const insertTag = db.prepare(`
        INSERT INTO wrong_answer_tags (wrong_answer_id, tag_name, confidence_score)
        VALUES (?, ?, ?)
      `)

      for (const tag of wrongAnswer.tags) {
        insertTag.run(wrongAnswer.id, tag.tag_name, tag.confidence || 1.0)
      }

      return true
    })

    return transaction()
  }

  // 获取练习历史 - 游标分页优化
  @measureQuery('getExerciseHistory')
  getExerciseHistoryOptimized(
    invitationCode: string, 
    limit: number = 10,
    cursor?: { completed_at: string, id: string }
  ): {
    exercises: any[]
    nextCursor?: { completed_at: string, id: string }
    hasMore: boolean
  } {
    const cursorDate = cursor?.completed_at || new Date().toISOString()
    const cursorId = cursor?.id || ''

    const results = this.prepared.get('getExerciseHistory')
      .all(invitationCode, cursorDate, cursorDate, cursorId, limit + 1)

    const hasMore = results.length > limit
    const exercises = hasMore ? results.slice(0, -1) : results

    const nextCursor = hasMore && exercises.length > 0 ? {
      completed_at: exercises[exercises.length - 1].completed_at,
      id: exercises[exercises.length - 1].id
    } : undefined

    return { exercises, nextCursor, hasMore }
  }

  // 获取错题列表 - 优化版（解决N+1问题）
  @measureQuery('getWrongAnswers')
  getWrongAnswersOptimized(
    invitationCode: string,
    limit: number = 10,
    cursor?: { created_at: string, id: string }
  ): {
    wrongAnswers: any[]
    nextCursor?: { created_at: string, id: string }
    hasMore: boolean
  } {
    const cursorDate = cursor?.created_at || new Date().toISOString()
    const cursorId = cursor?.id || ''

    const results = this.prepared.get('getWrongAnswersOptimized')
      .all(invitationCode, cursorDate, cursorDate, cursorId, limit + 1)

    const hasMore = results.length > limit
    const wrongAnswers = hasMore ? results.slice(0, -1) : results

    // 处理标签数据
    const processedWrongAnswers = wrongAnswers.map(wa => ({
      ...wa,
      question_data: JSON.parse(wa.question_data),
      tags: wa.tag_names ? wa.tag_names.split(',').map((name: string, index: number) => ({
        tag_name_cn: name,
        color: wa.tag_colors?.split(',')[index],
        confidence_score: parseFloat(wa.confidence_scores?.split(',')[index] || '1.0')
      })) : []
    }))

    const nextCursor = hasMore && wrongAnswers.length > 0 ? {
      created_at: wrongAnswers[wrongAnswers.length - 1].created_at,
      id: wrongAnswers[wrongAnswers.length - 1].id
    } : undefined

    return { wrongAnswers: processedWrongAnswers, nextCursor, hasMore }
  }

  // 获取用户完整统计 - 一次查询版本
  @measureQuery('getUserStatistics')
  getUserStatisticsOptimized(invitationCode: string): any {
    const stats = this.prepared.get('getUserStatistics').get(invitationCode)
    
    if (!stats) {
      // 如果统计表中没有数据，实时计算并插入
      const realTimeStats = db.prepare(`
        INSERT OR REPLACE INTO user_statistics (
          invitation_code, total_exercises, total_wrong_answers, 
          accuracy_rate, avg_score, last_activity_date
        )
        SELECT 
          ?,
          COUNT(DISTINCT e.id),
          COUNT(DISTINCT wa.id),
          CASE 
            WHEN COUNT(DISTINCT e.id) > 0 THEN 
              1.0 - (CAST(COUNT(DISTINCT wa.id) AS REAL) / (COUNT(DISTINCT e.id) * 5.0))
            ELSE 0.0 
          END,
          AVG(e.score),
          MAX(e.completed_at)
        FROM invitations i
        LEFT JOIN exercises e ON i.code = e.invitation_code
        LEFT JOIN wrong_answers wa ON i.code = wa.invitation_code
        WHERE i.code = ?
      `).run(invitationCode, invitationCode)

      return this.prepared.get('getUserStatistics').get(invitationCode)
    }

    return stats
  }

  // 获取标签统计 - 优化版
  @measureQuery('getTagStatistics')
  getTagStatistics(invitationCode: string): any[] {
    return db.prepare(`
      SELECT 
        ts.tag_name,
        et.tag_name_cn,
        et.category,
        et.color,
        ts.occurrence_count,
        ts.last_occurrence,
        ts.improvement_trend
      FROM tag_statistics ts
      JOIN error_tags et ON ts.tag_name = et.tag_name
      WHERE ts.invitation_code = ?
      ORDER BY ts.occurrence_count DESC, ts.last_occurrence DESC
    `).all(invitationCode)
  }

  // 性能监控方法
  getPerformanceMetrics() {
    return {
      queryMetrics: DatabaseMetrics.getMetrics(),
      slowQueries: DatabaseMetrics.getSlowQueries(100),
      avgExecutionTime: DatabaseMetrics.getMetrics().reduce((sum, m) => sum + m.executionTime, 0) / DatabaseMetrics.getMetrics().length || 0
    }
  }

  // 数据库维护方法
  @measureQuery('maintenance')
  performMaintenance(): {
    analyzedTables: number
    reindexedTables: number
    cleanedRows: number
  } {
    const transaction = db.transaction(() => {
      // 更新统计信息
      db.exec('ANALYZE')
      
      // 重建索引
      db.exec('REINDEX')
      
      // 清理无效数据
      const cleanupResult = db.prepare(`
        DELETE FROM wrong_answers 
        WHERE exercise_id NOT IN (SELECT id FROM exercises)
      `).run()

      return {
        analyzedTables: 7,
        reindexedTables: 15,
        cleanedRows: cleanupResult.changes
      }
    })

    return transaction()
  }

  // 健康检查
  healthCheck(): {
    isHealthy: boolean
    dbSize: number
    tableCount: number
    indexCount: number
    lastMaintenance?: Date
  } {
    try {
      const dbSizeResult = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as {size: number}
      const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as {count: number}
      const indexCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as {count: number}

      return {
        isHealthy: true,
        dbSize: dbSizeResult.size,
        tableCount: tableCount.count,
        indexCount: indexCount.count
      }
    } catch (error) {
      return {
        isHealthy: false,
        dbSize: 0,
        tableCount: 0,
        indexCount: 0
      }
    }
  }
}

// 导出优化的数据库操作实例
export const optimizedDb = new OptimizedDbOperations()

// 优雅关闭处理
process.on('exit', () => {
  db.close()
})

process.on('SIGINT', () => {
  db.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  db.close()
  process.exit(0)
})

export default optimizedDb