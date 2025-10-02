import type { FocusArea, FocusCoverage, Question } from './types'
import { FOCUS_AREA_LIST } from './types'

/**
 * 验证和清理 focusAreas 参数
 * @param focusAreas 输入的 focus areas 数组
 * @returns 验证后的 focus areas 数组，限制在1-5个
 */
export function validateFocusAreas(focusAreas: unknown): FocusArea[] {
  if (!Array.isArray(focusAreas)) {
    return []
  }
  
  const validAreas = focusAreas
    .filter((area): area is FocusArea => 
      typeof area === 'string' && FOCUS_AREA_LIST.includes(area as FocusArea)
    )
    .slice(0, 5) // 限制最多5个标签
  
  return validAreas
}

/**
 * 计算标签覆盖率
 * @param requested 请求的标签
 * @param provided AI实际提供的标签
 * @returns 覆盖率信息
 */
export function calculateFocusCoverage(
  requested: FocusArea[], 
  provided: FocusArea[]
): FocusCoverage {
  if (requested.length === 0) {
    return {
      requested: [],
      provided: [],
      coverage: 1, // 没有要求时认为完全覆盖
      unmatchedTags: []
    }
  }
  
  const providedSet = new Set(provided)
  const matchedTags = requested.filter(tag => providedSet.has(tag))
  const unmatchedTags = requested.filter(tag => !providedSet.has(tag))
  
  const coverage = matchedTags.length / requested.length
  
  return {
    requested,
    provided,
    coverage,
    unmatchedTags
  }
}

/**
 * 生成专项练习的 AI 提示词片段
 * @param focusAreas 选择的能力标签
 * @param language 语言
 * @returns 提示词片段
 */
export function generateFocusAreasPrompt(focusAreas: FocusArea[], _language: string): string {
  if (focusAreas.length === 0) {
    return ''
  }
  
  const focusAreaDescriptions = {
    'main-idea': 'main idea comprehension (understanding central themes and key points)',
    'detail-comprehension': 'detail comprehension (identifying specific facts and explicit information)',
    'inference': 'inference skills (drawing logical conclusions from implicit information)',
    'vocabulary': 'vocabulary understanding (word meanings and context-specific usage)',
    'cause-effect': 'cause-effect relationships (identifying causal connections)',
    'sequence': 'sequence understanding (chronological order and event progression)',
    'speaker-attitude': 'speaker attitude recognition (tone, opinion, emotional stance)',
    'comparison': 'comparison analysis (similarities, differences, comparative relationships)',
    'number-information': 'number information processing (numerical data and quantities)',
    'time-reference': 'time reference understanding (temporal information and dates)'
  }
  
  const descriptions = focusAreas
    .map(area => focusAreaDescriptions[area] || area)
    .join(', ')
  
  return `
SPECIALIZED PRACTICE MODE - Focus Areas: ${descriptions}

Important: This content should specifically target and test the selected focus areas. Ensure that the generated content provides opportunities to practice these specific listening skills.`
}

/**
 * 从生成的内容中提取实际覆盖的标签
 * @param content 生成的内容（题目、转录等）
 * @param requestedAreas 请求的标签
 * @returns 实际覆盖的标签数组
 */
export function extractProvidedFocusAreas(
  content: unknown, 
  requestedAreas: FocusArea[]
): FocusArea[] {
  // 如果内容包含 focus_areas 字段（如题目），直接使用
  const contentWithFocusAreas = content as {focus_areas?: unknown}
  if (Array.isArray(contentWithFocusAreas.focus_areas)) {
    return (contentWithFocusAreas.focus_areas as string[]).filter((area: string) => 
      FOCUS_AREA_LIST.includes(area as FocusArea)
    )
  }
  
  // 如果是题目数组，合并所有题目的 focus_areas
  if (Array.isArray(content)) {
    const allAreas = content
      .flatMap(item => (item as {focus_areas?: string[]}).focus_areas || [])
      .filter((area: string) => FOCUS_AREA_LIST.includes(area as FocusArea))
    
    return Array.from(new Set(allAreas))
  }
  
  // 如果是题目数组，合并所有题目的 focus_areas
  if (Array.isArray(content)) {
    const allAreas = content
      .flatMap(item => item.focus_areas || [])
      .filter((area: string) => FOCUS_AREA_LIST.includes(area as FocusArea))
    
    return Array.from(new Set(allAreas))
  }
  
  // 对于其他内容类型（如转录、主题），假设覆盖了所有请求的标签
  // 这是一个简化的实现，实际可能需要更复杂的分析
  return requestedAreas
}

/**
 * 检查是否需要重试生成
 * @param coverage 覆盖率信息
 * @param minCoverage 最小覆盖率要求
 * @returns 是否需要重试
 */
export function shouldRetryGeneration(
  coverage: FocusCoverage, 
  minCoverage: number = 0.8
): boolean {
  return coverage.coverage < minCoverage && coverage.requested.length > 0
}

/**
 * 分析标签匹配质量并生成降级原因
 * @param coverage 覆盖率信息
 * @param attempt 当前尝试次数
 * @returns 降级分析结果
 */
export function analyzeCoverageQuality(
  coverage: FocusCoverage, 
  attempt: number
): {
  quality: 'excellent' | 'good' | 'partial' | 'poor'
  degradationReason?: string
  shouldContinue: boolean
} {
  if (coverage.requested.length === 0) {
    return { quality: 'excellent', shouldContinue: false }
  }
  
  const { coverage: rate, unmatchedTags } = coverage
  
  if (rate >= 0.9) {
    return { quality: 'excellent', shouldContinue: false }
  } else if (rate >= 0.7) {
    return { 
      quality: 'good', 
      shouldContinue: false,
      degradationReason: `部分标签未完全匹配: ${unmatchedTags.join(', ')}`
    }
  } else if (rate >= 0.4) {
    return { 
      quality: 'partial', 
      shouldContinue: attempt < 2,
      degradationReason: `AI对所选标签支持有限，覆盖率: ${Math.round(rate * 100)}%`
    }
  } else {
    return { 
      quality: 'poor', 
      shouldContinue: attempt < 2,
      degradationReason: rate === 0 
        ? 'AI暂不支持所选标签，将提供普通练习' 
        : `标签匹配度较低，覆盖率: ${Math.round(rate * 100)}%`
    }
  }
}

/**
 * 生成重试时的改进提示词
 * @param originalPrompt 原始提示词
 * @param coverage 上次的覆盖率信息
 * @param attempt 当前尝试次数
 * @returns 改进后的提示词
 */
export function generateRetryPrompt(
  originalPrompt: string, 
  coverage: FocusCoverage, 
  attempt: number
): string {
  if (coverage.unmatchedTags.length === 0) {
    return originalPrompt
  }
  
  const retryInstructions = `
RETRY ATTEMPT ${attempt}: The previous generation did not adequately cover these focus areas: ${coverage.unmatchedTags.join(', ')}.

CRITICAL REQUIREMENTS FOR THIS RETRY:
- MUST include content that specifically targets: ${coverage.unmatchedTags.join(', ')}
- Ensure these focus areas are prominently featured and testable
- Prioritize these areas over other considerations

`
  
  return retryInstructions + originalPrompt
}

/**
 * 记录降级事件用于分析和改进
 * @param event 降级事件信息
 */
export function logDegradationEvent(event: {
  type: 'topics' | 'transcript' | 'questions' | 'grade'
  requestedAreas: FocusArea[]
  finalCoverage: number
  attempts: number
  reason: string
  timestamp?: string
}): void {
  // 在生产环境中，这里可以发送到分析服务
  console.log('Focus Area Degradation Event:', {
    ...event,
    timestamp: event.timestamp || new Date().toISOString()
  })
  
  // 可以在这里添加更多的日志记录逻辑
  // 例如发送到监控服务、保存到数据库等
}

/**
 * 验证题目的标签匹配质量
 * @param questions 生成的题目
 * @param requestedAreas 请求的标签
 * @returns 匹配质量分析
 */
export function validateQuestionTagging(
  questions: Question[], 
  requestedAreas: FocusArea[]
): {
  overallCoverage: number
  questionCoverage: Array<{
    index: number
    matchedTags: FocusArea[]
    confidence: 'high' | 'medium' | 'low'
    issues?: string[]
  }>
  recommendations: string[]
} {
  if (requestedAreas.length === 0) {
    return {
      overallCoverage: 1,
      questionCoverage: [],
      recommendations: []
    }
  }
  
  const questionCoverage = questions.map((question, index) => {
    const questionAreas = (question.focus_areas || []) as FocusArea[]
    const matchedTags = questionAreas.filter(area => requestedAreas.includes(area))
    
    let confidence: 'high' | 'medium' | 'low' = 'low'
    const issues: string[] = []
    
    if (matchedTags.length >= 2) {
      confidence = 'high'
    } else if (matchedTags.length === 1) {
      confidence = 'medium'
    } else {
      issues.push('未匹配任何请求的标签')
    }
    
    // 检查标签的合理性
    if (questionAreas.length === 0) {
      issues.push('缺少标签标注')
    } else if (questionAreas.length > 4) {
      issues.push('标签过多，可能不够精确')
    }
    
    return {
      index,
      matchedTags,
      confidence,
      issues: issues.length > 0 ? issues : undefined
    }
  })
  
  // 计算整体覆盖率
  const coveredAreas = new Set<FocusArea>()
  questionCoverage.forEach(qc => {
    qc.matchedTags.forEach(tag => coveredAreas.add(tag))
  })
  
  const overallCoverage = coveredAreas.size / requestedAreas.length
  
  // 生成改进建议
  const recommendations: string[] = []
  const uncoveredAreas = requestedAreas.filter(area => !coveredAreas.has(area))
  
  if (uncoveredAreas.length > 0) {
    recommendations.push(`建议增加针对以下标签的题目: ${uncoveredAreas.join(', ')}`)
  }
  
  const lowConfidenceCount = questionCoverage.filter(qc => qc.confidence === 'low').length
  if (lowConfidenceCount > questions.length * 0.3) {
    recommendations.push('建议提高题目与所选标签的匹配度')
  }
  
  return {
    overallCoverage,
    questionCoverage,
    recommendations
  }
}