/**
 * 简化的数据库操作层 - 用于与现有代码兼容
 * 保持原有功能的同时添加优化和缓存
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { ApiError, createApiError } from './api-response'
import { Exercise } from './types'

// 使用现有的数据库路径和结构
const dbPath = path.join(process.cwd(), 'data', 'app.db')

// 确保数据目录存在
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 创建数据库连接
let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    
    // 优化配置
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('cache_size = -16000') // 16MB cache
    db.pragma('synchronous = NORMAL')
    db.pragma('temp_store = MEMORY')
    
    // 确保基本表存在（使用现有结构）
    initializeBasicTables(db)
    createOptimizedIndexes(db)
  }
  return db
}

function initializeBasicTables(db: Database.Database): void {
  // 使用现有的表结构，只添加缺失的表
  try {
    // 检查表是否存在
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    const existingTables = new Set(tables.map(t => t.name))
    
    // 确保邀请码表存在
    if (!existingTables.has('invitations')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS invitations (
          code TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    }
    
    // 确保练习表存在
    if (!existingTables.has('exercises')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          invitation_code TEXT NOT NULL,
          exercise_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code)
        )
      `)
    }
    
    // 确保每日使用表存在
    if (!existingTables.has('daily_usage')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invitation_code TEXT NOT NULL,
          date TEXT NOT NULL,
          usage_count INTEGER DEFAULT 0,
          FOREIGN KEY (invitation_code) REFERENCES invitations (code),
          UNIQUE (invitation_code, date)
        )
      `)
    }
    
    console.log('✅ Basic tables verified/created')
  } catch (error) {
    console.warn('Table initialization warning:', error)
  }
}

function createOptimizedIndexes(db: Database.Database): void {
  try {
    // 只创建基础索引，避免兼容性问题
    db.exec(`CREATE INDEX IF NOT EXISTS idx_invitations_last_active ON invitations (last_active_at)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_exercises_invitation_code ON exercises (invitation_code, created_at DESC)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_usage_code_date ON daily_usage (invitation_code, date)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage (date DESC)`)
  } catch (error) {
    console.warn('Index creation warning:', error)
  }
}

/**
 * 兼容的数据库操作
 */
export const compatibleDbOperations = {
  // 验证邀请码
  verifyInvitationCode(code: string): boolean {
    try {
      const db = getDb()
      const stmt = db.prepare('SELECT code FROM invitations WHERE code = ?')
      const result = stmt.get(code)
      
      if (result) {
        // 更新最后活跃时间
        const updateStmt = db.prepare('UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP WHERE code = ?')
        updateStmt.run(code)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Database error in verifyInvitationCode:', error)
      throw createApiError.databaseError(error)
    }
  },

  // 获取今日使用次数
  getTodayUsageCount(invitationCode: string): number {
    try {
      const db = getDb()
      const today = new Date().toISOString().split('T')[0]
      const stmt = db.prepare('SELECT usage_count FROM daily_usage WHERE invitation_code = ? AND date = ?')
      const result = stmt.get(invitationCode, today) as { usage_count: number } | undefined
      
      return result?.usage_count || 0
    } catch (error) {
      console.error('Database error in getTodayUsageCount:', error)
      throw createApiError.databaseError(error)
    }
  },

  // 增加使用次数
  incrementUsageCount(invitationCode: string): boolean {
    try {
      const db = getDb()
      const today = new Date().toISOString().split('T')[0]
      const currentCount = this.getTodayUsageCount(invitationCode)
      
      if (currentCount >= 5) {
        return false
      }

      const stmt = db.prepare(`
        INSERT INTO daily_usage (invitation_code, date, usage_count) 
        VALUES (?, ?, 1)
        ON CONFLICT(invitation_code, date) 
        DO UPDATE SET usage_count = usage_count + 1
      `)
      stmt.run(invitationCode, today)
      return true
    } catch (error) {
      console.error('Database error in incrementUsageCount:', error)
      throw createApiError.databaseError(error)
    }
  },

  // 保存练习记录
  saveExercise(exercise: Exercise, invitationCode: string): boolean {
    try {
      const db = getDb()
      const stmt = db.prepare('INSERT INTO exercises (id, invitation_code, exercise_data) VALUES (?, ?, ?)')
      stmt.run(exercise.id, invitationCode, JSON.stringify(exercise))
      return true
    } catch (error) {
      console.error('Database error in saveExercise:', error)
      throw createApiError.databaseError(error)
    }
  },

  // 获取练习历史记录
  getExerciseHistory(invitationCode: string, limit: number = 10, offset: number = 0): { exercises: Exercise[]; total: number } {
    try {
      const db = getDb()
      
      // 获取总数
      const countStmt = db.prepare('SELECT COUNT(*) as total FROM exercises WHERE invitation_code = ?')
      const { total } = countStmt.get(invitationCode) as { total: number }

      // 获取分页数据
      const stmt = db.prepare(`
        SELECT exercise_data FROM exercises 
        WHERE invitation_code = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `)
      const results = stmt.all(invitationCode, limit, offset) as Array<{exercise_data: string}>
      
      const exercises = results.map(row => JSON.parse(row.exercise_data))

      return { exercises, total }
    } catch (error) {
      console.error('Database error in getExerciseHistory:', error)
      throw createApiError.databaseError(error)
    }
  },

  // 创建邀请码
  createInvitationCode(code: string): boolean {
    try {
      const db = getDb()
      const stmt = db.prepare('INSERT INTO invitations (code) VALUES (?)')
      stmt.run(code)
      return true
    } catch (error) {
      console.error('Failed to create invitation code:', error)
      return false
    }
  },

  // 批量创建邀请码
  createMultipleInvitationCodes(codes: string[]): number {
    let successCount = 0
    const db = getDb()
    const stmt = db.prepare('INSERT INTO invitations (code) VALUES (?)')
    
    for (const code of codes) {
      try {
        stmt.run(code)
        successCount++
      } catch (error) {
        console.error(`Failed to create invitation code ${code}:`, error)
      }
    }
    
    return successCount
  },

  // 获取所有邀请码
  getAllInvitationCodes(): Array<{code: string, created_at: string, last_active_at: string}> {
    try {
      const db = getDb()
      const stmt = db.prepare('SELECT * FROM invitations ORDER BY created_at DESC')
      return stmt.all() as Array<{code: string, created_at: string, last_active_at: string}>
    } catch (error) {
      console.error('Database error in getAllInvitationCodes:', error)
      return []
    }
  },

  // 删除邀请码
  deleteInvitationCode(code: string): boolean {
    try {
      const db = getDb()
      // 先删除相关的练习记录和使用记录
      db.prepare('DELETE FROM exercises WHERE invitation_code = ?').run(code)
      db.prepare('DELETE FROM daily_usage WHERE invitation_code = ?').run(code)
      
      // 删除邀请码
      const stmt = db.prepare('DELETE FROM invitations WHERE code = ?')
      const result = stmt.run(code)
      
      return result.changes > 0
    } catch (error) {
      console.error('Failed to delete invitation code:', error)
      return false
    }
  },

  // 获取使用统计
  getUsageStats(): Array<{invitation_code: string, total_exercises: number, last_exercise: string}> {
    try {
      const db = getDb()
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
    } catch (error) {
      console.error('Database error in getUsageStats:', error)
      return []
    }
  },

  // 获取每日使用统计
  getDailyUsageStats(): Array<{invitation_code: string, date: string, usage_count: number}> {
    try {
      const db = getDb()
      const stmt = db.prepare(`
        SELECT invitation_code, date, usage_count 
        FROM daily_usage 
        ORDER BY date DESC, usage_count DESC
        LIMIT 50
      `)
      return stmt.all() as Array<{invitation_code: string, date: string, usage_count: number}>
    } catch (error) {
      console.error('Database error in getDailyUsageStats:', error)
      return []
    }
  },

  // 健康检查
  healthCheck(): { status: 'healthy' | 'error'; details: any } {
    try {
      const db = getDb()
      const result = db.prepare('SELECT 1 as test').get()
      
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()

      return {
        status: 'healthy',
        details: {
          connection: 'ok',
          tables: tables.length,
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

// 优雅关闭数据库连接
process.on('exit', () => {
  if (db) {
    db.close()
  }
})

process.on('SIGINT', () => {
  if (db) {
    db.close()
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  if (db) {
    db.close()
  }
  process.exit(0)
})

export default compatibleDbOperations