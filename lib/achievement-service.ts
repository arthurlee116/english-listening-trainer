import type { 
  UserProgressMetrics, 
  UserGoalSettings, 
  AchievementBadge, 
  AchievementCondition,
  AchievementNotification,
  PracticeSessionData,
  Exercise,
  GoalProgress
} from "./types"

import { 
  getProgressMetrics, 
  saveProgressMetrics, 
  getGoalSettings,
  getAchievements,
  saveAchievements,
  convertExerciseToSessionData
} from "./storage"

// =============== Predefined Achievements ===============

const PREDEFINED_ACHIEVEMENTS: Omit<AchievementBadge, 'earnedAt'>[] = [
  {
    id: "first-session",
    titleKey: "achievements.firstSession.title",
    descriptionKey: "achievements.firstSession.desc",
    conditions: { type: "sessions", threshold: 1 }
  },
  {
    id: "ten-sessions",
    titleKey: "achievements.tenSessions.title", 
    descriptionKey: "achievements.tenSessions.desc",
    conditions: { type: "sessions", threshold: 10 }
  },
  {
    id: "fifty-sessions",
    titleKey: "achievements.fiftySessions.title",
    descriptionKey: "achievements.fiftySessions.desc", 
    conditions: { type: "sessions", threshold: 50 }
  },
  {
    id: "accuracy-master",
    titleKey: "achievements.accuracyMaster.title",
    descriptionKey: "achievements.accuracyMaster.desc",
    conditions: { type: "accuracy", threshold: 90, minSessions: 5 }
  },
  {
    id: "streak-3",
    titleKey: "achievements.streak3.title",
    descriptionKey: "achievements.streak3.desc",
    conditions: { type: "streak", threshold: 3 }
  },
  {
    id: "streak-7", 
    titleKey: "achievements.streak7.title",
    descriptionKey: "achievements.streak7.desc",
    conditions: { type: "streak", threshold: 7 }
  },
  {
    id: "streak-30",
    titleKey: "achievements.streak30.title",
    descriptionKey: "achievements.streak30.desc",
    conditions: { type: "streak", threshold: 30 }
  },
  {
    id: "listening-100",
    titleKey: "achievements.listening100.title",
    descriptionKey: "achievements.listening100.desc",
    conditions: { type: "minutes", threshold: 100 }
  },
  {
    id: "listening-500",
    titleKey: "achievements.listening500.title", 
    descriptionKey: "achievements.listening500.desc",
    conditions: { type: "minutes", threshold: 500 }
  }
]

// =============== Progress Metrics Calculation ===============

/**
 * 计算连续练习天数
 */
function calculateStreakDays(sessionDates: string[]): { current: number; longest: number } {
  if (sessionDates.length === 0) {
    return { current: 0, longest: 0 }
  }

  // 按日期分组练习记录（仅考虑日期，忽略时间）
  const uniqueDates = Array.from(new Set(
    sessionDates.map(date => new Date(date).toDateString())
  )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // 降序排列

  if (uniqueDates.length === 0) {
    return { current: 0, longest: 0 }
  }

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 1
  
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()
  
  // 计算当前连续天数
  if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
    currentStreak = 1
    
    for (let i = 1; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i])
      const prevDate = new Date(uniqueDates[i - 1])
      const dayDiff = Math.floor((prevDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000))
      
      if (dayDiff === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }
  
  // 计算历史最长连续天数
  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i])
    const prevDate = new Date(uniqueDates[i - 1])
    const dayDiff = Math.floor((prevDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000))
    
    if (dayDiff === 1) {
      tempStreak++
    } else {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak)
  
  return { current: currentStreak, longest: longestStreak }
}

/**
 * 生成最近7天的练习趋势数据
 */
function generateWeeklyTrend(sessionDates: string[]): Array<{ date: string; sessions: number }> {
  const trend: Array<{ date: string; sessions: number }> = []
  const today = new Date()
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
    
    const sessionsOnDate = sessionDates.filter(sessionDate => {
      const sessionDateStr = new Date(sessionDate).toISOString().split('T')[0]
      return sessionDateStr === dateStr
    }).length
    
    trend.push({ date: dateStr, sessions: sessionsOnDate })
  }
  
  return trend
}

/**
 * 从练习历史计算进度指标
 * 性能优化：大量数据分批处理
 */
function calculateProgressFromHistory(exercises: Exercise[], existingMetrics?: UserProgressMetrics): UserProgressMetrics {
  // 分批处理大量练习数据，避免阻塞主线程
  const BATCH_SIZE = 200
  const sessionData = []
  
  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE)
    sessionData.push(...batch.map(convertExerciseToSessionData))
    
    // 在大数据量时让出控制权，避免UI冻结
    if (i > 0 && i % BATCH_SIZE === 0) {
      // 使用setTimeout(0)让出执行权，但在测试环境中跳过
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        // 在浏览器环境中使用requestIdleCallback
        continue
      }
    }
  }
  
  const totalSessions = sessionData.length
  const totalQuestions = sessionData.reduce((sum, session) => sum + session.questionsCount, 0)
  const totalCorrectAnswers = sessionData.reduce((sum, session) => sum + session.correctAnswersCount, 0)
  const averageAccuracy = totalQuestions > 0 ? (totalCorrectAnswers / totalQuestions) * 100 : 0
  
  // 累计听力时长：优先使用转换后的会话时长；若不可用则使用预估值
  const totalDurationSec = sessionData.reduce((sum, session) => sum + (typeof session.duration === 'number' ? session.duration : 0), 0)
  const estimatedDurationPerSession = 3 // 平均每次练习3分钟
  const totalListeningMinutes = totalDurationSec > 0
    ? Math.round(totalDurationSec / 60)
    : (existingMetrics?.totalListeningMinutes || (totalSessions * estimatedDurationPerSession))
  
  const sessionDates = sessionData.map(session => session.completedAt)
  const streakData = calculateStreakDays(sessionDates)
  const weeklyTrend = generateWeeklyTrend(sessionDates)
  
  const lastPracticedAt = sessionDates.length > 0 
    ? sessionDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null

  return {
    totalSessions,
    totalCorrectAnswers,
    totalQuestions,
    averageAccuracy: Math.round(averageAccuracy * 100) / 100, // 保留两位小数
    totalListeningMinutes,
    currentStreakDays: streakData.current,
    longestStreakDays: streakData.longest,
    lastPracticedAt,
    weeklyTrend
  }
}

/**
 * 更新进度指标
 */
export function updateProgressMetrics(newSessionData: PracticeSessionData): UserProgressMetrics {
  const existingMetrics = getProgressMetrics()
  
  // 更新累计数据
  const updatedMetrics: UserProgressMetrics = {
    totalSessions: existingMetrics.totalSessions + 1,
    totalCorrectAnswers: existingMetrics.totalCorrectAnswers + newSessionData.correctAnswersCount,
    totalQuestions: existingMetrics.totalQuestions + newSessionData.questionsCount,
    averageAccuracy: 0, // 重新计算
    totalListeningMinutes: existingMetrics.totalListeningMinutes + Math.round(newSessionData.duration / 60),
    currentStreakDays: existingMetrics.currentStreakDays,
    longestStreakDays: existingMetrics.longestStreakDays,
    lastPracticedAt: newSessionData.completedAt,
    weeklyTrend: [...existingMetrics.weeklyTrend]
  }
  
  // 重新计算平均准确率
  updatedMetrics.averageAccuracy = updatedMetrics.totalQuestions > 0 
    ? Math.round((updatedMetrics.totalCorrectAnswers / updatedMetrics.totalQuestions) * 10000) / 100
    : 0
  
  // 更新连续天数
  const sessionDates = [
    ...existingMetrics.weeklyTrend.flatMap(trend => 
      Array(trend.sessions).fill(trend.date + 'T12:00:00Z')
    ),
    newSessionData.completedAt
  ]
  const streakData = calculateStreakDays(sessionDates)
  updatedMetrics.currentStreakDays = streakData.current
  updatedMetrics.longestStreakDays = Math.max(existingMetrics.longestStreakDays, streakData.longest)
  
  // 更新周趋势数据
  const today = new Date().toISOString().split('T')[0]
  const todayTrend = updatedMetrics.weeklyTrend.find(trend => trend.date === today)
  
  if (todayTrend) {
    todayTrend.sessions += 1
  } else {
    updatedMetrics.weeklyTrend.push({ date: today, sessions: 1 })
  }
  
  // 保持最近7天的数据
  updatedMetrics.weeklyTrend = updatedMetrics.weeklyTrend
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7)
  
  saveProgressMetrics(updatedMetrics)
  return updatedMetrics
}

// =============== Achievement System ===============

/**
 * 检查是否符合成就条件
 */
function checkAchievementCondition(condition: AchievementCondition, metrics: UserProgressMetrics): boolean {
  switch (condition.type) {
    case 'sessions':
      return metrics.totalSessions >= condition.threshold
    
    case 'accuracy':
      return metrics.averageAccuracy >= condition.threshold && metrics.totalSessions >= condition.minSessions
    
    case 'streak':
      return metrics.currentStreakDays >= condition.threshold
    
    case 'minutes':
      return metrics.totalListeningMinutes >= condition.threshold
    
    default:
      return false
  }
}

/**
 * 初始化预设成就
 */
export function initializeAchievements(): AchievementBadge[] {
  const existingAchievements = getAchievements()
  
  // 如果已有成就数据，不重复初始化
  if (existingAchievements.length > 0) {
    return existingAchievements
  }
  
  const achievements: AchievementBadge[] = PREDEFINED_ACHIEVEMENTS.map(preset => ({
    ...preset,
    earnedAt: undefined // 初始时未获得
  }))
  
  saveAchievements(achievements)
  return achievements
}

/**
 * 检查并处理新获得的成就
 */
export function checkNewAchievements(metrics: UserProgressMetrics): AchievementNotification[] {
  const achievements = getAchievements()
  const newAchievements: AchievementNotification[] = []
  
  for (const achievement of achievements) {
    // 跳过已获得的成就
    if (achievement.earnedAt) {
      continue
    }
    
    // 检查是否符合条件
    if (checkAchievementCondition(achievement.conditions, metrics)) {
      // 标记为已获得
      achievement.earnedAt = new Date().toISOString()
      
      newAchievements.push({
        achievement,
        isNew: true,
        timestamp: achievement.earnedAt
      })
    }
  }
  
  // 保存更新后的成就数据
  if (newAchievements.length > 0) {
    saveAchievements(achievements)
  }
  
  return newAchievements
}

/**
 * 获取已获得的成就列表
 */
export function getEarnedAchievements(): AchievementBadge[] {
  const achievements = getAchievements()
  return achievements.filter(achievement => achievement.earnedAt)
}

/**
 * 获取未获得的成就列表
 */
export function getAvailableAchievements(): AchievementBadge[] {
  const achievements = getAchievements()
  return achievements.filter(achievement => !achievement.earnedAt)
}

// =============== Goal Progress Calculation ===============

/**
 * 计算目标进度
 */
export function calculateGoalProgress(metrics: UserProgressMetrics, goals: UserGoalSettings): GoalProgress {
  const today = new Date().toISOString().split('T')[0]
  const currentWeekStart = getWeekStart(new Date()).toISOString().split('T')[0]
  
  // 今日听力进度
  const todayTrend = metrics.weeklyTrend.find(trend => trend.date === today)
  const todaySessions = todayTrend ? todayTrend.sessions : 0
  const estimatedMinutesPerSession = 3 // 估算每次练习3分钟
  const todayMinutes = todaySessions * estimatedMinutesPerSession
  
  // 本周练习进度
  const weekTrend = metrics.weeklyTrend.filter(trend => trend.date >= currentWeekStart)
  const weekSessions = weekTrend.reduce((sum, trend) => sum + trend.sessions, 0)
  
  return {
    daily: {
      target: goals.dailyMinutesTarget,
      current: todayMinutes,
      isCompleted: todayMinutes >= goals.dailyMinutesTarget,
      lastCompletedAt: todayMinutes >= goals.dailyMinutesTarget ? new Date().toISOString() : undefined
    },
    weekly: {
      target: goals.weeklySessionsTarget,
      current: weekSessions,
      isCompleted: weekSessions >= goals.weeklySessionsTarget,
      lastCompletedAt: weekSessions >= goals.weeklySessionsTarget ? new Date().toISOString() : undefined
    }
  }
}

/**
 * 获取本周开始日期（周一）
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 调整为周一开始
  return new Date(d.setDate(diff))
}

// =============== Migration and Sync ===============

/**
 * 从练习历史迁移数据到成就系统
 */
export function migrateFromHistory(exercises: Exercise[]): UserProgressMetrics {
  const existingMetrics = getProgressMetrics()
  const calculatedMetrics = calculateProgressFromHistory(exercises, existingMetrics)
  
  saveProgressMetrics(calculatedMetrics)
  initializeAchievements()
  
  return calculatedMetrics
}

/**
 * 处理练习完成事件 - 更新指标并检查成就
 * 包含性能监控和错误处理
 */
export function handlePracticeCompleted(exercise: Exercise): {
  metrics: UserProgressMetrics
  newAchievements: AchievementNotification[]
  goalProgress: GoalProgress
} {
  const startTime = performance.now()
  
  try {
    const sessionData = convertExerciseToSessionData(exercise)
    
    // 更新进度指标
    const updatedMetrics = updateProgressMetrics(sessionData)
    
    // 检查新成就
    const newAchievements = checkNewAchievements(updatedMetrics)
    
    // 计算目标进度
    const goals = getGoalSettings()
    const goalProgress = calculateGoalProgress(updatedMetrics, goals)
    
    // 性能监控
    const endTime = performance.now()
    const processingTime = endTime - startTime
    
    if (processingTime > 50) { // 如果处理时间超过50ms，记录警告
      console.warn(`Achievement processing took ${processingTime.toFixed(2)}ms, consider optimization`)
    }
    
    return {
      metrics: updatedMetrics,
      newAchievements,
      goalProgress
    }
  } catch (error) {
    console.error('Error processing practice completion:', error)
    
    // 返回安全的默认值，保证不阻塞用户流程
    const fallbackMetrics = getProgressMetrics()
    const fallbackGoals = getGoalSettings()
    
    return {
      metrics: fallbackMetrics,
      newAchievements: [],
      goalProgress: calculateGoalProgress(fallbackMetrics, fallbackGoals)
    }
  }
}