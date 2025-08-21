/**
 * 增强的数据库操作模块
 * 增加事务控制、错误处理、连接池管理
 */

import Database, { Transaction } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { Exercise } from './types'
import { AppError, ErrorType, ErrorSeverity, withRetry, withTimeout } from './enhanced-error-handler'

const dbPath = path.join(process.cwd(), 'data', 'app.db')

// 确保数据目录存在
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 数据库连接池管理
class DatabasePool {
  private static instance: DatabasePool
  private db: Database.Database
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  private constructor() {
    this.connect()
  }

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool()
    }
    return DatabasePool.instance
  }

  private connect(): void {
    try {
      this.db = new Database(dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
        timeout: 10000,
        fileMustExist: false
      })

      // 配置数据库选项
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
      this.db.pragma('cache_size = 1000')
      this.db.pragma('temp_store = memory')
      this.db.pragma('mmap_size = 268435456') // 256MB

      this.isConnected = true
      this.reconnectAttempts = 0
      
      console.log('✅ Database connected successfully')
      this.initializeDatabase()
    } catch (error) {
      this.isConnected = false
      console.error('❌ Database connection failed:', error)
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(() => this.connect(), 5000 * this.reconnectAttempts)
      } else {
        throw new AppError('Database connection failed after max attempts', {
          type: ErrorType.DATABASE,
          severity: ErrorSeverity.CRITICAL,
          component: 'DatabasePool'
        }, error as Error)
      }
    }
  }

  getConnection(): Database.Database {
    if (!this.isConnected || !this.db.open) {
      throw new AppError('Database connection not available', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.HIGH,
        component: 'DatabasePool'
      })
    }
    return this.db
  }

  // 健康检查
  healthCheck(): boolean {
    try {
      this.db.prepare('SELECT 1').get()
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }

  // 优雅关闭
  close(): void {
    if (this.db && this.db.open) {
      this.db.close()
      this.isConnected = false
      console.log('✅ Database connection closed')
    }
  }

  private initializeDatabase(): void {
    // 使用事务初始化所有表
    const initTransaction = this.db.transaction(() => {
      // 创建邀请码表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS invitations (
          code TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1
        )
      `)

      // 创建练习记录表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          invitation_code TEXT NOT NULL,
          exercise_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code)
        )
      `)

      // 创建每日使用次数表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS daily_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invitation_code TEXT NOT NULL,
          date TEXT NOT NULL,
          usage_count INTEGER DEFAULT 0,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code),
          UNIQUE (invitation_code, date)
        )
      `)

      // 创建错题记录表
      this.db.exec(`
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
          FOREIGN KEY (invitation_code) REFERENCES invitations (code)
        )
      `)

      // 创建错误标签表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS error_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tag_name TEXT UNIQUE NOT NULL,
          tag_name_cn TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          color TEXT NOT NULL
        )
      `)

      // 创建用户薄弱点统计表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_weakness (
          invitation_code TEXT NOT NULL,
          tag_name TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          last_occurrence DATETIME DEFAULT CURRENT_TIMESTAMP,
          improvement_rate REAL DEFAULT 0.0,
          PRIMARY KEY (invitation_code, tag_name),
          FOREIGN KEY (invitation_code) REFERENCES invitations (code)
        )
      `)

      // 创建系统日志表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS system_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL,
          component TEXT NOT NULL,
          operation TEXT,
          message TEXT NOT NULL,
          error_details TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 创建索引以提升性能
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_exercises_invitation_code ON exercises(invitation_code);
        CREATE INDEX IF NOT EXISTS idx_exercises_created_at ON exercises(created_at);
        CREATE INDEX IF NOT EXISTS idx_daily_usage_code_date ON daily_usage(invitation_code, date);
        CREATE INDEX IF NOT EXISTS idx_wrong_answers_invitation_code ON wrong_answers(invitation_code);
        CREATE INDEX IF NOT EXISTS idx_wrong_answers_created_at ON wrong_answers(created_at);
        CREATE INDEX IF NOT EXISTS idx_user_weakness_invitation_code ON user_weakness(invitation_code);
        CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
      `)

      this.initializeErrorTags()
    })

    try {
      initTransaction()
      console.log('✅ Database tables initialized successfully')
    } catch (error) {
      throw new AppError('Failed to initialize database tables', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.CRITICAL,
        component: 'DatabasePool',
        operation: 'initialize'
      }, error as Error)
    }
  }

  private initializeErrorTags(): void {
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

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO error_tags (tag_name, tag_name_cn, category, description, color) 
      VALUES (?, ?, ?, ?, ?)
    `)

    for (const tag of tags) {
      insertStmt.run(tag.tag_name, tag.tag_name_cn, tag.category, tag.description, tag.color)
    }
  }
}

// 增强的数据库操作类
export class EnhancedDbOperations {
  private db: Database.Database
  private pool: DatabasePool

  constructor() {
    this.pool = DatabasePool.getInstance()
    this.db = this.pool.getConnection()
  }

  // 验证邀请码（带事务）
  @withRetry
  @withTimeout(5000)
  verifyInvitationCode(code: string): boolean {
    try {
      const verifyTransaction = this.db.transaction((invitationCode: string) => {
        const selectStmt = this.db.prepare('SELECT code, is_active FROM invitations WHERE code = ? AND is_active = 1')
        const result = selectStmt.get(invitationCode) as { code: string; is_active: number } | undefined
        
        if (!result) {
          return false
        }

        // 更新最后活跃时间
        const updateStmt = this.db.prepare('UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP WHERE code = ?')
        updateStmt.run(invitationCode)
        
        return true
      })

      return verifyTransaction(code)
    } catch (error) {
      throw new AppError('Failed to verify invitation code', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedDbOperations',
        operation: 'verifyInvitationCode',
        metadata: { code }
      }, error as Error)
    }
  }

  // 增加使用次数（带事务和并发控制）
  @withRetry
  @withTimeout(5000)
  incrementUsageCount(invitationCode: string): { success: boolean; todayUsage: number; remainingUsage: number } {
    try {
      const usageTransaction = this.db.transaction((code: string) => {
        const today = new Date().toISOString().split('T')[0]
        
        // 获取当前使用次数
        const selectStmt = this.db.prepare('SELECT usage_count FROM daily_usage WHERE invitation_code = ? AND date = ?')
        const currentUsage = selectStmt.get(code, today) as { usage_count: number } | undefined
        const currentCount = currentUsage?.usage_count || 0
        
        // 检查是否超出限制
        if (currentCount >= 5) {
          return { success: false, todayUsage: currentCount, remainingUsage: 0 }
        }

        // 原子性增加使用次数
        const upsertStmt = this.db.prepare(`
          INSERT INTO daily_usage (invitation_code, date, usage_count, last_updated) 
          VALUES (?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(invitation_code, date) 
          DO UPDATE SET 
            usage_count = usage_count + 1,
            last_updated = CURRENT_TIMESTAMP
        `)
        upsertStmt.run(code, today)

        const newCount = currentCount + 1
        return { 
          success: true, 
          todayUsage: newCount, 
          remainingUsage: Math.max(0, 5 - newCount) 
        }
      })

      return usageTransaction(invitationCode)
    } catch (error) {
      throw new AppError('Failed to increment usage count', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedDbOperations',
        operation: 'incrementUsageCount',
        metadata: { invitationCode }
      }, error as Error)
    }
  }

  // 保存练习记录（带数据验证）
  @withRetry
  @withTimeout(10000)
  saveExercise(exercise: Exercise, invitationCode: string): boolean {
    try {
      // 数据验证
      if (!exercise.id || !exercise.difficulty || !exercise.topic) {
        throw new Error('Exercise data validation failed: missing required fields')
      }

      if (!Array.isArray(exercise.questions) || exercise.questions.length === 0) {
        throw new Error('Exercise data validation failed: invalid questions')
      }

      const saveTransaction = this.db.transaction((ex: Exercise, code: string) => {
        // 检查邀请码是否有效
        if (!this.verifyInvitationCode(code)) {
          throw new Error('Invalid invitation code')
        }

        // 保存练习记录
        const insertStmt = this.db.prepare(`
          INSERT INTO exercises (id, invitation_code, exercise_data, created_at) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `)
        insertStmt.run(ex.id, code, JSON.stringify(ex))

        // 记录系统日志
        this.logSystemEvent('info', 'EnhancedDbOperations', 'saveExercise', 'Exercise saved successfully', {
          exerciseId: ex.id,
          invitationCode: code,
          difficulty: ex.difficulty,
          questionCount: ex.questions.length
        })

        return true
      })

      return saveTransaction(exercise, invitationCode)
    } catch (error) {
      throw new AppError('Failed to save exercise', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedDbOperations',
        operation: 'saveExercise',
        metadata: { exerciseId: exercise.id, invitationCode }
      }, error as Error)
    }
  }

  // 保存错题记录（增强版）
  @withRetry
  @withTimeout(10000)
  saveWrongAnswer(wrongAnswer: {
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
  }): boolean {
    try {
      // 数据验证
      if (!wrongAnswer.id || !wrongAnswer.invitation_code || !wrongAnswer.exercise_id) {
        throw new Error('Wrong answer data validation failed: missing required fields')
      }

      if (!Array.isArray(wrongAnswer.tags) || wrongAnswer.tags.length === 0) {
        throw new Error('Wrong answer data validation failed: tags must be a non-empty array')
      }

      const saveWrongAnswerTransaction = this.db.transaction((wrongAns: any) => {
        // 验证邀请码
        if (!this.verifyInvitationCode(wrongAns.invitation_code)) {
          throw new Error('Invalid invitation code')
        }

        // 保存错题记录
        const insertStmt = this.db.prepare(`
          INSERT INTO wrong_answers (
            id, invitation_code, exercise_id, question_index, 
            question_data, user_answer, correct_answer, 
            transcript_snippet, topic, difficulty, tags, error_analysis,
            detailed_analysis_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        `)
        
        insertStmt.run(
          wrongAns.id,
          wrongAns.invitation_code,
          wrongAns.exercise_id,
          wrongAns.question_index,
          JSON.stringify(wrongAns.question_data),
          wrongAns.user_answer,
          wrongAns.correct_answer,
          wrongAns.transcript_snippet,
          wrongAns.topic,
          wrongAns.difficulty,
          JSON.stringify(wrongAns.tags),
          wrongAns.error_analysis
        )

        // 更新用户薄弱点统计
        this.updateUserWeakness(wrongAns.invitation_code, wrongAns.tags)

        return true
      })

      return saveWrongAnswerTransaction(wrongAnswer)
    } catch (error) {
      throw new AppError('Failed to save wrong answer', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedDbOperations',
        operation: 'saveWrongAnswer',
        metadata: { wrongAnswerId: wrongAnswer.id, invitationCode: wrongAnswer.invitation_code }
      }, error as Error)
    }
  }

  // 更新用户薄弱点统计（私有方法）
  private updateUserWeakness(invitation_code: string, tags: string[]): void {
    const weaknessStmt = this.db.prepare(`
      INSERT INTO user_weakness (invitation_code, tag_name, frequency, last_occurrence)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(invitation_code, tag_name) DO UPDATE SET
        frequency = frequency + 1,
        last_occurrence = CURRENT_TIMESTAMP
    `)
    
    for (const tag of tags) {
      try {
        weaknessStmt.run(invitation_code, tag)
      } catch (error) {
        console.error(`Failed to update user weakness for tag ${tag}:`, error)
      }
    }
  }

  // 获取练习历史（带分页）
  @withRetry
  @withTimeout(5000)
  getExerciseHistory(invitationCode: string, limit: number = 10, offset: number = 0): {
    exercises: Exercise[]
    total: number
    hasMore: boolean
  } {
    try {
      // 获取总数
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM exercises WHERE invitation_code = ?
      `)
      const { total } = countStmt.get(invitationCode) as { total: number }

      // 获取分页数据
      const selectStmt = this.db.prepare(`
        SELECT exercise_data FROM exercises 
        WHERE invitation_code = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `)
      const results = selectStmt.all(invitationCode, limit, offset) as Array<{exercise_data: string}>
      
      const exercises = results.map(row => {
        try {
          return JSON.parse(row.exercise_data)
        } catch (error) {
          console.error('Failed to parse exercise data:', error)
          return null
        }
      }).filter(Boolean)

      return {
        exercises,
        total,
        hasMore: offset + limit < total
      }
    } catch (error) {
      throw new AppError('Failed to get exercise history', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.LOW,
        component: 'EnhancedDbOperations',
        operation: 'getExerciseHistory',
        metadata: { invitationCode, limit, offset }
      }, error as Error)
    }
  }

  // 系统日志记录
  private logSystemEvent(
    level: 'info' | 'warn' | 'error' | 'debug',
    component: string,
    operation: string,
    message: string,
    metadata?: any
  ): void {
    try {
      const logStmt = this.db.prepare(`
        INSERT INTO system_logs (level, component, operation, message, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      logStmt.run(level, component, operation, message, metadata ? JSON.stringify(metadata) : null)
    } catch (error) {
      console.error('Failed to log system event:', error)
    }
  }

  // 健康检查
  healthCheck(): {
    isHealthy: boolean
    connectionStatus: boolean
    lastError?: string
  } {
    try {
      const connectionStatus = this.pool.healthCheck()
      return {
        isHealthy: connectionStatus,
        connectionStatus
      }
    } catch (error) {
      return {
        isHealthy: false,
        connectionStatus: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 获取系统统计
  getSystemStats(): {
    totalInvitations: number
    totalExercises: number
    totalWrongAnswers: number
    activeToday: number
  } {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const stats = {
        totalInvitations: (this.db.prepare('SELECT COUNT(*) as count FROM invitations WHERE is_active = 1').get() as {count: number}).count,
        totalExercises: (this.db.prepare('SELECT COUNT(*) as count FROM exercises').get() as {count: number}).count,
        totalWrongAnswers: (this.db.prepare('SELECT COUNT(*) as count FROM wrong_answers').get() as {count: number}).count,
        activeToday: (this.db.prepare('SELECT COUNT(DISTINCT invitation_code) as count FROM daily_usage WHERE date = ?').get(today) as {count: number}).count
      }

      return stats
    } catch (error) {
      throw new AppError('Failed to get system stats', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.LOW,
        component: 'EnhancedDbOperations',
        operation: 'getSystemStats'
      }, error as Error)
    }
  }

  // 清理旧数据
  @withRetry
  @withTimeout(30000)
  cleanupOldData(daysToKeep: number = 30): {
    deletedExercises: number
    deletedLogs: number
  } {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const cutoffDateStr = cutoffDate.toISOString()

      const cleanupTransaction = this.db.transaction(() => {
        // 删除旧的练习记录
        const deleteExercisesStmt = this.db.prepare('DELETE FROM exercises WHERE created_at < ?')
        const deletedExercises = deleteExercisesStmt.run(cutoffDateStr).changes

        // 删除旧的系统日志
        const deleteLogsStmt = this.db.prepare('DELETE FROM system_logs WHERE created_at < ?')
        const deletedLogs = deleteLogsStmt.run(cutoffDateStr).changes

        return { deletedExercises, deletedLogs }
      })

      return cleanupTransaction()
    } catch (error) {
      throw new AppError('Failed to cleanup old data', {
        type: ErrorType.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        component: 'EnhancedDbOperations',
        operation: 'cleanupOldData',
        metadata: { daysToKeep }
      }, error as Error)
    }
  }
}

// 装饰器实现
function withRetry(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value
  descriptor.value = function (...args: any[]) {
    const retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2
    }

    return withTimeout(
      withRetry(method.bind(this), retryConfig),
      10000
    )(...args)
  }
}

function withTimeout(timeoutMs: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    descriptor.value = function (...args: any[]) {
      return Promise.race([
        method.apply(this, args),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout after ${timeoutMs}ms`))
          }, timeoutMs)
        })
      ])
    }
  }
}

// 导出单例实例
export const enhancedDbOperations = new EnhancedDbOperations()

// 优雅关闭处理
process.on('exit', () => {
  DatabasePool.getInstance().close()
})

process.on('SIGINT', () => {
  DatabasePool.getInstance().close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  DatabasePool.getInstance().close()
  process.exit(0)
})