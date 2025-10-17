// 文本扩写工具函数
import { buildExpansionPrompt } from './ai/prompt-templates'

/**
 * 精确统计英文单词数量
 * @param text 要统计的文本
 * @returns 单词数量
 */
export function countWords(text: string): number {
  if (!text || text.trim() === '') return 0
  
  // 移除多余的标点符号，分割单词
  const words = text
    .trim()
    .replace(/[^\w\s'-]/g, ' ') // 替换非单词字符为空格
    .split(/\s+/)
    .filter(word => word.length > 0 && !/^[ '-]+$/.test(word)) // 过滤空字符串和纯标点
  
  return words.length
}

/**
 * 检查文本是否达到最小长度要求
 * @param text 要检查的文本
 * @param targetWordCount 目标单词数
 * @param minPercentage 最小百分比（默认0.9表示90%）
 * @returns 是否达到要求
 */
export function meetsLengthRequirement(text: string, targetWordCount: number, minPercentage: number = 0.9): boolean {
  const actualWordCount = countWords(text)
  const requiredWordCount = Math.floor(targetWordCount * minPercentage)
  return actualWordCount >= requiredWordCount
}

/**
 * 计算需要的扩写单词数
 * @param currentText 当前文本
 * @param targetWordCount 目标单词数
 * @param expansionPercentage 扩写百分比（默认1.1表示110%）
 * @returns 需要的单词数
 */
export function calculateExpansionTarget(currentText: string, targetWordCount: number, expansionPercentage: number = 1.1): number {
  const currentWordCount = countWords(currentText)
  const targetWithBuffer = Math.ceil(targetWordCount * expansionPercentage)
  
  // 如果当前已经超过目标，返回当前数量
  if (currentWordCount >= targetWithBuffer) {
    return currentWordCount
  }
  
  return targetWithBuffer
}

/**
 * 生成扩写提示词
 * @param originalText 原始文本
 * @param currentWordCount 当前单词数
 * @param targetWordCount 目标单词数
 * @param topic 主题
 * @param difficulty 难度
 * @param minAcceptablePercentage 最小可接受百分比
 * @returns 扩写提示词
 */
export function generateExpansionPrompt(
  originalText: string,
  currentWordCount: number,
  targetWordCount: number,
  topic: string,
  difficulty: string,
  minAcceptablePercentage: number = 0.9,
  language: string = 'en-US'
): string {
  // 语言映射
  const languageNames: Record<string, string> = {
    'en-US': 'American English',
    'en-GB': 'British English',
    'es': 'Spanish',
    'fr': 'French',
    'ja': 'Japanese',
    'it': 'Italian',
    'pt-BR': 'Portuguese',
    'hi': 'Hindi'
  }
  
  const languageName = languageNames[language] || 'English'

  return buildExpansionPrompt({
    originalText,
    currentWordCount,
    targetWordCount,
    topic,
    difficulty,
    minAcceptablePercentage,
    languageName
  })
}
