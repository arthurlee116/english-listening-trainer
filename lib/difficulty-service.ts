// 难度服务 - 处理用户难度等级映射和计算
import type { ListeningLanguage } from './types'

// 难度等级范围定义
export interface DifficultyRange {
  min: number
  max: number
  name: string
  nameEn: string
  description: string
}

export const DIFFICULTY_RANGES: DifficultyRange[] = [
  { min: 1, max: 5, name: '初学者', nameEn: 'Beginner', description: '非常慢语速，最基础词汇，简单句' },
  { min: 6, max: 10, name: '入门', nameEn: 'Elementary', description: '慢语速，日常词汇，基础句式' },
  { min: 11, max: 15, name: '初级', nameEn: 'Pre-Intermediate', description: '正常语速，常用词汇，一般句式' },
  { min: 16, max: 20, name: '中级', nameEn: 'Intermediate', description: '略快语速，丰富词汇，复合句' },
  { min: 21, max: 25, name: '中高级', nameEn: 'Upper-Intermediate', description: '快语速，专业词汇，复杂句式' },
  { min: 26, max: 30, name: '高级', nameEn: 'Advanced', description: '很快语速，学术词汇，长难句' },
]

// 测试音频定义
export interface AssessmentAudio {
  id: number
  filename: string
  difficulty: number
  weight: number
  topic: string
  description: string
  transcript: string
}

export const ASSESSMENT_AUDIOS: AssessmentAudio[] = [
  {
    id: 1,
    filename: 'test-1-level6.wav',
    difficulty: 6,
    weight: 0.1,
    topic: 'Simple Shopping Conversation',
    description: '超级简单购物对话，0.8倍慢语速，最基础词汇，短句',
    transcript: `A: Hello! How much are the apples?
B: They are two dollars per bag. Very fresh.
A: Good. I want one bag please.
B: Sure. Anything else today?
A: No, thank you. Here is the money.
B: Thank you! Have a nice day!`
  },
  {
    id: 2,
    filename: 'test-2-level12.wav',
    difficulty: 12,
    weight: 0.15,
    topic: 'University Life Discussion',
    description: '校园生活讨论，正常语速，教育词汇，复合句',
    transcript: `Student A: Hey, how was your first week at university?
Student B: Pretty good, but I'm struggling with the chemistry course. The professor speaks really fast and uses lots of technical terms I don't know yet.
Student A: I had the same problem last semester. Try recording the lectures on your phone and listening again later.
Student B: That's a great idea! I'll ask for permission first.`
  },
  {
    id: 3,
    filename: 'test-3-level18.wav',
    difficulty: 18,
    weight: 0.2,
    topic: 'Business Meeting Report',
    description: '商务会议报告，1.2倍略快语速，商务术语，复杂句型',
    transcript: `Manager: Good morning everyone. Today's quarterly review shows significant progress in our digital marketing campaigns, with a 35% increase in customer engagement compared to last quarter. However, we need to address the declining conversion rates in our e-commerce platform. I'd like Sarah to present her analysis of the current market trends and recommend actionable strategies for optimization.`
  },
  {
    id: 4,
    filename: 'test-4-level24.wav',
    difficulty: 24,
    weight: 0.25,
    topic: 'AI Technology News',
    description: '人工智能科技新闻，1.4倍快语速，科技术语，长难句',
    transcript: `News Anchor: Breaking developments in artificial intelligence research have emerged from MIT's Computer Science Laboratory. Scientists have successfully demonstrated neural network architectures capable of processing complex multidimensional datasets with unprecedented accuracy rates. The breakthrough involves sophisticated machine learning algorithms that utilize deep learning methodologies to achieve autonomous pattern recognition capabilities previously thought impossible.`
  },
  {
    id: 5,
    filename: 'test-5-level30.wav',
    difficulty: 30,
    weight: 0.3,
    topic: 'Quantum Physics Lecture',
    description: '量子物理学术讲座，1.5倍极快语速，量子力学专业术语，复杂学术句式',
    transcript: `Professor: Today's discourse examines quantum entanglement phenomena within the framework of Heisenberg's uncertainty principle. The wave function collapse mechanism demonstrates non-local correlations between particles exhibiting superposition states. These quantum mechanical properties fundamentally challenge classical deterministic paradigms, revealing probabilistic interpretations of reality through Schrödinger's equation applications in quantum field theory contexts.`
  }
]

/**
 * 根据用户难度等级计算加权平均分数
 * @param scores 5个测试音频的评分（1-10分）
 * @returns 计算得出的难度等级（1-30）
 */
export function calculateDifficultyLevel(scores: number[]): number {
  if (scores.length !== 5) {
    throw new Error('必须提供5个评分')
  }

  // 验证评分范围
  for (const score of scores) {
    if (score < 1 || score > 10) {
      throw new Error('评分必须在1-10之间')
    }
  }

  // 计算加权平均分
  let weightedSum = 0
  for (let i = 0; i < 5; i++) {
    const audio = ASSESSMENT_AUDIOS[i]
    // 将评分映射到对应音频的难度等级
    // 评分越高，说明用户理解越好，适应的难度越高
    const mappedScore = (scores[i] / 10) * audio.difficulty
    weightedSum += mappedScore * audio.weight
  }

  // 确保结果在1-30范围内
  const result = Math.round(Math.max(1, Math.min(30, weightedSum)))
  return result
}

/**
 * 根据难度等级获取对应的范围信息
 * @param level 难度等级（1-30）
 * @returns 难度范围信息
 */
export function getDifficultyRange(level: number): DifficultyRange {
  const range = DIFFICULTY_RANGES.find(r => level >= r.min && level <= r.max)
  if (!range) {
    throw new Error(`无效的难度等级: ${level}`)
  }
  return range
}

/**
 * 根据难度等级生成AI提示词的难度描述
 * @param level 难度等级（1-30）
 * @param language 语言
 * @returns 难度描述文本
 */
export function getDifficultyPromptModifier(level: number, language: ListeningLanguage = 'en-US'): string {
  const range = getDifficultyRange(level)
  
  const languageMap = {
    'en-US': 'American English',
    'en-GB': 'British English',
    'es': 'Spanish',
    'fr': 'French',
    'ja': 'Japanese',
    'it': 'Italian',
    'pt-BR': 'Portuguese',
    'hi': 'Hindi'
  }
  
  const languageName = languageMap[language] || 'English'
  
  // 根据难度等级生成具体的提示词修饰符
  let speedModifier = ''
  let vocabularyModifier = ''
  let syntaxModifier = ''
  
  if (level <= 5) {
    speedModifier = 'very slow speaking pace, clear pronunciation'
    vocabularyModifier = 'very basic vocabulary (high-frequency words only), simple everyday terms'
    syntaxModifier = 'simple sentences, basic present/past tense, avoid complex grammar'
  } else if (level <= 10) {
    speedModifier = 'slow speaking pace, clear articulation'
    vocabularyModifier = 'basic vocabulary, common everyday words'
    syntaxModifier = 'simple to moderate sentence structures, basic compound sentences'
  } else if (level <= 15) {
    speedModifier = 'normal speaking pace, natural rhythm'
    vocabularyModifier = 'common vocabulary, some less frequent but useful words'
    syntaxModifier = 'variety of sentence structures, some complex sentences'
  } else if (level <= 20) {
    speedModifier = 'slightly faster pace, natural conversational speed'
    vocabularyModifier = 'expanded vocabulary including some specialized terms'
    syntaxModifier = 'complex sentence structures, varied grammatical patterns'
  } else if (level <= 25) {
    speedModifier = 'fast speaking pace, quick natural rhythm'
    vocabularyModifier = 'advanced vocabulary, professional and specialized terms'
    syntaxModifier = 'sophisticated sentence structures, complex grammatical constructions'
  } else {
    speedModifier = 'very fast speaking pace, rapid native-like delivery'
    vocabularyModifier = 'academic and technical vocabulary, sophisticated expressions'
    syntaxModifier = 'complex nested sentences, advanced grammatical structures'
  }

  return `
Language: ${languageName}
Difficulty Level: ${level}/30 (${range.name})
Speaking Style: ${speedModifier}
Vocabulary: ${vocabularyModifier}
Sentence Structure: ${syntaxModifier}
Content should be appropriate for ${range.name} level learners.`
}

/**
 * 获取用于生成测试音频的内容和难度信息
 * @param audioId 音频ID (1-5)
 * @returns 音频信息
 */
export function getAssessmentAudioInfo(audioId: number): AssessmentAudio | null {
  return ASSESSMENT_AUDIOS.find(audio => audio.id === audioId) || null
}

/**
 * 根据难度等级推荐CEFR等级
 * @param level 难度等级（1-30）
 * @returns CEFR等级
 */
export function mapDifficultyToCEFR(level: number): string {
  if (level <= 5) return 'A1'
  if (level <= 10) return 'A2'
  if (level <= 15) return 'B1'
  if (level <= 20) return 'B2'
  if (level <= 25) return 'C1'
  return 'C2'
}

/**
 * 根据CEFR等级估算难度等级
 * @param cefr CEFR等级
 * @returns 难度等级范围
 */
export function mapCEFRToDifficulty(cefr: string): { min: number, max: number } {
  switch (cefr.toUpperCase()) {
    case 'A1': return { min: 1, max: 5 }
    case 'A2': return { min: 6, max: 10 }
    case 'B1': return { min: 11, max: 15 }
    case 'B2': return { min: 16, max: 20 }
    case 'C1': return { min: 21, max: 25 }
    case 'C2': return { min: 26, max: 30 }
    default: return { min: 11, max: 15 } // 默认B1
  }
}