import Database from 'better-sqlite3'
import path from 'path'
import { Exercise } from './types'

const dbPath = path.join(process.cwd(), 'data', 'app.db')

// 确保数据目录存在
import fs from 'fs'
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 创建数据库连接
const db = new Database(dbPath)

// 初始化数据库表
function initializeDatabase() {
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      color TEXT NOT NULL
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
      PRIMARY KEY (invitation_code, tag_name)
    )
  `)

  // 初始化标签数据
  initializeErrorTags()

  // 扩展wrong_answers表，添加详细分析字段
  extendWrongAnswersTable()

  console.log('✅ Database initialized successfully')
}

// 扩展wrong_answers表结构
function extendWrongAnswersTable() {
  // 检查并添加详细分析相关字段
  const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
    try {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`)
    } catch (error) {
      // 如果字段已存在，忽略错误
      if (error instanceof Error && !error.message.includes('duplicate column name')) {
        console.error(`Error adding column ${columnName}:`, error)
      }
    }
  }

  // 添加新字段
  addColumnIfNotExists('wrong_answers', 'extended_error_analysis', 'TEXT') // 详细错误分析，约100字
  addColumnIfNotExists('wrong_answers', 'solution_tips', 'TEXT') // 答题技巧，约100字
  addColumnIfNotExists('wrong_answers', 'highlighting_annotations', 'TEXT') // JSON格式的高亮标注信息
  addColumnIfNotExists('wrong_answers', 'detailed_analysis_status', 'TEXT DEFAULT "pending"') // 状态: pending, generating, completed, failed
  addColumnIfNotExists('wrong_answers', 'language', 'TEXT DEFAULT "en-US"') // 听力语言
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
    
    // 补充缺失的标签
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

// 初始化数据库
initializeDatabase()

// 数据库操作函数
export const dbOperations = {
  // 验证邀请码是否存在
  verifyInvitationCode(code: string): boolean {
    const stmt = db.prepare('SELECT code FROM invitations WHERE code = ?')
    const result = stmt.get(code)
    
    if (result) {
      // 更新最后活跃时间
      const updateStmt = db.prepare('UPDATE invitations SET last_active_at = CURRENT_TIMESTAMP WHERE code = ?')
      updateStmt.run(code)
      return true
    }
    
    return false
  },

  // 创建邀请码
  createInvitationCode(code: string): boolean {
    try {
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
    const stmt = db.prepare('SELECT * FROM invitations ORDER BY created_at DESC')
    return stmt.all() as Array<{code: string, created_at: string, last_active_at: string}>
  },

  // 删除邀请码
  deleteInvitationCode(code: string): boolean {
    try {
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

  // 检查今日使用次数
  getTodayUsageCount(invitationCode: string): number {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const stmt = db.prepare('SELECT usage_count FROM daily_usage WHERE invitation_code = ? AND date = ?')
    const result = stmt.get(invitationCode, today) as {usage_count: number} | undefined
    
    return result?.usage_count || 0
  },

  // 增加使用次数
  incrementUsageCount(invitationCode: string): boolean {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const currentCount = this.getTodayUsageCount(invitationCode)
    
    if (currentCount >= 5) {
      return false // 已达到每日限制
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO daily_usage (invitation_code, date, usage_count) 
        VALUES (?, ?, 1)
        ON CONFLICT(invitation_code, date) 
        DO UPDATE SET usage_count = usage_count + 1
      `)
      stmt.run(invitationCode, today)
      return true
    } catch (error) {
      console.error('Failed to increment usage count:', error)
      return false
    }
  },

  // 保存练习记录
  saveExercise(exercise: Exercise, invitationCode: string): boolean {
    try {
      const stmt = db.prepare('INSERT INTO exercises (id, invitation_code, exercise_data) VALUES (?, ?, ?)')
      stmt.run(exercise.id, invitationCode, JSON.stringify(exercise))
      return true
    } catch (error) {
      console.error('Failed to save exercise:', error)
      return false
    }
  },

  // 获取练习历史记录
  getExerciseHistory(invitationCode: string, limit: number = 10): Exercise[] {
    const stmt = db.prepare(`
      SELECT exercise_data FROM exercises 
      WHERE invitation_code = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `)
    const results = stmt.all(invitationCode, limit) as Array<{exercise_data: string}>
    
    return results.map(row => JSON.parse(row.exercise_data))
  },

  // 获取使用统计
  getUsageStats(): Array<{invitation_code: string, total_exercises: number, last_exercise: string}> {
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
  },

  // 获取每日使用统计
  getDailyUsageStats(): Array<{invitation_code: string, date: string, usage_count: number}> {
    const stmt = db.prepare(`
      SELECT invitation_code, date, usage_count 
      FROM daily_usage 
      ORDER BY date DESC, usage_count DESC
      LIMIT 50
    `)
    return stmt.all() as Array<{invitation_code: string, date: string, usage_count: number}>
  },

  // === 错题本相关操作 ===

  // 保存错题记录
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
    language: string
    tags: string[]
    error_analysis?: string
  }): boolean {
    try {
      const stmt = db.prepare(`
        INSERT INTO wrong_answers (
          id, invitation_code, exercise_id, question_index, 
          question_data, user_answer, correct_answer, 
          transcript_snippet, topic, difficulty, language, tags, error_analysis,
          detailed_analysis_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
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
        wrongAnswer.language,
        JSON.stringify(wrongAnswer.tags),
        wrongAnswer.error_analysis
      )

      // 更新用户薄弱点统计
      this.updateUserWeakness(wrongAnswer.invitation_code, wrongAnswer.tags)
      
      return true
    } catch (error) {
      console.error('Failed to save wrong answer:', error)
      return false
    }
  },

  // 获取错题列表
  getWrongAnswers(invitation_code: string, filters?: {
    tags?: string[]
    category?: string
    limit?: number
    offset?: number
  }): Array<any> {
    let query = `
      SELECT w.*, et.tag_name_cn, et.category, et.color
      FROM wrong_answers w
      LEFT JOIN json_each(w.tags) je ON 1=1
      LEFT JOIN error_tags et ON je.value = et.tag_name
      WHERE w.invitation_code = ?
    `
    const params: any[] = [invitation_code]

    if (filters?.tags && filters.tags.length > 0) {
      const tagPlaceholders = filters.tags.map(() => '?').join(',')
      query += ` AND EXISTS (
        SELECT 1 FROM json_each(w.tags) 
        WHERE value IN (${tagPlaceholders})
      )`
      params.push(...filters.tags)
    }

    if (filters?.category) {
      query += ` AND et.category = ?`
      params.push(filters.category)
    }

    query += ` ORDER BY w.created_at DESC`

    if (filters?.limit) {
      query += ` LIMIT ?`
      params.push(filters.limit)
      
      if (filters?.offset) {
        query += ` OFFSET ?`
        params.push(filters.offset)
      }
    }

    const stmt = db.prepare(query)
    const results = stmt.all(...params)
    
    // 将结果按错题分组，每个错题包含其所有标签
    const wrongAnswersMap = new Map()
    
    results.forEach((row: any) => {
      if (!wrongAnswersMap.has(row.id)) {
        wrongAnswersMap.set(row.id, {
          ...row,
          question_data: JSON.parse(row.question_data),
          tags: JSON.parse(row.tags),
          tagDetails: []
        })
      }
      
      if (row.tag_name_cn) {
        wrongAnswersMap.get(row.id).tagDetails.push({
          tag_name: row.tag_name,
          tag_name_cn: row.tag_name_cn,
          category: row.category,
          color: row.color
        })
      }
    })
    
    return Array.from(wrongAnswersMap.values())
  },

  // 获取用户标签统计
  getUserTagStats(invitation_code: string): Array<{
    tag_name: string
    tag_name_cn: string
    category: string
    color: string
    count: number
    last_occurrence: string
  }> {
    const stmt = db.prepare(`
      SELECT 
        et.tag_name,
        et.tag_name_cn,
        et.category,
        et.color,
        COUNT(*) as count,
        MAX(w.created_at) as last_occurrence
      FROM wrong_answers w
      JOIN json_each(w.tags) je ON 1=1
      JOIN error_tags et ON je.value = et.tag_name
      WHERE w.invitation_code = ?
      GROUP BY et.tag_name, et.tag_name_cn, et.category, et.color
      ORDER BY count DESC, last_occurrence DESC
    `)
    
    return stmt.all(invitation_code) as Array<{
      tag_name: string
      tag_name_cn: string
      category: string
      color: string
      count: number
      last_occurrence: string
    }>
  },

  // 获取所有标签定义
  getAllErrorTags(): Array<{
    tag_name: string
    tag_name_cn: string
    category: string
    description: string
    color: string
  }> {
    const stmt = db.prepare(`
      SELECT tag_name, tag_name_cn, category, description, color
      FROM error_tags
      ORDER BY category, tag_name
    `)
    return stmt.all() as Array<{
      tag_name: string
      tag_name_cn: string
      category: string
      description: string
      color: string
    }>
  },

  // 更新用户薄弱点统计
  updateUserWeakness(invitation_code: string, tags: string[]): void {
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
  },

  // 获取用户薄弱点
  getUserWeakness(invitation_code: string, limit: number = 10): Array<{
    tag_name: string
    tag_name_cn: string
    category: string
    color: string
    frequency: number
    last_occurrence: string
    improvement_rate: number
  }> {
    const stmt = db.prepare(`
      SELECT 
        uw.tag_name,
        et.tag_name_cn,
        et.category,
        et.color,
        uw.frequency,
        uw.last_occurrence,
        uw.improvement_rate
      FROM user_weakness uw
      JOIN error_tags et ON uw.tag_name = et.tag_name
      WHERE uw.invitation_code = ?
      ORDER BY uw.frequency DESC, uw.last_occurrence DESC
      LIMIT ?
    `)
    
    return stmt.all(invitation_code, limit) as Array<{
      tag_name: string
      tag_name_cn: string
      category: string
      color: string
      frequency: number
      last_occurrence: string
      improvement_rate: number
    }>
  },

  // 删除错题记录
  deleteWrongAnswer(id: string, invitation_code: string): boolean {
    try {
      const stmt = db.prepare('DELETE FROM wrong_answers WHERE id = ? AND invitation_code = ?')
      const result = stmt.run(id, invitation_code)
      return result.changes > 0
    } catch (error) {
      console.error('Failed to delete wrong answer:', error)
      return false
    }
  },

  // 清空用户所有错题
  clearUserWrongAnswers(invitation_code: string): boolean {
    try {
      // 删除错题记录
      db.prepare('DELETE FROM wrong_answers WHERE invitation_code = ?').run(invitation_code)
      // 删除薄弱点统计
      db.prepare('DELETE FROM user_weakness WHERE invitation_code = ?').run(invitation_code)
      return true
    } catch (error) {
      console.error('Failed to clear wrong answers:', error)
      return false
    }
  },

  // === 详细错题分析相关操作 ===

  // 获取需要生成详细分析的错题
  getWrongAnswersForDetailedAnalysis(invitation_code: string, limit: number = 10): Array<{
    id: string
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
  }> {
    const stmt = db.prepare(`
      SELECT id, exercise_id, question_index, question_data, user_answer, 
             correct_answer, transcript_snippet, topic, difficulty, tags, error_analysis
      FROM wrong_answers 
      WHERE invitation_code = ? AND detailed_analysis_status = 'pending'
      ORDER BY created_at DESC
      LIMIT ?
    `)
    
    const results = stmt.all(invitation_code, limit) as Array<any>
    return results.map(row => ({
      ...row,
      question_data: JSON.parse(row.question_data),
      tags: JSON.parse(row.tags)
    }))
  },

  // 更新错题的详细分析状态
  updateDetailedAnalysisStatus(id: string, status: 'pending' | 'generating' | 'completed' | 'failed'): boolean {
    try {
      const stmt = db.prepare('UPDATE wrong_answers SET detailed_analysis_status = ? WHERE id = ?')
      const result = stmt.run(status, id)
      return result.changes > 0
    } catch (error) {
      console.error('Failed to update detailed analysis status:', error)
      return false
    }
  },

  // 保存详细分析结果
  saveDetailedAnalysis(id: string, analysisData: {
    extended_error_analysis: string
    solution_tips: string
    highlighting_annotations: any
  }): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE wrong_answers 
        SET extended_error_analysis = ?, 
            solution_tips = ?, 
            highlighting_annotations = ?,
            detailed_analysis_status = 'completed'
        WHERE id = ?
      `)
      
      const result = stmt.run(
        analysisData.extended_error_analysis,
        analysisData.solution_tips,
        JSON.stringify(analysisData.highlighting_annotations),
        id
      )
      
      return result.changes > 0
    } catch (error) {
      console.error('Failed to save detailed analysis:', error)
      return false
    }
  },

  // 获取错题的详细分析（包含新字段）
  getWrongAnswerWithDetailedAnalysis(id: string): any | null {
    const stmt = db.prepare(`
      SELECT w.*, et.tag_name_cn, et.category, et.color
      FROM wrong_answers w
      LEFT JOIN json_each(w.tags) je ON 1=1
      LEFT JOIN error_tags et ON je.value = et.tag_name
      WHERE w.id = ?
    `)
    
    const results = stmt.all(id) as Array<any>
    
    if (results.length === 0) return null
    
    // 组织数据结构
    const wrongAnswer = {
      ...results[0],
      question_data: JSON.parse(results[0].question_data),
      tags: JSON.parse(results[0].tags),
      highlighting_annotations: results[0].highlighting_annotations ? JSON.parse(results[0].highlighting_annotations) : null,
      tagDetails: []
    }
    
    // 收集所有标签详情
    const tagDetailsMap = new Map()
    results.forEach(row => {
      if (row.tag_name_cn && !tagDetailsMap.has(row.tag_name)) {
        tagDetailsMap.set(row.tag_name, {
          tag_name: row.tag_name,
          tag_name_cn: row.tag_name_cn,
          category: row.category,
          color: row.color
        })
      }
    })
    
    wrongAnswer.tagDetails = Array.from(tagDetailsMap.values())
    
    return wrongAnswer
  },

  // 批量更新错题的详细分析状态（用于新产生的错题）
  markNewWrongAnswersForDetailedAnalysis(invitation_code: string, exercise_id: string): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE wrong_answers 
        SET detailed_analysis_status = 'pending'
        WHERE invitation_code = ? AND exercise_id = ? AND detailed_analysis_status IS NULL
      `)
      
      const result = stmt.run(invitation_code, exercise_id)
      return result.changes > 0
    } catch (error) {
      console.error('Failed to mark wrong answers for detailed analysis:', error)
      return false
    }
  }
}

// 生成随机邀请码
export function generateInvitationCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 优雅关闭数据库连接
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

export default db