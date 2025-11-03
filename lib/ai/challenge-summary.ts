import { callArkAPI, type ArkMessage } from '../ark-helper'
import type { ChallengeProgressStats } from '../analytics/challenge-progress'
import type { PracticeSession } from '@prisma/client'

// 缓存挑战总结，避免重复生成
const summaryCache = new Map<string, { summary: string; generatedAt: Date }>()

export interface ChallengeSummaryContext {
  challengeId: string
  topic: string
  stats: ChallengeProgressStats
  sessions: PracticeSession[]
}

/**
 * 生成挑战总结文本
 * @param context 挑战上下文信息
 * @returns AI生成的总结文本
 */
export async function generateChallengeSummary(context: ChallengeSummaryContext): Promise<string> {
  const { challengeId } = context

  // 检查缓存
  const cached = summaryCache.get(challengeId)
  if (cached && (Date.now() - cached.generatedAt.getTime()) < 24 * 60 * 60 * 1000) { // 24小时缓存
    return cached.summary
  }

  // 构建提示词
  const prompt = buildChallengeSummaryPrompt(context)

  const messages: ArkMessage[] = [
    {
      role: 'system',
      content: 'You are an expert English listening comprehension coach. Provide detailed, encouraging summaries of user progress through listening challenges. Focus on improvement trends, strengths, and specific recommendations for continued growth.'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await callArkAPI<{ summary: string }>({
      messages,
      schemaName: 'challenge_summary',
      label: 'challenge_summary',
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'challenge_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'A comprehensive summary of the challenge progress including achievements, trends, strengths, and recommendations'
              }
            },
            required: ['summary'],
            additionalProperties: false
          }
        }
      },
      temperature: 0.7,
      maxTokens: 1000
    })

    const summary = response.summary

    // 缓存结果
    summaryCache.set(challengeId, {
      summary,
      generatedAt: new Date()
    })

    return summary
  } catch (error) {
    console.error('Failed to generate challenge summary:', error)
    // 返回一个基本的总结作为后备
    return generateFallbackSummary(context)
  }
}

/**
 * 构建挑战总结提示词
 */
function buildChallengeSummaryPrompt(context: ChallengeSummaryContext): string {
  const { topic, stats, sessions } = context

  const completionRate = `${stats.completedSessions}/${stats.targetSessions} sessions (${stats.completionPercentage.toFixed(1)}%)`
  const averageAccuracy = stats.averageAccuracy ? `${(stats.averageAccuracy * 100).toFixed(1)}%` : 'N/A'
  const trend = stats.accuracyTrend === 'improving' ? '上升' : stats.accuracyTrend === 'declining' ? '下降' : '稳定'

  // 难度分布
  const difficultyBreakdown = Object.entries(stats.difficultyDistribution)
    .map(([level, count]) => `${level}: ${count}`)
    .join(', ')

  // 最近会话表现
  const recentSessions = sessions.slice(-3).map((session, index) => {
    const accuracy = session.accuracy ? `${(session.accuracy * 100).toFixed(1)}%` : 'N/A'
    return `会话 ${sessions.length - 2 + index}: ${session.topic} (${session.difficulty}) - 准确率: ${accuracy}`
  }).join('\n')

  return `请为用户的英语听力挑战生成一个详细的总结报告。

挑战主题: ${topic}
完成情况: ${completionRate}
平均准确率: ${averageAccuracy}
准确率趋势: ${trend}
总练习时长: ${Math.round(stats.totalDuration / 60)} 分钟
难度分布: ${difficultyBreakdown}

最近3次练习表现:
${recentSessions}

请提供一个鼓励性的总结，包括:
1. 总体进步和成就
2. 准确率趋势分析
3. 强项和需要改进的领域
4. 针对性的练习建议
5. 下一阶段的目标建议

总结应该积极、具体且具有指导性。用中文回复。`
}

/**
 * 生成后备总结（当AI调用失败时使用）
 */
function generateFallbackSummary(context: ChallengeSummaryContext): string {
  const { topic, stats } = context

  const completionRate = stats.completionPercentage.toFixed(1)
  const averageAccuracy = stats.averageAccuracy ? (stats.averageAccuracy * 100).toFixed(1) : 'N/A'
  const trendText = stats.accuracyTrend === 'improving' ? '稳步提升' : stats.accuracyTrend === 'declining' ? '需要更多练习' : '保持稳定'

  return `🎉 恭喜完成"${topic}"挑战！

📊 挑战概览：
• 完成度：${completionRate}%
• 平均准确率：${averageAccuracy}%
• 准确率趋势：${trendText}
• 总练习时长：${Math.round(stats.totalDuration / 60)}分钟

💪 继续保持！建议继续练习类似难度的内容来巩固进步。`
}

/**
 * 清除指定挑战的缓存总结
 * @param challengeId 挑战ID
 */
export function clearChallengeSummaryCache(challengeId: string): void {
  summaryCache.delete(challengeId)
}

/**
 * 清除所有缓存的总结
 */
export function clearAllChallengeSummaryCache(): void {
  summaryCache.clear()
}
