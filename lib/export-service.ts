/**
 * Export Service for Wrong Answers AI Analysis
 * Generates formatted TXT files containing wrong answers and AI analysis
 */

import type { WrongAnswerItem, AIAnalysisResponse } from '@/lib/types'

export interface ExportOptions {
  includeTranscript?: boolean
  includeTimestamps?: boolean
  format?: 'detailed' | 'compact'
}

export class ExportService {
  /**
   * Export wrong answers with AI analysis to TXT format
   */
  static async exportToTXT(
    wrongAnswers: WrongAnswerItem[], 
    options: ExportOptions = {}
  ): Promise<string> {
    const {
      includeTranscript = true,
      includeTimestamps = true,
      format = 'detailed'
    } = options

    const _timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const exportDate = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    let content = ''

    // Header
    content += '='.repeat(80) + '\n'
    content += '                    错题AI分析导出报告\n'
    content += '='.repeat(80) + '\n'
    content += `导出时间: ${exportDate}\n`
    content += `题目总数: ${wrongAnswers.length}\n`
    content += `已分析题目: ${wrongAnswers.filter(item => item.answer.aiAnalysis).length}\n`
    content += `未分析题目: ${wrongAnswers.filter(item => !item.answer.aiAnalysis).length}\n`
    content += '='.repeat(80) + '\n\n'

    // Process each wrong answer
    wrongAnswers.forEach((item, index) => {
      content += this.formatWrongAnswerItem(item, index + 1, {
        includeTranscript,
        includeTimestamps,
        format
      })
      content += '\n' + '-'.repeat(80) + '\n\n'
    })

    // Footer
    content += '='.repeat(80) + '\n'
    content += '                        报告结束\n'
    content += '='.repeat(80) + '\n'

    return content
  }

  /**
   * Format a single wrong answer item
   */
  private static formatWrongAnswerItem(
    item: WrongAnswerItem, 
    index: number, 
    options: ExportOptions
  ): string {
    const { includeTranscript, includeTimestamps, format } = options
    let content = ''

    // Header
    content += `【题目 ${index}】\n`
    
    // Session metadata
    if (includeTimestamps) {
      const sessionDate = new Date(item.session.createdAt).toLocaleString('zh-CN')
      const attemptDate = new Date(item.answer.attemptedAt).toLocaleString('zh-CN')
      content += `练习时间: ${sessionDate}\n`
      content += `答题时间: ${attemptDate}\n`
    }
    
    content += `主题: ${item.session.topic}\n`
    content += `难度: ${item.session.difficulty}\n`
    content += `语言: ${this.getLanguageDisplayName(item.session.language)}\n`
    content += `题型: ${this.getQuestionTypeDisplayName(item.question.type)}\n`
    content += `题号: ${item.question.index + 1}\n\n`

    // Question content
    content += `【题目内容】\n`
    content += `${item.question.question}\n\n`

    // Options (for multiple choice)
    if (item.question.options && (item.question.type === 'multiple_choice' || item.question.type === 'single')) {
      content += `【选项】\n`
      item.question.options.forEach((option, idx) => {
        content += `${String.fromCharCode(65 + idx)}. ${option}\n`
      })
      content += '\n'
    }

    // Answers
    content += `【答案对比】\n`
    content += `您的答案: ${item.answer.userAnswer || '未作答'}\n`
    content += `正确答案: ${item.question.correctAnswer}\n\n`

    // Original explanation
    if (item.question.explanation) {
      content += `【题目解析】\n`
      content += `${item.question.explanation}\n\n`
    }

    // AI Analysis
    if (item.answer.aiAnalysis) {
      content += this.formatAIAnalysis(item.answer.aiAnalysis, format)
    } else {
      content += `【AI分析】\n`
      content += `分析状态: 未生成\n`
      content += `说明: 该题目尚未进行AI分析，请在应用中点击"生成分析"按钮获取详细解析。\n\n`
    }

    // Transcript
    if (includeTranscript && item.question.transcript) {
      content += `【听力材料】\n`
      content += `${item.question.transcript}\n\n`
    }

    return content
  }

  /**
   * Format AI analysis section
   */
  private static formatAIAnalysis(analysis: AIAnalysisResponse, _format?: string): string {
    let content = ''

    content += `【AI智能分析】\n`
    content += `可信度: ${this.getConfidenceDisplayName(analysis.confidence)}\n\n`

    // Main analysis
    content += `【详细分析】\n`
    content += `${analysis.analysis}\n\n`

    // Key reason
    content += `【主要错误原因】\n`
    content += `${analysis.key_reason}\n\n`

    // Ability tags
    if (analysis.ability_tags && analysis.ability_tags.length > 0) {
      content += `【能力标签】\n`
      analysis.ability_tags.forEach(tag => {
        content += `• ${tag}\n`
      })
      content += '\n'
    }

    // Signal words
    if (analysis.signal_words && analysis.signal_words.length > 0) {
      content += `【关键信号词】\n`
      analysis.signal_words.forEach(word => {
        content += `• ${word}\n`
      })
      content += '\n'
    }

    // Strategy
    if (analysis.strategy) {
      content += `【解题策略】\n`
      content += `${analysis.strategy}\n\n`
    }

    // Related sentences
    if (analysis.related_sentences && analysis.related_sentences.length > 0) {
      content += `【相关句子分析】\n`
      analysis.related_sentences.forEach((sentence, index) => {
        content += `${index + 1}. "${sentence.quote}"\n`
        content += `   解释: ${sentence.comment}\n\n`
      })
    }

    return content
  }

  /**
   * Generate downloadable filename with timestamp
   */
  static generateFilename(): string {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19) // YYYY-MM-DDTHH-MM-SS
    
    return `错题AI分析报告_${timestamp}.txt`
  }

  /**
   * Trigger file download in browser
   */
  static downloadFile(content: string, filename?: string): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    const finalFilename = filename || this.generateFilename()
    
    // Create blob with UTF-8 BOM for proper Chinese encoding
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + content], { 
      type: 'text/plain;charset=utf-8' 
    })
    
    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = finalFilename
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Get display name for language code
   */
  private static getLanguageDisplayName(language: string): string {
    const languageMap: Record<string, string> = {
      'en': '英语',
      'zh': '中文',
      'ja': '日语',
      'ko': '韩语',
      'fr': '法语',
      'es': '西班牙语',
      'de': '德语',
      'it': '意大利语',
      'pt': '葡萄牙语',
      'ru': '俄语'
    }
    return languageMap[language] || language
  }

  /**
   * Get display name for question type
   */
  private static getQuestionTypeDisplayName(type: string): string {
    const typeMap: Record<string, string> = {
      'multiple_choice': '选择题',
      'single': '选择题',
      'fill_blank': '填空题',
      'short_answer': '简答题',
      'short': '简答题'
    }
    return typeMap[type] || type
  }

  /**
   * Get display name for confidence level
   */
  private static getConfidenceDisplayName(confidence: string): string {
    const confidenceMap: Record<string, string> = {
      'high': '高',
      'medium': '中',
      'low': '低'
    }
    return confidenceMap[confidence] || confidence
  }

  /**
   * Get statistics summary for export
   */
  static getExportStatistics(wrongAnswers: WrongAnswerItem[]): {
    total: number
    analyzed: number
    unanalyzed: number
    byDifficulty: Record<string, number>
    byLanguage: Record<string, number>
    byType: Record<string, number>
  } {
    const stats = {
      total: wrongAnswers.length,
      analyzed: wrongAnswers.filter(item => item.answer.aiAnalysis).length,
      unanalyzed: wrongAnswers.filter(item => !item.answer.aiAnalysis).length,
      byDifficulty: {} as Record<string, number>,
      byLanguage: {} as Record<string, number>,
      byType: {} as Record<string, number>
    }

    wrongAnswers.forEach(item => {
      // Count by difficulty
      stats.byDifficulty[item.session.difficulty] = 
        (stats.byDifficulty[item.session.difficulty] || 0) + 1

      // Count by language
      stats.byLanguage[item.session.language] = 
        (stats.byLanguage[item.session.language] || 0) + 1

      // Count by type
      stats.byType[item.question.type] = 
        (stats.byType[item.question.type] || 0) + 1
    })

    return stats
  }
}
