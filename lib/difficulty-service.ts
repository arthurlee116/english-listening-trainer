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
    topic: 'Shopping at a Local Market',
    description: '日常购物对话，慢语速，简单词汇，基础句式',
    transcript: `A: Good morning! How much are these apples?
B: They are three dollars per kilogram. Very fresh and sweet.
A: That sounds good. Can I have two kilograms please?
B: Of course. Anything else you need today?
A: Yes, I also need some bananas. How much are they?
B: The bananas are two dollars per kilogram. They are very ripe and perfect for eating.
A: Great! I'll take one kilogram of bananas too.
B: So that's two kilograms of apples and one kilogram of bananas. The total is eight dollars.
A: Here you go. Thank you very much!
B: Thank you for shopping with us. Have a wonderful day!`
  },
  {
    id: 2,
    filename: 'test-2-level12.wav',
    difficulty: 12,
    weight: 0.15,
    topic: 'Campus Life Discussion',
    description: '校园生活讨论，正常语速，日常词汇，一般复合句',
    transcript: `A: Hey Sarah, how are you finding your first semester at university?
B: It's been quite an adjustment, to be honest. The workload is much heavier than I expected.
A: I know what you mean. When I started, I struggled with time management too. Have you joined any clubs or societies yet?
B: I've been thinking about it. I'm interested in the debate society, but I'm worried it might take up too much time.
A: Actually, extracurricular activities can be really helpful. They're a great way to meet people and develop skills that complement your studies.
B: That's a good point. I've also been considering getting a part-time job to help with expenses.
A: That could work, but make sure you don't overcommit yourself. Your studies should remain the priority, especially in your first year.
B: You're right. I think I'll start with one activity and see how I manage before taking on more responsibilities.`
  },
  {
    id: 3,
    filename: 'test-3-level18.wav',
    difficulty: 18,
    weight: 0.2,
    topic: 'Job Interview Scenario',
    description: '工作面试场景，略快语速，职场词汇，复杂句式',
    transcript: `Interviewer: Good afternoon, thank you for coming in today. Could you start by telling me about your professional background and what attracted you to this position?
Candidate: Certainly. I have five years of experience in digital marketing, specializing in content strategy and social media management. I've successfully led campaigns that increased brand engagement by over 200% at my current company. What particularly appeals to me about this role is the opportunity to work with innovative technologies and contribute to a forward-thinking organization that values creativity and data-driven decision making.
Interviewer: That's impressive. Can you describe a challenging project you've managed and how you overcame the obstacles you encountered?
Candidate: Last year, we faced a significant challenge when a major product launch campaign wasn't performing as expected. The engagement rates were below our projections, and we had a tight deadline to turn things around. I analyzed the data thoroughly, identified that our target demographic was responding better to video content than static images, and quickly pivoted our strategy. We reallocated budget, collaborated with the creative team to produce compelling video content, and ultimately exceeded our original targets by 150%.
Interviewer: Excellent problem-solving skills. How do you stay current with the rapidly evolving digital marketing landscape?`
  },
  {
    id: 4,
    filename: 'test-4-level24.wav',
    difficulty: 24,
    weight: 0.25,
    topic: 'Technology News Report',
    description: '科技新闻播报，快语速，专业词汇，长难句',
    transcript: `Good evening. In today's technology segment, we're examining the unprecedented developments in artificial intelligence that are reshaping industries worldwide. According to recent research from leading tech institutions, machine learning algorithms are now demonstrating capabilities that were previously thought to be decades away from practical implementation.
The breakthrough centers around advanced neural network architectures that can process complex, multi-modal data streams simultaneously, enabling applications ranging from autonomous vehicle navigation to sophisticated medical diagnostics. Industry analysts suggest these innovations could potentially revolutionize sectors including healthcare, transportation, and financial services within the next five years.
However, this rapid advancement has also intensified discussions about ethical considerations and regulatory frameworks. Prominent researchers are calling for comprehensive guidelines to ensure responsible development and deployment of these technologies. The debate encompasses concerns about data privacy, algorithmic bias, and the societal implications of increasingly autonomous systems.
Major technology corporations have announced substantial investments in AI safety research, while government agencies are establishing specialized committees to address the regulatory challenges posed by these emerging technologies. The intersection of innovation and governance continues to evolve as stakeholders navigate the balance between technological progress and public safety.`
  },
  {
    id: 5,
    filename: 'test-5-level30.wav',
    difficulty: 30,
    weight: 0.3,
    topic: 'Academic Lecture Excerpt',
    description: '学术讲座片段，很快语速，学术词汇，复杂从句嵌套',
    transcript: `Today we're examining the epistemological implications of postmodern theoretical frameworks within the context of interdisciplinary research methodologies. The fundamental question we must address concerns the extent to which traditional empirical paradigms remain viable when confronted with increasingly complex, multi-dimensional phenomena that resist conventional analytical categorization.
Contemporary scholars argue that the intersection of phenomenological approaches with quantitative methodologies creates a synergistic framework that transcends the limitations inherent in singular methodological perspectives. This synthesis, however, necessitates a reconceptualization of validity constructs and requires researchers to develop sophisticated analytical competencies that accommodate both interpretive and empirical dimensions.
The implications extend beyond mere methodological considerations to encompass broader philosophical questions about the nature of knowledge construction itself. When we consider the hermeneutic circle and its relationship to data interpretation, we encounter fundamental tensions between objective measurement and subjective understanding that have profound implications for research validity and generalizability.
Furthermore, the emergence of computational methodologies and big data analytics introduces additional complexity to this already multifaceted landscape, challenging traditional notions of research design while simultaneously offering unprecedented opportunities for innovative inquiry that bridges quantitative precision with qualitative depth and contextual sensitivity.`
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