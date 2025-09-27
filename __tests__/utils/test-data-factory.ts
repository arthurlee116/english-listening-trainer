/**
 * 测试数据工厂 - 基于设计文档的数据工厂模式实现
 * 
 * 提供可预测的测试数据生成，确保数据关系的完整性，支持多场景数据模板
 */

import type { 
  WrongAnswerItem, 
  AIAnalysisResponse, 
  Session, 
  Question, 
  Answer,
  QuestionType,
  DifficultyLevel,
  Language 
} from '@/lib/types'

/**
 * 基础数据类型定义
 */
export interface TestSessionConfig {
  topic?: string
  difficulty?: DifficultyLevel
  language?: Language
  createdAt?: string
  sessionId?: string
}

export interface TestQuestionConfig {
  index?: number
  type?: QuestionType
  question?: string
  options?: string[]
  correctAnswer?: string
  explanation?: string
  transcript?: string
  questionId?: string
}

export interface TestAnswerConfig {
  userAnswer?: string
  isCorrect?: boolean
  attemptedAt?: string
  needsAnalysis?: boolean
  aiAnalysis?: AIAnalysisResponse
  aiAnalysisGeneratedAt?: string
}

export interface TestAIAnalysisConfig {
  analysis?: string
  key_reason?: string
  ability_tags?: string[]
  signal_words?: string[]
  strategy?: string
  related_sentences?: Array<{ quote: string; comment: string }>
  confidence?: 'low' | 'medium' | 'high'
}

/**
 * Session数据工厂
 */
export class SessionFactory {
  private static sessionCounter = 1

  /**
   * 创建测试Session数据
   */
  static create(config: TestSessionConfig = {}): Session {
    const sessionId = config.sessionId || `session-${this.sessionCounter++}`
    
    return {
      topic: config.topic || 'Daily Conversation',
      difficulty: config.difficulty || 'A2',
      language: config.language || 'en',
      createdAt: config.createdAt || new Date().toISOString()
    }
  }

  /**
   * 创建多个Session数据
   */
  static createBatch(count: number, baseConfig: TestSessionConfig = {}): Session[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({
        ...baseConfig,
        sessionId: baseConfig.sessionId || `session-batch-${index + 1}`
      })
    )
  }

  /**
   * 创建不同难度的Session数据
   */
  static createDifficultyVariants(topic = 'Test Topic'): Session[] {
    const difficulties: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    return difficulties.map(difficulty => 
      this.create({ topic, difficulty })
    )
  }

  /**
   * 重置计数器
   */
  static resetCounter() {
    this.sessionCounter = 1
  }
}

/**
 * Question数据工厂
 */
export class QuestionFactory {
  private static questionCounter = 1

  /**
   * 创建测试Question数据
   */
  static create(config: TestQuestionConfig = {}): Question {
    const questionId = config.questionId || `question-${this.questionCounter++}`
    const type = config.type || 'multiple_choice'
    
    return {
      index: config.index || 0,
      type,
      question: config.question || this.getDefaultQuestion(type),
      options: config.options || this.getDefaultOptions(type),
      correctAnswer: config.correctAnswer || this.getDefaultCorrectAnswer(type),
      explanation: config.explanation || 'Default explanation for the correct answer',
      transcript: config.transcript || 'This is a default transcript for testing purposes.'
    }
  }

  /**
   * 创建不同类型的问题
   */
  static createByType(type: QuestionType, config: Omit<TestQuestionConfig, 'type'> = {}): Question {
    return this.create({ ...config, type })
  }

  /**
   * 创建多选题
   */
  static createMultipleChoice(config: TestQuestionConfig = {}): Question {
    return this.createByType('multiple_choice', {
      question: 'What did the speaker mention?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: 'The speaker clearly mentioned Option A in the conversation.',
      transcript: 'In today\'s conversation, we discussed Option A as the main topic.',
      ...config
    })
  }

  /**
   * 创建填空题
   */
  static createFillBlank(config: TestQuestionConfig = {}): Question {
    return this.createByType('fill_blank', {
      question: 'Fill in the blank: The weather is _____ today.',
      options: ['sunny', 'rainy', 'cloudy', 'windy'],
      correctAnswer: 'sunny',
      explanation: 'According to the transcript, the weather is sunny.',
      transcript: 'The weather is sunny today, perfect for outdoor activities.',
      ...config
    })
  }

  /**
   * 创建简答题
   */
  static createShortAnswer(config: TestQuestionConfig = {}): Question {
    return this.createByType('short_answer', {
      question: 'What is the main topic of the conversation?',
      options: [],
      correctAnswer: 'Daily routine',
      explanation: 'The conversation focuses on discussing daily routines.',
      transcript: 'Let me tell you about my daily routine and how I organize my day.',
      ...config
    })
  }

  private static getDefaultQuestion(type: QuestionType): string {
    const questions = {
      multiple_choice: 'Choose the correct answer:',
      fill_blank: 'Fill in the blank:',
      short_answer: 'Answer the following question:'
    }
    return questions[type] || 'Test question'
  }

  private static getDefaultOptions(type: QuestionType): string[] {
    if (type === 'short_answer') return []
    return ['Option 1', 'Option 2', 'Option 3', 'Option 4']
  }

  private static getDefaultCorrectAnswer(type: QuestionType): string {
    return type === 'short_answer' ? 'Default answer' : 'Option 1'
  }

  /**
   * 重置计数器
   */
  static resetCounter() {
    this.questionCounter = 1
  }
}

/**
 * AIAnalysis数据工厂
 */
export class AIAnalysisFactory {
  /**
   * 创建AI分析数据
   */
  static create(config: TestAIAnalysisConfig = {}): AIAnalysisResponse {
    return {
      analysis: config.analysis || 'This is a detailed analysis of the user\'s mistake. The error stems from misunderstanding the context.',
      key_reason: config.key_reason || 'Misunderstood the context',
      ability_tags: config.ability_tags || ['listening comprehension', 'vocabulary'],
      signal_words: config.signal_words || ['context', 'understanding'],
      strategy: config.strategy || 'Focus on key contextual clues and practice active listening',
      related_sentences: config.related_sentences || [
        { quote: 'Key sentence from transcript', comment: 'This sentence contains the critical information' }
      ],
      confidence: config.confidence || 'high'
    }
  }

  /**
   * 创建高置信度分析
   */
  static createHighConfidence(config: Omit<TestAIAnalysisConfig, 'confidence'> = {}): AIAnalysisResponse {
    return this.create({ ...config, confidence: 'high' })
  }

  /**
   * 创建低置信度分析
   */
  static createLowConfidence(config: Omit<TestAIAnalysisConfig, 'confidence'> = {}): AIAnalysisResponse {
    return this.create({ 
      ...config, 
      confidence: 'low',
      analysis: config.analysis || 'Limited analysis available due to unclear context.',
      key_reason: config.key_reason || 'Unclear reasoning'
    })
  }

  /**
   * 创建语法错误分析
   */
  static createGrammarAnalysis(): AIAnalysisResponse {
    return this.create({
      analysis: 'The mistake is related to grammar usage, specifically verb tense agreement.',
      key_reason: 'Incorrect verb tense',
      ability_tags: ['grammar', 'verb tenses'],
      signal_words: ['verb', 'tense', 'agreement'],
      strategy: 'Review verb tense rules and practice with similar sentence structures'
    })
  }

  /**
   * 创建词汇错误分析
   */
  static createVocabularyAnalysis(): AIAnalysisResponse {
    return this.create({
      analysis: 'The error involves choosing the wrong vocabulary item for the context.',
      key_reason: 'Inappropriate vocabulary choice',
      ability_tags: ['vocabulary', 'context comprehension'],
      signal_words: ['vocabulary', 'context', 'meaning'],
      strategy: 'Expand vocabulary through contextual reading and listening practice'
    })
  }
}

/**
 * Answer数据工厂
 */
export class AnswerFactory {
  /**
   * 创建Answer数据
   */
  static create(config: TestAnswerConfig = {}): Answer {
    return {
      userAnswer: config.userAnswer || 'User\'s incorrect answer',
      isCorrect: config.isCorrect || false,
      attemptedAt: config.attemptedAt || new Date().toISOString(),
      needsAnalysis: config.needsAnalysis ?? true,
      aiAnalysis: config.aiAnalysis,
      aiAnalysisGeneratedAt: config.aiAnalysisGeneratedAt
    }
  }

  /**
   * 创建正确答案
   */
  static createCorrect(config: Omit<TestAnswerConfig, 'isCorrect'> = {}): Answer {
    return this.create({
      ...config,
      isCorrect: true,
      userAnswer: config.userAnswer || 'Correct answer',
      needsAnalysis: false
    })
  }

  /**
   * 创建错误答案（需要分析）
   */
  static createIncorrectNeedsAnalysis(config: Omit<TestAnswerConfig, 'isCorrect' | 'needsAnalysis'> = {}): Answer {
    return this.create({
      ...config,
      isCorrect: false,
      needsAnalysis: true,
      userAnswer: config.userAnswer || 'Incorrect answer'
    })
  }

  /**
   * 创建错误答案（已有分析）
   */
  static createIncorrectWithAnalysis(
    analysisConfig: TestAIAnalysisConfig = {},
    answerConfig: Omit<TestAnswerConfig, 'isCorrect' | 'needsAnalysis' | 'aiAnalysis'> = {}
  ): Answer {
    const analysis = AIAnalysisFactory.create(analysisConfig)
    return this.create({
      ...answerConfig,
      isCorrect: false,
      needsAnalysis: false,
      aiAnalysis: analysis,
      aiAnalysisGeneratedAt: new Date().toISOString(),
      userAnswer: answerConfig.userAnswer || 'Incorrect answer with analysis'
    })
  }
}

/**
 * WrongAnswerItem数据工厂
 */
export class WrongAnswerItemFactory {
  private static answerCounter = 1

  /**
   * 创建完整的WrongAnswerItem
   */
  static create(config: {
    sessionConfig?: TestSessionConfig
    questionConfig?: TestQuestionConfig
    answerConfig?: TestAnswerConfig
    answerId?: string
  } = {}): WrongAnswerItem {
    const answerId = config.answerId || `answer-${this.answerCounter++}`
    const sessionId = config.sessionConfig?.sessionId || `session-${answerId}`
    const questionId = config.questionConfig?.questionId || `question-${answerId}`

    return {
      answerId,
      questionId,
      sessionId,
      session: SessionFactory.create({ ...config.sessionConfig, sessionId }),
      question: QuestionFactory.create({ ...config.questionConfig, questionId }),
      answer: AnswerFactory.create(config.answerConfig)
    }
  }

  /**
   * 创建需要AI分析的错题
   */
  static createNeedsAnalysis(config: {
    sessionConfig?: TestSessionConfig
    questionConfig?: TestQuestionConfig
  } = {}): WrongAnswerItem {
    return this.create({
      ...config,
      answerConfig: { needsAnalysis: true, isCorrect: false }
    })
  }

  /**
   * 创建已有AI分析的错题
   */
  static createWithAnalysis(config: {
    sessionConfig?: TestSessionConfig
    questionConfig?: TestQuestionConfig
    analysisConfig?: TestAIAnalysisConfig
  } = {}): WrongAnswerItem {
    const analysis = AIAnalysisFactory.create(config.analysisConfig)
    return this.create({
      ...config,
      answerConfig: {
        needsAnalysis: false,
        isCorrect: false,
        aiAnalysis: analysis,
        aiAnalysisGeneratedAt: new Date().toISOString()
      }
    })
  }

  /**
   * 创建批量错题数据
   */
  static createBatch(
    count: number,
    config: {
      sessionConfig?: TestSessionConfig
      questionConfig?: TestQuestionConfig
      answerConfig?: TestAnswerConfig
    } = {}
  ): WrongAnswerItem[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        ...config,
        answerId: `batch-answer-${index + 1}`
      })
    )
  }

  /**
   * 创建混合状态的错题数据（部分需要分析，部分已有分析）
   */
  static createMixedAnalysisStatus(totalCount: number, withAnalysisCount: number): WrongAnswerItem[] {
    const withAnalysis = Array.from({ length: withAnalysisCount }, (_, i) =>
      this.createWithAnalysis({ answerId: `analyzed-${i + 1}` })
    )
    
    const needsAnalysis = Array.from({ length: totalCount - withAnalysisCount }, (_, i) =>
      this.createNeedsAnalysis({ answerId: `needs-analysis-${i + 1}` })
    )

    return [...withAnalysis, ...needsAnalysis]
  }

  /**
   * 创建不同难度级别的错题
   */
  static createDifficultyVariants(baseTopic = 'Test Topic'): WrongAnswerItem[] {
    const difficulties: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    return difficulties.map((difficulty, index) =>
      this.create({
        sessionConfig: { topic: baseTopic, difficulty },
        answerId: `difficulty-${difficulty}-${index + 1}`
      })
    )
  }

  /**
   * 创建不同问题类型的错题
   */
  static createQuestionTypeVariants(): WrongAnswerItem[] {
    const types: QuestionType[] = ['multiple_choice', 'fill_blank', 'short_answer']
    return types.map((type, index) => {
      const questionConfig = type === 'multiple_choice' 
        ? QuestionFactory.createMultipleChoice()
        : type === 'fill_blank'
        ? QuestionFactory.createFillBlank()
        : QuestionFactory.createShortAnswer()

      return this.create({
        questionConfig,
        answerId: `type-${type}-${index + 1}`
      })
    })
  }

  /**
   * 重置计数器
   */
  static resetCounter() {
    this.answerCounter = 1
  }
}

/**
 * 测试场景模板库
 */
export class TestScenarioFactory {
  /**
   * 空状态场景
   */
  static createEmptyState(): WrongAnswerItem[] {
    return []
  }

  /**
   * 加载状态场景（用于模拟加载中）
   */
  static createLoadingScenario(): Promise<WrongAnswerItem[]> {
    return new Promise(resolve => {
      setTimeout(() => resolve([]), 100)
    })
  }

  /**
   * 错误状态场景
   */
  static createErrorScenario(errorMessage = 'Network error'): Promise<never> {
    return Promise.reject(new Error(errorMessage))
  }

  /**
   * 标准展示场景
   */
  static createStandardDisplayScenario(): WrongAnswerItem[] {
    return [
      WrongAnswerItemFactory.createWithAnalysis({
        sessionConfig: { topic: 'Daily Conversation', difficulty: 'A2' },
        questionConfig: QuestionFactory.createMultipleChoice()
      }),
      WrongAnswerItemFactory.createNeedsAnalysis({
        sessionConfig: { topic: 'Business English', difficulty: 'B1' },
        questionConfig: QuestionFactory.createFillBlank()
      }),
      WrongAnswerItemFactory.createWithAnalysis({
        sessionConfig: { topic: 'Academic Discussion', difficulty: 'C1' },
        questionConfig: QuestionFactory.createShortAnswer()
      })
    ]
  }

  /**
   * 批量分析场景
   */
  static createBatchAnalysisScenario(totalItems = 10, analyzedItems = 3): WrongAnswerItem[] {
    return WrongAnswerItemFactory.createMixedAnalysisStatus(totalItems, analyzedItems)
  }

  /**
   * 导出功能测试场景
   */
  static createExportScenario(): WrongAnswerItem[] {
    return [
      WrongAnswerItemFactory.createWithAnalysis({
        sessionConfig: { topic: 'Export Test 1', difficulty: 'A2' },
        analysisConfig: { confidence: 'high' }
      }),
      WrongAnswerItemFactory.createWithAnalysis({
        sessionConfig: { topic: 'Export Test 2', difficulty: 'B1' },
        analysisConfig: { confidence: 'medium' }
      })
    ]
  }

  /**
   * 重置所有工厂计数器
   */
  static resetAllCounters() {
    SessionFactory.resetCounter()
    QuestionFactory.resetCounter()
    WrongAnswerItemFactory.resetCounter()
  }
}

// 导出便捷创建函数
export const createTestWrongAnswerItem = WrongAnswerItemFactory.create
export const createTestSession = SessionFactory.create
export const createTestQuestion = QuestionFactory.create
export const createTestAIAnalysis = AIAnalysisFactory.create
export const createTestAnswer = AnswerFactory.create
export const createTestScenario = TestScenarioFactory