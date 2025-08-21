/**
 * 优化的数据库操作层
 * 包含连接池、索引优化、事务管理和查询优化
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { ApiError, createApiError } from './api-response'
import { Exercise, WrongAnswer, UserWeakness, TagStats } from './types'

// 数据库配置
interface DatabaseConfig {
  path: string
  readonly: boolean
  fileMustExist: boolean
  timeout: number
  verbose?: (message?: any) => void
}

// 数据库连接池管理
class DatabasePool {
  private static instance: DatabasePool
  private connections: Map<string, Database.Database> = new Map()
  private readonly maxConnections = 10
  private readonly config: DatabaseConfig

  private constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'app.db')
    
    // 确保数据目录存在
    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    this.config = {
      path: dbPath,
      readonly: false,
      fileMustExist: false,
      timeout: 10000,
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    }

    this.initializeDatabase()
  }

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool()
    }
    return DatabasePool.instance
  }

  private getConnection(): Database.Database {
    const connectionId = 'main'
    
    if (!this.connections.has(connectionId)) {
      const db = new Database(this.config.path, this.config)
      
      // 启用WAL模式提高并发性能
      db.pragma('journal_mode = WAL')
      // 启用外键约束
      db.pragma('foreign_keys = ON')
      // 设置合理的缓存大小（16MB）
      db.pragma('cache_size = -16000')
      // 设置同步模式为NORMAL以平衡性能和安全性
      db.pragma('synchronous = NORMAL')
      // 设置临时存储为内存
      db.pragma('temp_store = MEMORY')
      // 设置检查点间隔
      db.pragma('wal_autocheckpoint = 1000')
      
      this.connections.set(connectionId, db)
    }

    return this.connections.get(connectionId)!
  }

  private initializeDatabase(): void {
    const db = this.getConnection()
    
    try {
      // 检查是否为全新数据库（如果没有表则创建）
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      const isNewDatabase = tables.length === 0
      
      if (isNewDatabase) {
        // 新数据库，使用事务创建所有表
        const initTransaction = db.transaction(() => {
          this.createTables(db)
          this.createIndexes(db)
          this.initializeData(db)
        })
        initTransaction()
      } else {
        // 现有数据库，只添加缺失的列和索引
        this.upgradeExistingDatabase(db)
      }
      
      console.log('✅ Database initialized successfully with optimizations')
    } catch (error) {
      console.error('❌ Database initialization failed:', error)
      // 不抛出错误，以免阻止应用启动
      console.warn('Continuing with existing database structure')
    }
  }

  private upgradeExistingDatabase(db: Database.Database): void {
    try {
      // 添加缺失的列（如果不存在）
      this.addMissingColumns(db)
      
      // 创建索引（不会覆盖现有索引）
      this.createIndexes(db)
      
      // 初始化数据（使用INSERT OR IGNORE）
      this.initializeData(db)
    } catch (error) {
      console.warn('Database upgrade partially failed:', error)
    }
  }

  private addMissingColumns(db: Database.Database): void {
    const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
      try {
        const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]
        const columnExists = tableInfo.some(col => col.name === columnName)
        
        if (!columnExists) {
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`)
          console.log(`Added column ${columnName} to ${tableName}`)
        }
      } catch (error) {
        // 忽略错误，表可能不存在或列已存在
      }
    }

    // 为现有表添加新列
    addColumnIfNotExists('invitations', 'is_active', 'BOOLEAN DEFAULT TRUE')
    addColumnIfNotExists('invitations', 'max_daily_usage', 'INTEGER DEFAULT 5')
    addColumnIfNotExists('invitations', 'total_usage_count', 'INTEGER DEFAULT 0')
    
    addColumnIfNotExists('exercises', 'difficulty', 'TEXT')
    addColumnIfNotExists('exercises', 'topic', 'TEXT')
    addColumnIfNotExists('exercises', 'transcript', 'TEXT')
    addColumnIfNotExists('exercises', 'word_count', 'INTEGER')
    addColumnIfNotExists('exercises', 'questions_count', 'INTEGER')
    addColumnIfNotExists('exercises', 'correct_answers', 'INTEGER DEFAULT 0')
    addColumnIfNotExists('exercises', 'completed_at', 'DATETIME')
    
    addColumnIfNotExists('daily_usage', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists('daily_usage', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    
    addColumnIfNotExists('error_tags', 'sort_order', 'INTEGER DEFAULT 0')
    addColumnIfNotExists('error_tags', 'is_active', 'BOOLEAN DEFAULT TRUE')
    addColumnIfNotExists('error_tags', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    
    addColumnIfNotExists('user_weakness', 'trend_direction', 'TEXT DEFAULT "stable"')
    addColumnIfNotExists('user_weakness', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    addColumnIfNotExists('user_weakness', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
  }

  private createTables(db: Database.Database): void {
    // 创建邀请码表
    db.exec(`
      CREATE TABLE IF NOT EXISTS invitations (
        code TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        max_daily_usage INTEGER DEFAULT 5,
        total_usage_count INTEGER DEFAULT 0
      )
    `)

    // 创建练习记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        invitation_code TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        topic TEXT NOT NULL,
        transcript TEXT NOT NULL,
        word_count INTEGER,
        questions_count INTEGER,
        correct_answers INTEGER DEFAULT 0,
        exercise_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE,
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
        question_type TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_options TEXT,
        user_answer TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        transcript_snippet TEXT,
        topic TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        tags TEXT NOT NULL,
        error_analysis TEXT,
        extended_error_analysis TEXT,
        solution_tips TEXT,
        highlighting_annotations TEXT,
        detailed_analysis_status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
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
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
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
        trend_direction TEXT DEFAULT 'stable',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (invitation_code, tag_name),
        FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE,
        FOREIGN KEY (tag_name) REFERENCES error_tags (tag_name) ON DELETE CASCADE
      )
    `)

    // 创建用户学习统计表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_statistics (
        invitation_code TEXT PRIMARY KEY,
        total_exercises INTEGER DEFAULT 0,
        total_questions INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        wrong_answers INTEGER DEFAULT 0,
        accuracy_rate REAL DEFAULT 0.0,
        average_difficulty REAL DEFAULT 0.0,
        streak_days INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_exercise_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_code) REFERENCES invitations (code) ON DELETE CASCADE
      )
    `)

    // 创建API请求日志表
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT UNIQUE NOT NULL,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        invitation_code TEXT,
        ip_address TEXT,
        user_agent TEXT,
        request_body TEXT,
        response_status INTEGER,
        response_time INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  private createIndexes(db: Database.Database): void {
    try {
      // 检查表和列是否存在的辅助函数
      const columnExists = (tableName: string, columnName: string): boolean => {
        try {
          const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]
          return result.some(col => col.name === columnName)
        } catch {
          return false
        }
      }

      const tableExists = (tableName: string): boolean => {
        try {
          const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName)
          return !!result
        } catch {
          return false
        }
      }

      // 邀请码表索引（检查列是否存在）
      if (tableExists('invitations')) {
        if (columnExists('invitations', 'is_active')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_invitations_active ON invitations (is_active, last_active_at)`)
        } else {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_invitations_last_active ON invitations (last_active_at)`)
        }
      }
      
      // 练习记录表索引
      if (tableExists('exercises')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_exercises_invitation_code ON exercises (invitation_code, created_at DESC)`)
        
        if (columnExists('exercises', 'difficulty')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises (difficulty, created_at DESC)`)
        }
        if (columnExists('exercises', 'topic')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_exercises_topic ON exercises (topic, created_at DESC)`)
        }
        if (columnExists('exercises', 'completed_at')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_exercises_completed_at ON exercises (completed_at)`)
        }
      }
      
      // 每日使用次数表索引
      if (tableExists('daily_usage')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_usage_code_date ON daily_usage (invitation_code, date)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage (date DESC)`)
      }
      
      // 错题记录表索引
      if (tableExists('wrong_answers')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_wrong_answers_invitation_code ON wrong_answers (invitation_code, created_at DESC)`)
        
        if (columnExists('wrong_answers', 'exercise_id')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_wrong_answers_exercise_id ON wrong_answers (exercise_id)`)
        }
        if (columnExists('wrong_answers', 'difficulty')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_wrong_answers_difficulty ON wrong_answers (difficulty, created_at DESC)`)
        }
        if (columnExists('wrong_answers', 'topic')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_wrong_answers_topic ON wrong_answers (topic, created_at DESC)`)
        }
        if (columnExists('wrong_answers', 'detailed_analysis_status')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_wrong_answers_analysis_status ON wrong_answers (detailed_analysis_status, created_at)`)
        }
      }
      
      // 标签表索引
      if (tableExists('error_tags')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_error_tags_category ON error_tags (category)`)
        
        if (columnExists('error_tags', 'sort_order')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_error_tags_sort ON error_tags (sort_order)`)
        }
        if (columnExists('error_tags', 'is_active')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_error_tags_active ON error_tags (is_active)`)
        }
      }
      
      // 用户薄弱点统计表索引
      if (tableExists('user_weakness')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_user_weakness_frequency ON user_weakness (invitation_code, frequency DESC, last_occurrence DESC)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_user_weakness_tag ON user_weakness (tag_name, frequency DESC)`)
      }
      
      // 新表的索引（如果存在）
      if (tableExists('user_statistics')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_user_statistics_last_exercise ON user_statistics (last_exercise_date DESC)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_user_statistics_accuracy ON user_statistics (accuracy_rate DESC)`)
      }
      
      if (tableExists('api_logs')) {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs (created_at DESC)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_api_logs_invitation_code ON api_logs (invitation_code, created_at DESC)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs (endpoint, created_at DESC)`)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs (response_status, created_at DESC)`)
      }
      
    } catch (error) {
      console.warn('Some indexes could not be created:', error)
      // 继续执行，不阻止应用启动
    }
  }

  private initializeData(db: Database.Database): void {
    // 初始化错误标签数据
    const tags = [
      // 错误类型标签
      { tag_name: 'detail-missing', tag_name_cn: '细节理解缺失', category: 'error-type', description: '未能理解或记住听力中的重要细节', color: '#ef4444', sort_order: 1 },
      { tag_name: 'main-idea', tag_name_cn: '主旨理解错误', category: 'error-type', description: '对听力材料的主要观点理解有误', color: '#dc2626', sort_order: 2 },
      { tag_name: 'inference', tag_name_cn: '推理判断错误', category: 'error-type', description: '无法正确推断隐含信息', color: '#b91c1c', sort_order: 3 },
      { tag_name: 'vocabulary', tag_name_cn: '词汇理解问题', category: 'error-type', description: '关键词汇理解不准确', color: '#991b1b', sort_order: 4 },
      { tag_name: 'number-confusion', tag_name_cn: '数字混淆', category: 'error-type', description: '对数字信息理解错误', color: '#7f1d1d', sort_order: 5 },
      { tag_name: 'time-confusion', tag_name_cn: '时间理解错误', category: 'error-type', description: '对时间表达理解有误', color: '#fbbf24', sort_order: 6 },
      { tag_name: 'speaker-confusion', tag_name_cn: '说话人混淆', category: 'error-type', description: '混淆不同说话人的观点', color: '#f59e0b', sort_order: 7 },
      { tag_name: 'negation-missed', tag_name_cn: '否定词遗漏', category: 'error-type', description: '未注意到否定表达', color: '#d97706', sort_order: 8 },

      // 知识点标签
      { tag_name: 'tense-error', tag_name_cn: '时态理解', category: 'knowledge', description: '对动词时态的理解错误', color: '#3b82f6', sort_order: 9 },
      { tag_name: 'modal-verbs', tag_name_cn: '情态动词', category: 'knowledge', description: '情态动词的含义理解不准确', color: '#2563eb', sort_order: 10 },
      { tag_name: 'phrasal-verbs', tag_name_cn: '短语动词', category: 'knowledge', description: '短语动词的意思理解错误', color: '#1d4ed8', sort_order: 11 },
      { tag_name: 'idioms', tag_name_cn: '习语理解', category: 'knowledge', description: '习语或俚语理解困难', color: '#1e40af', sort_order: 12 },
      { tag_name: 'pronoun-reference', tag_name_cn: '代词指代', category: 'knowledge', description: '代词指代关系不清楚', color: '#1e3a8a', sort_order: 13 },
      { tag_name: 'cause-effect', tag_name_cn: '因果关系', category: 'knowledge', description: '因果逻辑关系理解错误', color: '#059669', sort_order: 14 },
      { tag_name: 'sequence', tag_name_cn: '顺序关系', category: 'knowledge', description: '事件顺序理解错误', color: '#047857', sort_order: 15 },
      { tag_name: 'comparison', tag_name_cn: '比较关系', category: 'knowledge', description: '比较结构理解错误', color: '#065f46', sort_order: 16 },

      // 场景标签
      { tag_name: 'academic', tag_name_cn: '学术场景', category: 'context', description: '学术讲座或课堂讨论', color: '#7c3aed', sort_order: 17 },
      { tag_name: 'business', tag_name_cn: '商务场景', category: 'context', description: '商务会议或工作相关', color: '#6d28d9', sort_order: 18 },
      { tag_name: 'daily-life', tag_name_cn: '日常生活', category: 'context', description: '日常对话和生活场景', color: '#5b21b6', sort_order: 19 },
      { tag_name: 'travel', tag_name_cn: '旅行场景', category: 'context', description: '旅游和出行相关', color: '#4c1d95', sort_order: 20 },
      { tag_name: 'technology', tag_name_cn: '科技话题', category: 'context', description: '科技和技术相关内容', color: '#ec4899', sort_order: 21 },
      { tag_name: 'culture', tag_name_cn: '文化话题', category: 'context', description: '文化和社会话题', color: '#db2777', sort_order: 22 },

      // 难度标签
      { tag_name: 'accent-difficulty', tag_name_cn: '口音理解', category: 'difficulty', description: '非标准口音理解困难', color: '#f97316', sort_order: 23 },
      { tag_name: 'speed-issue', tag_name_cn: '语速问题', category: 'difficulty', description: '语速过快导致理解困难', color: '#ea580c', sort_order: 24 },
      { tag_name: 'complex-sentence', tag_name_cn: '复杂句型', category: 'difficulty', description: '复杂语法结构理解困难', color: '#c2410c', sort_order: 25 },
      { tag_name: 'technical-terms', tag_name_cn: '专业术语', category: 'difficulty', description: '专业词汇理解困难', color: '#9a3412', sort_order: 26 },
      
      // 补充标签
      { tag_name: 'attitude-understanding', tag_name_cn: '态度理解', category: 'knowledge', description: '说话人态度和语气理解困难', color: '#2563eb', sort_order: 27 },
      { tag_name: 'number-information', tag_name_cn: '数字信息', category: 'knowledge', description: '数字和数量信息处理困难', color: '#1d4ed8', sort_order: 28 },
      { tag_name: 'time-reference', tag_name_cn: '时间信息', category: 'knowledge', description: '时间表达和时间顺序理解困难', color: '#1e40af', sort_order: 29 }
    ]

    // 检查sort_order列是否存在
    const tableInfo = db.prepare(`PRAGMA table_info(error_tags)`).all() as any[]
    const hasSortOrder = tableInfo.some(col => col.name === 'sort_order')
    
    let insertTagStmt: Database.Statement
    if (hasSortOrder) {
      insertTagStmt = db.prepare(`
        INSERT OR IGNORE INTO error_tags (tag_name, tag_name_cn, category, description, color, sort_order) 
        VALUES (?, ?, ?, ?, ?, ?)
      `)
    } else {
      insertTagStmt = db.prepare(`
        INSERT OR IGNORE INTO error_tags (tag_name, tag_name_cn, category, description, color) 
        VALUES (?, ?, ?, ?, ?)
      `)
    }

    for (const tag of tags) {
      if (hasSortOrder) {
        insertTagStmt.run(tag.tag_name, tag.tag_name_cn, tag.category, tag.description, tag.color, tag.sort_order)
      } else {
        insertTagStmt.run(tag.tag_name, tag.tag_name_cn, tag.category, tag.description, tag.color)
      }
    }
  }

  // 获取数据库连接
  getDb(): Database.Database {
    return this.getConnection()
  }

  // 关闭所有连接
  closeAll(): void {
    for (const [id, db] of this.connections.entries()) {
      try {
        db.close()
        console.log(`Database connection ${id} closed`)
      } catch (error) {
        console.error(`Error closing database connection ${id}:`, error)
      }
    }
    this.connections.clear()
  }
}

// 数据库操作类
export class OptimizedDbOperations {
  private db: Database.Database
  private preparedStatements: Map<string, Database.Statement> = new Map()

  constructor() {
    this.db = DatabasePool.getInstance().getDb()
    this.initializePreparedStatements()
  }

  private initializePreparedStatements(): void {
    // 检查列是否存在的辅助函数
    const columnExists = (tableName: string, columnName: string): boolean => {
      try {
        const result = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]
        return result.some(col => col.name === columnName)
      } catch {
        return false
      }
    }

    // 根据数据库结构动态生成查询语句
    const hasIsActive = columnExists('invitations', 'is_active')
    const hasTotalUsage = columnExists('invitations', 'total_usage_count')

    // 常用查询的预编译语句
    const statements = {
      // 邀请码相关
      verifyInvitationCode: hasIsActive 
        ? 'SELECT code, is_active FROM invitations WHERE code = ? AND is_active = TRUE'
        : 'SELECT code FROM invitations WHERE code = ?',
      updateInvitationActivity: hasTotalUsage
        ? 'UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP, total_usage_count = total_usage_count + 1 WHERE code = ?'
        : 'UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP WHERE code = ?',
      
      // 使用次数相关
      getTodayUsage: 'SELECT usage_count FROM daily_usage WHERE invitation_code = ? AND date = ?',
      incrementUsage: columnExists('daily_usage', 'updated_at') ? `
        INSERT INTO daily_usage (invitation_code, date, usage_count, updated_at) 
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(invitation_code, date) 
        DO UPDATE SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
      ` : `
        INSERT INTO daily_usage (invitation_code, date, usage_count) 
        VALUES (?, ?, 1)
        ON CONFLICT(invitation_code, date) 
        DO UPDATE SET usage_count = usage_count + 1
      `,
      
      // 练习相关 - 检查可选字段是否存在
      saveExercise: (() => {
        const hasExtendedFields = columnExists('exercises', 'difficulty') && 
                                 columnExists('exercises', 'word_count') && 
                                 columnExists('exercises', 'completed_at')
        
        return hasExtendedFields ? `
          INSERT INTO exercises (
            id, invitation_code, difficulty, topic, transcript, 
            word_count, questions_count, correct_answers, exercise_data, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ` : `
          INSERT INTO exercises (id, invitation_code, exercise_data) 
          VALUES (?, ?, ?)
        `
      })(),
      getExerciseHistory: (() => {
        const hasExtendedFields = columnExists('exercises', 'difficulty') && 
                                 columnExists('exercises', 'word_count')
        
        return hasExtendedFields ? `
          SELECT id, difficulty, topic, word_count, questions_count, 
                 correct_answers, created_at, completed_at
          FROM exercises 
          WHERE invitation_code = ? 
          ORDER BY created_at DESC 
          LIMIT ? OFFSET ?
        ` : `
          SELECT id, exercise_data, created_at
          FROM exercises 
          WHERE invitation_code = ? 
          ORDER BY created_at DESC 
          LIMIT ? OFFSET ?
        `
      })(),
      
      // 错题相关
      saveWrongAnswer: `
        INSERT INTO wrong_answers (
          id, invitation_code, exercise_id, question_index, question_type,
          question_text, question_options, user_answer, correct_answer,
          transcript_snippet, topic, difficulty, tags, error_analysis,
          detailed_analysis_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      
      // 统计相关
      updateUserStats: `
        INSERT INTO user_statistics (
          invitation_code, total_exercises, total_questions, correct_answers, 
          wrong_answers, accuracy_rate, last_exercise_date, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(invitation_code) DO UPDATE SET
          total_exercises = total_exercises + ?,
          total_questions = total_questions + ?,
          correct_answers = correct_answers + ?,
          wrong_answers = wrong_answers + ?,
          accuracy_rate = CASE 
            WHEN (total_questions + ?) > 0 
            THEN ROUND((correct_answers + ?) * 100.0 / (total_questions + ?), 2)
            ELSE 0 
          END,
          last_exercise_date = ?,
          updated_at = CURRENT_TIMESTAMP
      `
    }

    for (const [key, sql] of Object.entries(statements)) {
      this.preparedStatements.set(key, this.db.prepare(sql))
    }
  }

  private getStatement(key: string): Database.Statement {
    const stmt = this.preparedStatements.get(key)
    if (!stmt) {
      throw createApiError.databaseError(`Prepared statement not found: ${key}`)
    }
    return stmt
  }

  // 邀请码验证（优化版）
  verifyInvitationCode(code: string): boolean {
    try {
      const stmt = this.getStatement('verifyInvitationCode')
      const result = stmt.get(code) as { code: string; is_active?: number } | undefined
      
      if (result) {
        // 如果有is_active字段，检查其值；否则认为是有效的
        const isActive = result.is_active === undefined || result.is_active === 1
        
        if (isActive) {
          // 更新活跃时间和使用计数
          const updateStmt = this.getStatement('updateInvitationActivity')
          updateStmt.run(code)
          return true
        }
      }
      
      return false
    } catch (error) {
      console.error('Database error in verifyInvitationCode:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 获取今日使用次数（优化版）
  getTodayUsageCount(invitationCode: string): number {
    try {
      const today = new Date().toISOString().split('T')[0]
      const stmt = this.getStatement('getTodayUsage')
      const result = stmt.get(invitationCode, today) as { usage_count: number } | undefined
      
      return result?.usage_count || 0
    } catch (error) {
      console.error('Database error in getTodayUsageCount:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 增加使用次数（优化版）
  incrementUsageCount(invitationCode: string): boolean {
    try {
      const today = new Date().toISOString().split('T')[0]
      const currentCount = this.getTodayUsageCount(invitationCode)
      
      if (currentCount >= 5) {
        return false
      }

      const stmt = this.getStatement('incrementUsage')
      stmt.run(invitationCode, today)
      return true
    } catch (error) {
      console.error('Database error in incrementUsageCount:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 保存练习记录（优化版，包含事务）
  saveExercise(exercise: Exercise, invitationCode: string): boolean {
    const transaction = this.db.transaction(() => {
      try {
        // 检查数据库结构
        const hasExtendedFields = this.hasExtendedExerciseFields()
        
        // 保存练习记录
        const stmt = this.getStatement('saveExercise')
        
        if (hasExtendedFields) {
          stmt.run(
            exercise.id,
            invitationCode,
            exercise.difficulty,
            exercise.topic,
            exercise.transcript,
            exercise.transcript.split(' ').length,
            exercise.questions.length,
            exercise.results.filter(r => r.is_correct).length,
            JSON.stringify(exercise)
          )
        } else {
          // 兼容旧数据库结构
          stmt.run(
            exercise.id,
            invitationCode,
            JSON.stringify(exercise)
          )
        }

        // 更新用户统计（如果表存在）
        try {
          this.updateUserStatistics(
            invitationCode,
            1, // exercises
            exercise.questions.length, // total questions
            exercise.results.filter(r => r.is_correct).length, // correct
            exercise.results.filter(r => !r.is_correct).length // wrong
          )
        } catch (error) {
          // 用户统计表可能不存在，继续执行
          console.warn('Could not update user statistics:', error)
        }

        return true
      } catch (error) {
        console.error('Database error in saveExercise:', error)
        throw createApiError.databaseError(error)
      }
    })

    return transaction()
  }

  // 检查是否有扩展的练习字段
  private hasExtendedExerciseFields(): boolean {
    try {
      const tableInfo = this.db.prepare(`PRAGMA table_info(exercises)`).all() as any[]
      return tableInfo.some(col => col.name === 'difficulty') &&
             tableInfo.some(col => col.name === 'word_count')
    } catch {
      return false
    }
  }

  // 更新用户统计（私有方法）
  private updateUserStatistics(
    invitationCode: string,
    exercisesDelta: number,
    questionsDelta: number,
    correctDelta: number,
    wrongDelta: number
  ): void {
    const stmt = this.getStatement('updateUserStats')
    const today = new Date().toISOString().split('T')[0]
    
    stmt.run(
      invitationCode,
      exercisesDelta,
      questionsDelta,
      correctDelta,
      wrongDelta,
      100, // dummy accuracy for new record
      today,
      exercisesDelta,
      questionsDelta,
      correctDelta,
      wrongDelta,
      questionsDelta,
      correctDelta,
      questionsDelta,
      today
    )
  }

  // 获取练习历史（分页，优化版）
  getExerciseHistory(
    invitationCode: string,
    limit: number = 10,
    offset: number = 0
  ): { exercises: Exercise[]; total: number } {
    try {
      // 获取总数
      const countStmt = this.db.prepare(
        'SELECT COUNT(*) as total FROM exercises WHERE invitation_code = ?'
      )
      const { total } = countStmt.get(invitationCode) as { total: number }

      // 获取分页数据
      const stmt = this.getStatement('getExerciseHistory')
      const rows = stmt.all(invitationCode, limit, offset) as any[]
      
      // 如果需要完整数据，再查询exercise_data
      const exercises = rows.map(row => {
        const fullDataStmt = this.db.prepare(
          'SELECT exercise_data FROM exercises WHERE id = ?'
        )
        const { exercise_data } = fullDataStmt.get(row.id) as { exercise_data: string }
        return JSON.parse(exercise_data)
      })

      return { exercises, total }
    } catch (error) {
      console.error('Database error in getExerciseHistory:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 批量保存错题（优化版，事务处理）
  batchSaveWrongAnswers(wrongAnswers: any[]): number {
    if (wrongAnswers.length === 0) return 0

    const transaction = this.db.transaction(() => {
      let savedCount = 0
      const stmt = this.getStatement('saveWrongAnswer')

      for (const wrongAnswer of wrongAnswers) {
        try {
          stmt.run(
            wrongAnswer.id,
            wrongAnswer.invitation_code,
            wrongAnswer.exercise_id,
            wrongAnswer.question_index,
            wrongAnswer.question_data.type,
            wrongAnswer.question_data.question,
            wrongAnswer.question_data.options ? JSON.stringify(wrongAnswer.question_data.options) : null,
            wrongAnswer.user_answer,
            wrongAnswer.correct_answer,
            wrongAnswer.transcript_snippet,
            wrongAnswer.topic,
            wrongAnswer.difficulty,
            JSON.stringify(wrongAnswer.tags),
            wrongAnswer.error_analysis
          )

          // 更新用户薄弱点统计
          this.updateUserWeakness(wrongAnswer.invitation_code, wrongAnswer.tags)
          savedCount++
        } catch (error) {
          console.error(`Failed to save wrong answer ${wrongAnswer.id}:`, error)
          // 继续处理其他错题，不抛出异常
        }
      }

      return savedCount
    })

    return transaction()
  }

  // 更新用户薄弱点统计（优化版）
  private updateUserWeakness(invitationCode: string, tags: string[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO user_weakness (invitation_code, tag_name, frequency, last_occurrence, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(invitation_code, tag_name) DO UPDATE SET
        frequency = frequency + 1,
        last_occurrence = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `)

    for (const tag of tags) {
      try {
        stmt.run(invitationCode, tag)
      } catch (error) {
        console.error(`Failed to update user weakness for tag ${tag}:`, error)
      }
    }
  }

  // 获取用户薄弱点（优化版，包含趋势分析）
  getUserWeakness(
    invitationCode: string,
    limit: number = 10
  ): UserWeakness[] {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          uw.tag_name,
          et.tag_name_cn,
          et.category,
          et.color,
          uw.frequency,
          uw.last_occurrence,
          uw.improvement_rate,
          uw.trend_direction,
          -- 计算最近7天内的错误次数
          (
            SELECT COUNT(*) 
            FROM wrong_answers wa 
            WHERE wa.invitation_code = uw.invitation_code 
            AND JSON_EXTRACT(wa.tags, '$') LIKE '%' || uw.tag_name || '%'
            AND wa.created_at >= datetime('now', '-7 days')
          ) as recent_errors
        FROM user_weakness uw
        JOIN error_tags et ON uw.tag_name = et.tag_name
        WHERE uw.invitation_code = ?
        ORDER BY uw.frequency DESC, uw.last_occurrence DESC
        LIMIT ?
      `)

      return stmt.all(invitationCode, limit) as UserWeakness[]
    } catch (error) {
      console.error('Database error in getUserWeakness:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 获取错题列表（优化版，支持复杂筛选）
  getWrongAnswers(
    invitationCode: string,
    filters?: {
      tags?: string[]
      category?: string
      difficulty?: string
      topic?: string
      limit?: number
      offset?: number
      sortBy?: 'created_at' | 'frequency'
      sortOrder?: 'asc' | 'desc'
    }
  ): { wrongAnswers: WrongAnswer[]; total: number } {
    try {
      const { tags, category, difficulty, topic, limit = 10, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = filters || {}
      
      let whereConditions = ['wa.invitation_code = ?']
      let params: any[] = [invitationCode]

      // 构建查询条件
      if (tags && tags.length > 0) {
        const tagConditions = tags.map(() => 'JSON_EXTRACT(wa.tags, "$") LIKE ?').join(' AND ')
        whereConditions.push(`(${tagConditions})`)
        params.push(...tags.map(tag => `%${tag}%`))
      }

      if (difficulty) {
        whereConditions.push('wa.difficulty = ?')
        params.push(difficulty)
      }

      if (topic) {
        whereConditions.push('wa.topic LIKE ?')
        params.push(`%${topic}%`)
      }

      if (category) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM json_each(wa.tags) je 
          JOIN error_tags et ON je.value = et.tag_name 
          WHERE et.category = ?
        )`)
        params.push(category)
      }

      const whereClause = whereConditions.join(' AND ')
      const orderClause = `ORDER BY wa.${sortBy} ${sortOrder.toUpperCase()}`

      // 获取总数
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM wrong_answers wa 
        WHERE ${whereClause}
      `
      const { total } = this.db.prepare(countQuery).get(...params) as { total: number }

      // 获取分页数据
      const dataQuery = `
        SELECT 
          wa.*,
          GROUP_CONCAT(et.tag_name_cn) as tag_names_cn,
          GROUP_CONCAT(et.color) as tag_colors
        FROM wrong_answers wa
        LEFT JOIN json_each(wa.tags) je ON 1=1
        LEFT JOIN error_tags et ON je.value = et.tag_name
        WHERE ${whereClause}
        GROUP BY wa.id
        ${orderClause}
        LIMIT ? OFFSET ?
      `
      
      const rows = this.db.prepare(dataQuery).all(...params, limit, offset) as any[]
      
      const wrongAnswers = rows.map(row => ({
        ...row,
        question_data: JSON.parse(row.question_options || '{}'),
        tags: JSON.parse(row.tags),
        highlighting_annotations: row.highlighting_annotations ? JSON.parse(row.highlighting_annotations) : null,
        tagDetails: row.tag_names_cn ? row.tag_names_cn.split(',').map((name: string, index: number) => ({
          tag_name_cn: name,
          color: row.tag_colors.split(',')[index]
        })) : []
      }))

      return { wrongAnswers, total }
    } catch (error) {
      console.error('Database error in getWrongAnswers:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 获取用户统计概览
  getUserStatisticsOverview(invitationCode: string): any {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          us.*,
          (
            SELECT COUNT(*) 
            FROM wrong_answers wa 
            WHERE wa.invitation_code = us.invitation_code 
            AND wa.created_at >= datetime('now', '-7 days')
          ) as recent_wrong_answers,
          (
            SELECT COUNT(*) 
            FROM exercises e 
            WHERE e.invitation_code = us.invitation_code 
            AND e.created_at >= datetime('now', '-7 days')
          ) as recent_exercises
        FROM user_statistics us
        WHERE us.invitation_code = ?
      `)

      return stmt.get(invitationCode)
    } catch (error) {
      console.error('Database error in getUserStatisticsOverview:', error)
      throw createApiError.databaseError(error)
    }
  }

  // 数据库健康检查
  healthCheck(): { status: 'healthy' | 'error'; details: any } {
    try {
      // 检查基本连接
      const result = this.db.prepare('SELECT 1 as test').get()
      
      // 检查表状态
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table'
      `).all()

      // 检查索引状态
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index'
      `).all()

      return {
        status: 'healthy',
        details: {
          connection: 'ok',
          tables: tables.length,
          indexes: indexes.length,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      }
    }
  }
}

// 导出优化的数据库操作实例
export const optimizedDbOperations = new OptimizedDbOperations()

// 导出数据库池管理器
export const databasePool = DatabasePool.getInstance()

// 优雅关闭
process.on('exit', () => {
  databasePool.closeAll()
})

process.on('SIGINT', () => {
  databasePool.closeAll()
  process.exit(0)
})

process.on('SIGTERM', () => {
  databasePool.closeAll()
  process.exit(0)
})