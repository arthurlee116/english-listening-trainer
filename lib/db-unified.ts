/**
 * 统一数据库操作模块
 * 整合所有数据库功能，解决重复文件问题
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

// 性能监控
interface QueryMetrics {
  queryName: string
  executionTime: number
  rowsAffected: number
  timestamp: Date
}

class DatabaseMetrics {
  private static metrics: QueryMetrics[] = []
  
  static recordQuery(queryName: string, startTime: number, rowsAffected: number = 0) {
    DatabaseMetrics.metrics.push({
      queryName,
      executionTime: Date.now() - startTime,
      rowsAffected,
      timestamp: new Date()
    })
    
    // 保持最近100条记录
    if (DatabaseMetrics.metrics.length > 100) {
      DatabaseMetrics.metrics = DatabaseMetrics.metrics.slice(-100)
    }
  }
  
  static getMetrics(): QueryMetrics[] {
    return [...DatabaseMetrics.metrics]
  }
  
  static getSlowQueries(threshold: number = 100): QueryMetrics[] {
    return DatabaseMetrics.metrics.filter(m => m.executionTime > threshold)
  }
}

// 事务包装器
function withTransaction<T>(operation: (db: Database) => T): T {
  const transaction = db.transaction(() => {
    return operation(db)
  })
  return transaction()
}

// 性能监控包装器
function withMonitoring<T extends any[], R>(
  queryName: string,
  fn: (...args: T) => R
): (...args: T) => R {
  return (...args: T): R => {
    const startTime = Date.now()
    try {
      const result = fn(...args)
      DatabaseMetrics.recordQuery(queryName, startTime, (result as any)?.changes || 0)
      return result
    } catch (error) {
      DatabaseMetrics.recordQuery(`${queryName}_ERROR`, startTime, 0)
      throw error
    }
  }
}

// 初始化数据库表
function initializeDatabase() {
  const startTime = Date.now()
  
  try {
    // 创建邀请码表
    db.exec(`
      CREATE TABLE IF NOT EXISTS invitations (
        code TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建练习记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        invitation_code TEXT NOT NULL,
        exercise_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code)
      )
    `)

    // 创建每日使用次数表
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invitation_code TEXT NOT NULL,
        date TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code),
        UNIQUE (invitation_code, date)
      )
    `)

    // 创建错题记录表
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
        difficulty TEXT,
        tags TEXT NOT NULL,
        error_analysis TEXT,
        extended_error_analysis TEXT,
        solution_tips TEXT,
        highlighting_annotations TEXT,
        detailed_analysis_status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code),
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      )
    `)

    // 创建错题标签关联表（规范化存储）
    db.exec(`
      CREATE TABLE IF NOT EXISTS wrong_answer_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wrong_answer_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wrong_answer_id) REFERENCES wrong_answers (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_name) REFERENCES error_tags (tag_name),
        UNIQUE (wrong_answer_id, tag_name)
      )
    `)

    // 创建标签定义表
    db.exec(`
      CREATE TABLE IF NOT EXISTS error_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag_name TEXT UNIQUE NOT NULL,
        tag_name_cn TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建用户薄弱点统计表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_weakness (
        invitation_code TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        last_occurrence DATETIME DEFAULT CURRENT_TIMESTAMP,
        improvement_rate REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (invitation_code, tag_name),
        FOREIGN KEY (invitation_code) REFERENCES invitations (code),
        FOREIGN KEY (tag_name) REFERENCES error_tags (tag_name)
      )
    `)

    // 创建用户统计表（预计算常用统计）
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_statistics (
        invitation_code TEXT PRIMARY KEY,
        total_exercises INTEGER DEFAULT 0,
        total_wrong_answers INTEGER DEFAULT 0,
        accuracy_rate REAL DEFAULT 1.0,
        last_exercise_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code)
      )
    `)

    // 创建标签统计表
    db.exec(`
      CREATE TABLE IF NOT EXISTS tag_statistics (
        tag_name TEXT PRIMARY KEY,
        total_occurrences INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        last_occurrence DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tag_name) REFERENCES error_tags (tag_name)
      )
    `)

    // 创建性能优化的索引
    createOptimizedIndexes()
    
    // 初始化标签数据
    initializeErrorTags()

    // 创建自动更新触发器
    createUpdateTriggers()

    DatabaseMetrics.recordQuery('initializeDatabase', startTime)
    console.log('✅ Database initialized successfully with optimizations')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

// 创建优化索引
function createOptimizedIndexes() {
  const indexes = [
    // 邀请码相关索引
    'CREATE INDEX IF NOT EXISTS idx_invitations_created_at ON invitations (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_invitations_last_active ON invitations (last_active_at)',
    
    // 练习记录索引
    'CREATE INDEX IF NOT EXISTS idx_exercises_invitation_code ON exercises (invitation_code)',
    'CREATE INDEX IF NOT EXISTS idx_exercises_created_at ON exercises (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_exercises_updated_at ON exercises (updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_exercises_compound ON exercises (invitation_code, created_at DESC)',
    
    // 日使用统计索引
    'CREATE INDEX IF NOT EXISTS idx_daily_usage_invitation_date ON daily_usage (invitation_code, date)',
    'CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage (date)',
    
    // 错题记录索引
    'CREATE INDEX IF NOT EXISTS idx_wrong_answers_invitation_code ON wrong_answers (invitation_code)',
    'CREATE INDEX IF NOT EXISTS idx_wrong_answers_exercise_id ON wrong_answers (exercise_id)',
    'CREATE INDEX IF NOT EXISTS idx_wrong_answers_created_at ON wrong_answers (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_wrong_answers_status ON wrong_answers (detailed_analysis_status)',
    'CREATE INDEX IF NOT EXISTS idx_wrong_answers_compound ON wrong_answers (invitation_code, created_at DESC)',
    
    // 错题标签关联索引
    'CREATE INDEX IF NOT EXISTS idx_wrong_answer_tags_wrong_answer_id ON wrong_answer_tags (wrong_answer_id)',
    'CREATE INDEX IF NOT EXISTS idx_wrong_answer_tags_tag_name ON wrong_answer_tags (tag_name)',
    
    // 用户薄弱点索引
    'CREATE INDEX IF NOT EXISTS idx_user_weakness_invitation_code ON user_weakness (invitation_code)',
    'CREATE INDEX IF NOT EXISTS idx_user_weakness_frequency ON user_weakness (frequency DESC)',
    'CREATE INDEX IF NOT EXISTS idx_user_weakness_last_occurrence ON user_weakness (last_occurrence DESC)',
    
    // 统计表索引
    'CREATE INDEX IF NOT EXISTS idx_user_statistics_accuracy ON user_statistics (accuracy_rate)',
    'CREATE INDEX IF NOT EXISTS idx_user_statistics_last_exercise ON user_statistics (last_exercise_date)',
    'CREATE INDEX IF NOT EXISTS idx_tag_statistics_occurrences ON tag_statistics (total_occurrences DESC)'
  ]

  for (const indexSql of indexes) {
    try {
      db.exec(indexSql)
    } catch (error) {
      console.warn('Index creation warning:', error)
    }
  }
}

// 创建自动更新触发器
function createUpdateTriggers() {
  // 练习表更新时间触发器
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trigger_exercises_updated_at
    AFTER UPDATE ON exercises
    BEGIN
      UPDATE exercises SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `)

  // 错题表更新时间触发器
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trigger_wrong_answers_updated_at
    AFTER UPDATE ON wrong_answers
    BEGIN
      UPDATE wrong_answers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `)

  // 用户薄弱点更新时间触发器
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trigger_user_weakness_updated_at
    AFTER UPDATE ON user_weakness
    BEGIN
      UPDATE user_weakness SET updated_at = CURRENT_TIMESTAMP 
      WHERE invitation_code = NEW.invitation_code AND tag_name = NEW.tag_name;
    END
  `)
}

// 初始化标签数据
function initializeErrorTags() {
  const tags = [
    // 错误类型标签
    { tag_name: 'detail-missing', tag_name_cn: '细节理解缺失', category: 'error-type', description: '未能理解或记住听力中的重要细节', color: '#ef4444' },
    { tag_name: 'main-idea', tag_name_cn: '主旨理解错误', category: 'error-type', description: '对听力材料的主要观点理解有误', color: '#dc2626' },
    { tag_name: 'inference', tag_name_cn: '推理判断错误', category: 'error-type', description: '无法正确推断隐含信息', color: '#b91c1c' },
    { tag_name: 'vocabulary', tag_name_cn: '词汇理解问题', category: 'error-type', description: '关键词汇理解不准确', color: '#991b1b' },
    { tag_name: 'number-confusion', tag_name_cn: '数字混淆', category: 'error-type', description: '对数字信息理解错误', color: '#7f1d1d' },
    { tag_name: 'time-confusion', tag_name_cn: '时间理解错误', category: 'error-type', description: '对时间表达理解有误', color: '#fbbf24' },
    { tag_name: 'speaker-confusion', tag_name_cn: '说话人混淆', category: 'error-type', description: '混淆不同说话人的观点', color: '#f59e0b' },
    { tag_name: 'negation-missed', tag_name_cn: '否定词遗漏', category: 'error-type', description: '未注意到否定表达', color: '#d97706' },

    // 知识点标签
    { tag_name: 'tense-error', tag_name_cn: '时态理解', category: 'knowledge', description: '对动词时态的理解错误', color: '#3b82f6' },
    { tag_name: 'modal-verbs', tag_name_cn: '情态动词', category: 'knowledge', description: '情态动词的含义理解不准确', color: '#2563eb' },
    { tag_name: 'phrasal-verbs', tag_name_cn: '短语动词', category: 'knowledge', description: '短语动词的意思理解错误', color: '#1d4ed8' },
    { tag_name: 'idioms', tag_name_cn: '习语理解', category: 'knowledge', description: '习语或俚语理解困难', color: '#1e40af' },
    { tag_name: 'pronoun-reference', tag_name_cn: '代词指代', category: 'knowledge', description: '代词指代关系不清楚', color: '#1e3a8a' },
    { tag_name: 'cause-effect', tag_name_cn: '因果关系', category: 'knowledge', description: '因果逻辑关系理解错误', color: '#059669' },
    { tag_name: 'sequence', tag_name_cn: '顺序关系', category: 'knowledge', description: '事件顺序理解错误', color: '#047857' },
    { tag_name: 'comparison', tag_name_cn: '比较关系', category: 'knowledge', description: '比较结构理解错误', color: '#065f46' },

    // 场景标签
    { tag_name: 'academic', tag_name_cn: '学术场景', category: 'context', description: '学术讲座或课堂讨论', color: '#7c3aed' },
    { tag_name: 'business', tag_name_cn: '商务场景', category: 'context', description: '商务会议或工作相关', color: '#6d28d9' },
    { tag_name: 'daily-life', tag_name_cn: '日常生活', category: 'context', description: '日常对话和生活场景', color: '#5b21b6' },
    { tag_name: 'travel', tag_name_cn: '旅行场景', category: 'context', description: '旅游和出行相关', color: '#4c1d95' },
    { tag_name: 'technology', tag_name_cn: '科技话题', category: 'context', description: '科技和技术相关内容', color: '#ec4899' },
    { tag_name: 'culture', tag_name_cn: '文化话题', category: 'context', description: '文化和社会话题', color: '#db2777' },

    // 难度标签
    { tag_name: 'accent-difficulty', tag_name_cn: '口音理解', category: 'difficulty', description: '非标准口音理解困难', color: '#f97316' },
    { tag_name: 'speed-issue', tag_name_cn: '语速问题', category: 'difficulty', description: '语速过快导致理解困难', color: '#ea580c' },
    { tag_name: 'complex-sentence', tag_name_cn: '复杂句型', category: 'difficulty', description: '复杂语法结构理解困难', color: '#c2410c' },
    { tag_name: 'technical-terms', tag_name_cn: '专业术语', category: 'difficulty', description: '专业词汇理解困难', color: '#9a3412' },
    
    // 补充标签
    { tag_name: 'attitude-understanding', tag_name_cn: '态度理解', category: 'knowledge', description: '说话人态度和语气理解困难', color: '#2563eb' },
    { tag_name: 'number-information', tag_name_cn: '数字信息', category: 'knowledge', description: '数字和数量信息处理困难', color: '#1d4ed8' },
    { tag_name: 'time-reference', tag_name_cn: '时间信息', category: 'knowledge', description: '时间表达和时间顺序理解困难', color: '#1e40af' }
  ]

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO error_tags (tag_name, tag_name_cn, category, description, color) 
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const tag of tags) {
    insertStmt.run(tag.tag_name, tag.tag_name_cn, tag.category, tag.description, tag.color)
  }
}

// 数据库操作类
export class DatabaseOperations {
  // 邀请码操作
  static verifyInvitationCode = withMonitoring('verifyInvitationCode', (code: string): boolean => {
    const stmt = db.prepare('SELECT code FROM invitations WHERE code = ?')
    const result = stmt.get(code)
    
    if (result) {
      const updateStmt = db.prepare('UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP WHERE code = ?')
      updateStmt.run(code)
      return true
    }
    
    return false
  })

  static createInvitationCode = withMonitoring('createInvitationCode', (code: string): boolean => {
    try {
      const stmt = db.prepare('INSERT INTO invitations (code) VALUES (?)')
      const result = stmt.run(code)
      return result.changes > 0
    } catch (error) {
      console.error('Failed to create invitation code:', error)
      return false
    }
  })

  static createMultipleInvitationCodes = withMonitoring('createMultipleInvitationCodes', (codes: string[]): number => {
    return withTransaction(() => {
      let successCount = 0
      const stmt = db.prepare('INSERT OR IGNORE INTO invitations (code) VALUES (?)')
      
      for (const code of codes) {
        try {
          const result = stmt.run(code)
          if (result.changes > 0) successCount++
        } catch (error) {
          console.error(`Failed to create invitation code ${code}:`, error)
        }
      }
      
      return successCount
    })
  })

  static getAllInvitationCodes(): Array<{code: string, created_at: string, last_active_at: string}> {
    const stmt = db.prepare('SELECT * FROM invitations ORDER BY created_at DESC')
    return stmt.all() as Array<{code: string, created_at: string, last_active_at: string}>
  }

  static deleteInvitationCode = withMonitoring('deleteInvitationCode', (code: string): boolean => {
    return withTransaction(() => {
      try {
        // 级联删除相关记录
        db.prepare('DELETE FROM wrong_answer_tags WHERE wrong_answer_id IN (SELECT id FROM wrong_answers WHERE invitation_code = ?)').run(code)
        db.prepare('DELETE FROM wrong_answers WHERE invitation_code = ?').run(code)
        db.prepare('DELETE FROM exercises WHERE invitation_code = ?').run(code)
        db.prepare('DELETE FROM daily_usage WHERE invitation_code = ?').run(code)
        db.prepare('DELETE FROM user_weakness WHERE invitation_code = ?').run(code)
        db.prepare('DELETE FROM user_statistics WHERE invitation_code = ?').run(code)
        
        const result = db.prepare('DELETE FROM invitations WHERE code = ?').run(code)
        return result.changes > 0
      } catch (error) {
        console.error('Failed to delete invitation code:', error)
        return false
      }
    })
  })

  // 使用次数操作
  static getTodayUsageCount = withMonitoring('getTodayUsageCount', (invitationCode: string): number => {
    const today = new Date().toISOString().split('T')[0]
    const stmt = db.prepare('SELECT usage_count FROM daily_usage WHERE invitation_code = ? AND date = ?')
    const result = stmt.get(invitationCode, today) as {usage_count: number} | undefined
    
    return result?.usage_count || 0
  })

  static incrementUsageCount = withMonitoring('incrementUsageCount', (invitationCode: string): boolean => {
    const today = new Date().toISOString().split('T')[0]
    const currentCount = DatabaseOperations.getTodayUsageCount(invitationCode)
    
    if (currentCount >= 5) {
      return false
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO daily_usage (invitation_code, date, usage_count) 
        VALUES (?, ?, 1)
        ON CONFLICT(invitation_code, date) 
        DO UPDATE SET usage_count = usage_count + 1
      `)
      const result = stmt.run(invitationCode, today)
      return result.changes > 0
    } catch (error) {
      console.error('Failed to increment usage count:', error)
      return false
    }
  })

  // 练习操作
  static saveExercise = withMonitoring('saveExercise', (exercise: Exercise, invitationCode: string): boolean => {
    return withTransaction(() => {
      try {
        const stmt = db.prepare('INSERT INTO exercises (id, invitation_code, exercise_data) VALUES (?, ?, ?)')
        const result = stmt.run(exercise.id, invitationCode, JSON.stringify(exercise))
        
        // 更新用户统计
        DatabaseOperations.updateUserStatistics(invitationCode)
        
        return result.changes > 0
      } catch (error) {
        console.error('Failed to save exercise:', error)
        return false
      }
    })
  })

  static getExerciseHistory(invitationCode: string, limit: number = 10, offset: number = 0): {
    exercises: Exercise[]
    total: number
    hasMore: boolean
  } {
    // 使用游标分页而不是OFFSET
    const stmt = db.prepare(`
      SELECT exercise_data, created_at FROM exercises 
      WHERE invitation_code = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM exercises WHERE invitation_code = ?')
    
    const results = stmt.all(invitationCode, limit + 1) as Array<{exercise_data: string, created_at: string}>
    const countResult = countStmt.get(invitationCode) as {total: number}
    
    const hasMore = results.length > limit
    const exercises = results.slice(0, limit).map(row => JSON.parse(row.exercise_data))
    
    return {
      exercises,
      total: countResult.total,
      hasMore
    }
  }

  // 统计操作
  static getUsageStats(): Array<{invitation_code: string, total_exercises: number, last_exercise: string}> {
    const stmt = db.prepare(`
      SELECT 
        invitation_code,
        COUNT(*) as total_exercises,
        MAX(created_at) as last_exercise
      FROM exercises 
      GROUP BY invitation_code 
      ORDER BY total_exercises DESC
    `)
    return stmt.all() as Array<{invitation_code: string, total_exercises: number, last_exercise: string}>
  }

  static getDailyUsageStats(): Array<{invitation_code: string, date: string, usage_count: number}> {
    const stmt = db.prepare(`
      SELECT invitation_code, date, usage_count 
      FROM daily_usage 
      ORDER BY date DESC, usage_count DESC
      LIMIT 50
    `)
    return stmt.all() as Array<{invitation_code: string, date: string, usage_count: number}>
  }

  // 错题操作（使用规范化的标签存储）
  static saveWrongAnswer = withMonitoring('saveWrongAnswer', (wrongAnswer: {
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
    tags: string[]
    error_analysis?: string
  }): boolean => {
    return withTransaction(() => {
      try {
        // 保存错题记录
        const stmt = db.prepare(`
          INSERT INTO wrong_answers (
            id, invitation_code, exercise_id, question_index, 
            question_data, user_answer, correct_answer, 
            transcript_snippet, topic, difficulty, error_analysis,
            detailed_analysis_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `)
        
        stmt.run(
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

        // 保存标签关联
        const tagStmt = db.prepare('INSERT OR IGNORE INTO wrong_answer_tags (wrong_answer_id, tag_name) VALUES (?, ?)')
        for (const tag of wrongAnswer.tags) {
          tagStmt.run(wrongAnswer.id, tag)
        }

        // 更新用户薄弱点统计
        DatabaseOperations.updateUserWeakness(wrongAnswer.invitation_code, wrongAnswer.tags)
        
        return true
      } catch (error) {
        console.error('Failed to save wrong answer:', error)
        return false
      }
    })
  })

  static getWrongAnswers(invitation_code: string, filters?: {
    tags?: string[]
    category?: string
    limit?: number
    cursor?: string // 游标分页
  }): Array<any> {
    const limit = filters?.limit || 20
    
    let query = `
      SELECT DISTINCT w.*, GROUP_CONCAT(wat.tag_name) as tag_list
      FROM wrong_answers w
      LEFT JOIN wrong_answer_tags wat ON w.id = wat.wrong_answer_id
      WHERE w.invitation_code = ?
    `
    const params: any[] = [invitation_code]

    if (filters?.tags && filters.tags.length > 0) {
      const tagPlaceholders = filters.tags.map(() => '?').join(',')
      query += ` AND w.id IN (
        SELECT DISTINCT wrong_answer_id 
        FROM wrong_answer_tags 
        WHERE tag_name IN (${tagPlaceholders})
      )`
      params.push(...filters.tags)
    }

    if (filters?.cursor) {
      query += ` AND w.created_at < ?`
      params.push(filters.cursor)
    }

    query += ` GROUP BY w.id ORDER BY w.created_at DESC LIMIT ?`
    params.push(limit + 1) // 多获取一条用于判断是否有更多

    const stmt = db.prepare(query)
    const results = stmt.all(...params) as Array<any>
    
    const hasMore = results.length > limit
    const items = results.slice(0, limit)
    
    return items.map(row => ({
      ...row,
      question_data: JSON.parse(row.question_data),
      tags: row.tag_list ? row.tag_list.split(',') : [],
      hasMore: hasMore && row === items[items.length - 1]
    }))
  }

  static updateUserWeakness = withMonitoring('updateUserWeakness', (invitation_code: string, tags: string[]): void => {
    const stmt = db.prepare(`
      INSERT INTO user_weakness (invitation_code, tag_name, frequency, last_occurrence)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(invitation_code, tag_name) DO UPDATE SET
        frequency = frequency + 1,
        last_occurrence = CURRENT_TIMESTAMP
    `)
    
    for (const tag of tags) {
      try {
        stmt.run(invitation_code, tag)
      } catch (error) {
        console.error(`Failed to update user weakness for tag ${tag}:`, error)
      }
    }
  })

  private static updateUserStatistics(invitation_code: string): void {
    const stmt = db.prepare(`
      INSERT INTO user_statistics (invitation_code, total_exercises, total_wrong_answers, last_exercise_date)
      VALUES (?, 1, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(invitation_code) DO UPDATE SET
        total_exercises = total_exercises + 1,
        last_exercise_date = CURRENT_TIMESTAMP
    `)
    
    stmt.run(invitation_code)
  }

  // 性能监控
  static getPerformanceMetrics(): QueryMetrics[] {
    return DatabaseMetrics.getMetrics()
  }

  static getSlowQueries(threshold: number = 100): QueryMetrics[] {
    return DatabaseMetrics.getSlowQueries(threshold)
  }

  // 健康检查
  static healthCheck(): { status: 'healthy' | 'error', metrics: any } {
    try {
      const result = db.prepare('SELECT 1 as test').get()
      const slowQueries = DatabaseOperations.getSlowQueries()
      
      return {
        status: 'healthy',
        metrics: {
          connection: 'ok',
          slowQueriesCount: slowQueries.length,
          recentQueries: DatabaseMetrics.getMetrics().slice(-10)
        }
      }
    } catch (error) {
      return {
        status: 'error',
        metrics: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}

// 初始化数据库
initializeDatabase()

// 优雅关闭
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

// 生成随机邀请码
export function generateInvitationCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 向后兼容导出
export const dbOperations = DatabaseOperations
export default db