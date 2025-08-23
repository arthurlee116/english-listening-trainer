// 评估工具函数
import { ASSESSMENT_AUDIOS, calculateDifficultyLevel, getDifficultyRange } from './difficulty-service'

/**
 * 验证评估分数的有效性
 * @param scores 分数数组
 * @returns 验证结果
 */
export function validateAssessmentScores(scores: number[]): { valid: boolean; error?: string } {
  if (!Array.isArray(scores)) {
    return { valid: false, error: '分数必须是数组格式' }
  }

  if (scores.length !== 5) {
    return { valid: false, error: '必须提供5个音频的评分' }
  }

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i]
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      return { valid: false, error: `第${i + 1}个评分无效，必须是1-10之间的整数` }
    }
  }

  return { valid: true }
}

/**
 * 生成评估结果摘要
 * @param scores 用户评分
 * @param difficultyLevel 计算出的难度等级
 * @returns 评估结果摘要
 */
export function generateAssessmentSummary(scores: number[], difficultyLevel: number): {
  summary: string
  details: Array<{
    audioId: number
    topic: string
    userScore: number
    difficulty: number
    performance: string
  }>
  recommendation: string
} {
  const range = getDifficultyRange(difficultyLevel)
  
  const details = scores.map((score, index) => {
    const audio = ASSESSMENT_AUDIOS[index]
    let performance = ''
    
    // 根据分数和音频难度判断表现
    const performanceRatio = score / 10
    if (performanceRatio >= 0.8) {
      performance = '优秀'
    } else if (performanceRatio >= 0.6) {
      performance = '良好'
    } else if (performanceRatio >= 0.4) {
      performance = '一般'
    } else {
      performance = '需改进'
    }
    
    return {
      audioId: audio.id,
      topic: audio.topic,
      userScore: score,
      difficulty: audio.difficulty,
      performance
    }
  })

  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

  let summary = `您的英语听力水平评估为 ${difficultyLevel} 级（${range.name}）。`
  
  if (averageScore >= 8) {
    summary += '您在各个难度级别的听力材料中都表现出色，听力理解能力较强。'
  } else if (averageScore >= 6) {
    summary += '您的听力理解能力良好，在大部分材料中能够准确理解内容。'
  } else if (averageScore >= 4) {
    summary += '您的听力理解能力有一定基础，但在较难的材料中还需要提升。'
  } else {
    summary += '您的听力理解能力还需要进一步提升，建议从基础材料开始练习。'
  }

  let recommendation = `建议您在练习中选择难度为 ${Math.max(1, difficultyLevel - 2)} - ${Math.min(30, difficultyLevel + 2)} 级的材料，`
  
  if (difficultyLevel <= 10) {
    recommendation += '重点关注基础词汇和简单句型的理解。'
  } else if (difficultyLevel <= 20) {
    recommendation += '注重提高对复杂句型和专业词汇的理解能力。'
  } else {
    recommendation += '可以挑战学术性和专业性较强的听力材料。'
  }

  return {
    summary,
    details,
    recommendation
  }
}

/**
 * 检查是否需要重新评估
 * @param lastAssessmentDate 上次评估日期
 * @param daysSinceLastAssessment 距离上次评估的天数阈值
 * @returns 是否需要重新评估
 */
export function shouldReassess(lastAssessmentDate: string, daysSinceLastAssessment: number = 30): boolean {
  const lastDate = new Date(lastAssessmentDate)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - lastDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays >= daysSinceLastAssessment
}

/**
 * 生成评估报告数据（用于管理员查看）
 * @param assessmentHistory 评估历史数据
 * @returns 格式化的报告数据
 */
export function generateAssessmentReport(assessmentHistory: Array<{
  id: number
  invitation_code: string
  test_date: string
  scores: number[]
  final_difficulty: number
}>): {
  totalTests: number
  averageDifficulty: number
  difficultyDistribution: Record<string, number>
  recentTrends: Array<{
    date: string
    count: number
    averageDifficulty: number
  }>
} {
  const totalTests = assessmentHistory.length
  
  if (totalTests === 0) {
    return {
      totalTests: 0,
      averageDifficulty: 0,
      difficultyDistribution: {},
      recentTrends: []
    }
  }

  // 计算平均难度
  const averageDifficulty = assessmentHistory.reduce(
    (sum, record) => sum + record.final_difficulty, 0
  ) / totalTests

  // 计算难度分布
  const difficultyDistribution: Record<string, number> = {}
  assessmentHistory.forEach(record => {
    const range = getDifficultyRange(record.final_difficulty)
    const key = `${range.min}-${range.max} (${range.name})`
    difficultyDistribution[key] = (difficultyDistribution[key] || 0) + 1
  })

  // 计算最近7天的趋势
  const recentTrends: Array<{
    date: string
    count: number
    averageDifficulty: number
  }> = []

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  }).reverse()

  last7Days.forEach(dateStr => {
    const dayRecords = assessmentHistory.filter(record => 
      record.test_date.startsWith(dateStr)
    )
    
    const count = dayRecords.length
    const averageDifficulty = count > 0 
      ? dayRecords.reduce((sum, record) => sum + record.final_difficulty, 0) / count 
      : 0

    recentTrends.push({
      date: dateStr,
      count,
      averageDifficulty: Math.round(averageDifficulty * 10) / 10
    })
  })

  return {
    totalTests,
    averageDifficulty: Math.round(averageDifficulty * 10) / 10,
    difficultyDistribution,
    recentTrends
  }
}

/**
 * 格式化评估历史记录用于显示
 * @param records 历史记录
 * @returns 格式化的记录
 */
export function formatAssessmentHistory(records: Array<{
  id: number
  invitation_code: string
  test_date: string
  scores: number[]
  final_difficulty: number
}>): Array<{
  id: number
  invitationCode: string
  testDate: string
  scores: number[]
  finalDifficulty: number
  difficultyRange: string
  averageScore: number
}> {
  return records.map(record => {
    const range = getDifficultyRange(record.final_difficulty)
    const averageScore = record.scores.reduce((sum, score) => sum + score, 0) / record.scores.length

    return {
      id: record.id,
      invitationCode: record.invitation_code,
      testDate: new Date(record.test_date).toLocaleString('zh-CN'),
      scores: record.scores,
      finalDifficulty: record.final_difficulty,
      difficultyRange: `${range.name} (${record.final_difficulty}/30)`,
      averageScore: Math.round(averageScore * 10) / 10
    }
  })
}