/**
 * 数据库优化迁移脚本
 * 安全地将现有数据库升级到优化版本
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = path.join(process.cwd(), 'data', 'app.db')
const backupPath = path.join(process.cwd(), 'data', `app_backup_${Date.now()}.db`)

interface MigrationResult {
  success: boolean
  message: string
  backupPath?: string
  migratedTables: string[]
  errors: string[]
}

class DatabaseMigration {
  private db: Database.Database
  private backupDb: Database.Database

  constructor() {
    // 创建数据库备份
    this.createBackup()
    
    this.db = new Database(dbPath)
    this.backupDb = new Database(backupPath)
    
    // 启用外键约束
    this.db.pragma('foreign_keys = ON')
  }

  // 创建完整数据库备份
  private createBackup(): void {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath)
      console.log(`✅ Database backup created: ${backupPath}`)
    }
  }

  // 执行完整迁移
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      message: '',
      backupPath,
      migratedTables: [],
      errors: []
    }

    try {
      console.log('🚀 Starting database migration...')

      // 阶段1: 结构检查和准备
      await this.checkCurrentStructure()
      
      // 阶段2: 创建新表结构
      await this.createOptimizedTables()
      result.migratedTables.push('new_tables_created')

      // 阶段3: 数据迁移
      await this.migrateData()
      result.migratedTables.push('data_migrated')

      // 阶段4: 创建优化索引
      await this.createOptimizedIndexes()
      result.migratedTables.push('indexes_created')

      // 阶段5: 创建触发器
      await this.createTriggers()
      result.migratedTables.push('triggers_created')

      // 阶段6: 数据验证
      await this.validateMigration()
      result.migratedTables.push('validation_passed')

      // 阶段7: 清理旧结构
      await this.cleanupOldStructure()
      result.migratedTables.push('cleanup_completed')

      result.success = true
      result.message = 'Database migration completed successfully'
      
      console.log('✅ Database migration completed successfully')
      return result

    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('❌ Migration failed:', error)
      
      // 尝试回滚
      await this.rollback()
      return result
    }
  }

  // 检查当前数据库结构
  private async checkCurrentStructure(): Promise<void> {
    console.log('📋 Checking current database structure...')
    
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as {name: string}[]

    console.log(`Found ${tables.length} existing tables:`, tables.map(t => t.name))

    // 检查关键表是否存在
    const requiredTables = ['invitations', 'exercises', 'daily_usage', 'wrong_answers', 'error_tags']
    for (const table of requiredTables) {
      if (!tables.find(t => t.name === table)) {
        throw new Error(`Required table '${table}' not found`)
      }
    }
  }

  // 创建优化的表结构
  private async createOptimizedTables(): Promise<void> {
    console.log('🔧 Creating optimized table structures...')

    const transaction = this.db.transaction(() => {
      // 创建错题标签关联表（新表）
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS wrong_answer_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wrong_answer_id TEXT NOT NULL,
          tag_name TEXT NOT NULL,
          confidence_score REAL DEFAULT 1.0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(wrong_answer_id, tag_name)
        )
      `)

      // 创建用户统计汇总表（新表）
      this.db.exec(`
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
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // 创建标签统计表（新表）
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tag_statistics (
          tag_name TEXT,
          invitation_code TEXT,
          occurrence_count INTEGER DEFAULT 0,
          last_occurrence DATETIME,
          improvement_trend REAL DEFAULT 0.0,
          PRIMARY KEY (tag_name, invitation_code)
        )
      `)

      // 为existing tables添加新字段
      this.addMissingColumns()
    })

    transaction()
    console.log('✅ Optimized table structures created')
  }

  // 添加缺失的列
  private addMissingColumns(): void {
    const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
      try {
        this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`)
        console.log(`  ✓ Added column ${columnName} to ${tableName}`)
      } catch (error) {
        if (error instanceof Error && !error.message.includes('duplicate column name')) {
          console.error(`  ✗ Error adding column ${columnName} to ${tableName}:`, error.message)
        }
      }
    }

    // 邀请码表新字段
    addColumnIfNotExists('invitations', 'updated_at', 'DATETIME')
    addColumnIfNotExists('invitations', 'is_active', 'BOOLEAN DEFAULT 1')
    addColumnIfNotExists('invitations', 'max_daily_usage', 'INTEGER DEFAULT 5')
    addColumnIfNotExists('invitations', 'total_usage_count', 'INTEGER DEFAULT 0')

    // 练习表新字段
    addColumnIfNotExists('exercises', 'updated_at', 'DATETIME')
    addColumnIfNotExists('exercises', 'difficulty', 'TEXT')
    addColumnIfNotExists('exercises', 'topic', 'TEXT')
    addColumnIfNotExists('exercises', 'question_count', 'INTEGER DEFAULT 0')
    addColumnIfNotExists('exercises', 'correct_count', 'INTEGER DEFAULT 0')
    addColumnIfNotExists('exercises', 'score', 'REAL DEFAULT 0.0')
    addColumnIfNotExists('exercises', 'duration_seconds', 'INTEGER DEFAULT 0')
    addColumnIfNotExists('exercises', 'completed_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')

    // 日使用表新字段
    addColumnIfNotExists('daily_usage', 'date_int', 'INTEGER')
    addColumnIfNotExists('daily_usage', 'last_updated', 'DATETIME')

    // 错题表新字段
    addColumnIfNotExists('wrong_answers', 'updated_at', 'DATETIME')
  }

  // 迁移数据
  private async migrateData(): Promise<void> {
    console.log('📦 Migrating existing data...')

    const transaction = this.db.transaction(() => {
      // 1. 迁移错题标签数据（从JSON到规范化存储）
      this.migrateWrongAnswerTags()

      // 2. 更新练习记录的统计字段
      this.updateExerciseStatistics()

      // 3. 更新日使用记录的date_int字段
      this.updateDailyUsageDateInt()

      // 4. 初始化用户统计数据
      this.initializeUserStatistics()

      // 5. 初始化标签统计数据
      this.initializeTagStatistics()
    })

    transaction()
    console.log('✅ Data migration completed')
  }

  // 迁移错题标签数据
  private migrateWrongAnswerTags(): void {
    console.log('  📋 Migrating wrong answer tags...')

    const wrongAnswers = this.db.prepare(`
      SELECT id, tags FROM wrong_answers WHERE tags IS NOT NULL AND tags != ''
    `).all() as {id: string, tags: string}[]

    const insertTag = this.db.prepare(`
      INSERT OR IGNORE INTO wrong_answer_tags (wrong_answer_id, tag_name)
      VALUES (?, ?)
    `)

    let migratedCount = 0
    for (const wa of wrongAnswers) {
      try {
        const tags = JSON.parse(wa.tags) as string[]
        for (const tag of tags) {
          insertTag.run(wa.id, tag)
          migratedCount++
        }
      } catch (error) {
        console.error(`  ⚠️ Failed to parse tags for wrong answer ${wa.id}:`, error)
      }
    }

    console.log(`  ✓ Migrated ${migratedCount} tag associations`)
  }

  // 更新练习统计数据
  private updateExerciseStatistics(): void {
    console.log('  📊 Updating exercise statistics...')

    const exercises = this.db.prepare(`
      SELECT id, exercise_data FROM exercises WHERE exercise_data IS NOT NULL
    `).all() as {id: string, exercise_data: string}[]

    const updateExercise = this.db.prepare(`
      UPDATE exercises 
      SET difficulty = ?, topic = ?, question_count = ?, correct_count = ?, score = ?
      WHERE id = ?
    `)

    let updatedCount = 0
    for (const exercise of exercises) {
      try {
        const data = JSON.parse(exercise.exercise_data)
        const questionCount = data.questions?.length || 0
        const correctCount = data.questions?.filter((q: any) => q.isCorrect)?.length || 0
        const score = questionCount > 0 ? (correctCount / questionCount) : 0

        updateExercise.run(
          data.difficulty || 'B1',
          data.topic || 'General',
          questionCount,
          correctCount,
          score,
          exercise.id
        )
        updatedCount++
      } catch (error) {
        console.error(`  ⚠️ Failed to parse exercise data for ${exercise.id}:`, error)
      }
    }

    console.log(`  ✓ Updated ${updatedCount} exercise records`)
  }

  // 更新日使用记录的date_int字段
  private updateDailyUsageDateInt(): void {
    console.log('  📅 Updating daily usage date_int fields...')

    const updates = this.db.prepare(`
      UPDATE daily_usage 
      SET date_int = CAST(REPLACE(date, '-', '') AS INTEGER)
      WHERE date_int IS NULL
    `).run()

    console.log(`  ✓ Updated ${updates.changes} daily usage records`)
  }

  // 初始化用户统计数据
  private initializeUserStatistics(): void {
    console.log('  👤 Initializing user statistics...')

    const result = this.db.prepare(`
      INSERT OR REPLACE INTO user_statistics (
        invitation_code, total_exercises, total_wrong_answers, 
        accuracy_rate, last_exercise_date
      )
      SELECT 
        i.code,
        COUNT(DISTINCT e.id),
        COUNT(DISTINCT wa.id),
        CASE 
          WHEN COUNT(DISTINCT e.id) > 0 THEN 
            1.0 - (CAST(COUNT(DISTINCT wa.id) AS REAL) / (COUNT(DISTINCT e.id) * 5.0))
          ELSE 0.0 
        END,
        MAX(COALESCE(e.completed_at, e.created_at))
      FROM invitations i
      LEFT JOIN exercises e ON i.code = e.invitation_code
      LEFT JOIN wrong_answers wa ON i.code = wa.invitation_code
      GROUP BY i.code
    `).run()

    console.log(`  ✓ Initialized statistics for ${result.changes} users`)
  }

  // 初始化标签统计数据
  private initializeTagStatistics(): void {
    console.log('  🏷️ Initializing tag statistics...')

    const result = this.db.prepare(`
      INSERT OR REPLACE INTO tag_statistics (
        tag_name, total_occurrences, unique_users, last_occurrence
      )
      SELECT 
        wat.tag_name,
        COUNT(*),
        COUNT(DISTINCT wa.invitation_code),
        MAX(wa.created_at)
      FROM wrong_answer_tags wat
      JOIN wrong_answers wa ON wat.wrong_answer_id = wa.id
      GROUP BY wat.tag_name
    `).run()

    console.log(`  ✓ Initialized ${result.changes} tag statistics`)
  }

  // 创建优化索引
  private async createOptimizedIndexes(): Promise<void> {
    console.log('🗂️ Creating optimized indexes...')

    const transaction = this.db.transaction(() => {
      // 复合索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_invitations_verification 
        ON invitations(code, is_active, last_active_at);
        
        CREATE INDEX IF NOT EXISTS idx_exercises_user_date 
        ON exercises(invitation_code, completed_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_exercises_difficulty_topic 
        ON exercises(difficulty, topic, completed_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_daily_usage_optimization 
        ON daily_usage(invitation_code, date_int, usage_count);
        
        CREATE INDEX IF NOT EXISTS idx_wrong_answers_user_date 
        ON wrong_answers(invitation_code, created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_wrong_answers_status_cover 
        ON wrong_answers(detailed_analysis_status, invitation_code, created_at);
      `)

      // 新表索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_wat_wrong_answer 
        ON wrong_answer_tags(wrong_answer_id);
        
        CREATE INDEX IF NOT EXISTS idx_wat_tag_name 
        ON wrong_answer_tags(tag_name);
        
        CREATE INDEX IF NOT EXISTS idx_user_stats_activity 
        ON user_statistics(last_exercise_date DESC);
        
        CREATE INDEX IF NOT EXISTS idx_tag_stats_count 
        ON tag_statistics(total_occurrences DESC);
      `)
    })

    transaction()
    console.log('✅ Optimized indexes created')
  }

  // 创建触发器
  private async createTriggers(): Promise<void> {
    console.log('⚡ Creating database triggers...')

    // 自动更新时间戳触发器
    this.db.exec(`
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

    // 自动维护统计数据触发器
    this.db.exec(`
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
            MAX(completed_at),
            CURRENT_TIMESTAMP
          FROM exercises 
          WHERE invitation_code = NEW.invitation_code;
        END;
    `)

    console.log('✅ Database triggers created')
  }

  // 验证迁移结果
  private async validateMigration(): Promise<void> {
    console.log('🔍 Validating migration results...')

    // 检查表结构
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as {name: string}[]

    const expectedTables = [
      'invitations', 'exercises', 'daily_usage', 'wrong_answers', 
      'error_tags', 'user_weakness', 'wrong_answer_tags', 
      'user_statistics', 'tag_statistics'
    ]

    for (const expectedTable of expectedTables) {
      if (!tables.find(t => t.name === expectedTable)) {
        throw new Error(`Expected table '${expectedTable}' not found after migration`)
      }
    }

    // 检查数据完整性
    const originalCounts = {
      invitations: this.backupDb.prepare('SELECT COUNT(*) as count FROM invitations').get() as {count: number},
      exercises: this.backupDb.prepare('SELECT COUNT(*) as count FROM exercises').get() as {count: number},
      wrong_answers: this.backupDb.prepare('SELECT COUNT(*) as count FROM wrong_answers').get() as {count: number}
    }

    const newCounts = {
      invitations: this.db.prepare('SELECT COUNT(*) as count FROM invitations').get() as {count: number},
      exercises: this.db.prepare('SELECT COUNT(*) as count FROM exercises').get() as {count: number},
      wrong_answers: this.db.prepare('SELECT COUNT(*) as count FROM wrong_answers').get() as {count: number}
    }

    for (const [table, originalCount] of Object.entries(originalCounts)) {
      const newCount = newCounts[table as keyof typeof newCounts]
      if (originalCount.count !== newCount.count) {
        throw new Error(`Data loss detected in table '${table}': ${originalCount.count} -> ${newCount.count}`)
      }
    }

    console.log('✅ Migration validation passed')
  }

  // 清理旧结构（可选）
  private async cleanupOldStructure(): Promise<void> {
    console.log('🧹 Cleaning up old structures...')

    // 删除冗余索引
    const oldIndexes = [
      'idx_exercises_invitation_code', // 被复合索引替代
      'idx_wrong_answers_invitation_code' // 被复合索引替代
    ]

    for (const indexName of oldIndexes) {
      try {
        this.db.exec(`DROP INDEX IF EXISTS ${indexName}`)
        console.log(`  ✓ Dropped redundant index: ${indexName}`)
      } catch (error) {
        console.error(`  ⚠️ Failed to drop index ${indexName}:`, error)
      }
    }

    // 运行VACUUM来回收空间
    this.db.exec('VACUUM')
    console.log('  ✓ Database vacuumed')

    // 更新统计信息
    this.db.exec('ANALYZE')
    console.log('  ✓ Statistics updated')

    console.log('✅ Cleanup completed')
  }

  // 回滚到备份
  private async rollback(): Promise<void> {
    console.log('🔄 Rolling back to backup...')
    
    try {
      this.db.close()
      fs.copyFileSync(backupPath, dbPath)
      console.log('✅ Database rolled back successfully')
    } catch (error) {
      console.error('❌ Rollback failed:', error)
    }
  }

  // 清理资源
  cleanup(): void {
    if (this.db && this.db.open) {
      this.db.close()
    }
    if (this.backupDb && this.backupDb.open) {
      this.backupDb.close()
    }
  }
}

// 导出迁移函数
export async function runDatabaseMigration(): Promise<MigrationResult> {
  const migration = new DatabaseMigration()
  
  try {
    const result = await migration.migrate()
    migration.cleanup()
    return result
  } catch (error) {
    migration.cleanup()
    throw error
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runDatabaseMigration()
    .then(result => {
      console.log('\n📊 Migration Summary:')
      console.log(`Success: ${result.success}`)
      console.log(`Message: ${result.message}`)
      console.log(`Backup: ${result.backupPath}`)
      console.log(`Migrated: ${result.migratedTables.join(', ')}`)
      
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.join(', ')}`)
      }
      
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Migration script failed:', error)
      process.exit(1)
    })
}