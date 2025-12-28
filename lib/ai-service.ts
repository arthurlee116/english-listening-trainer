// Client-side AI Service
// 通过调用 Next.js API 路由，避免在浏览器暴露 ARK_API_KEY

import type { 
  Question, 
  GradingResult, 
  ListeningLanguage, 
  DifficultyLevel, 
  FocusArea,
  TopicGenerationResponse,
  TranscriptGenerationResponse,
  QuestionGenerationResponse,
  FocusCoverage
} from './types'

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    const message = data?.error || `请求失败: ${response.status}`
    throw new Error(message)
  }

  return data as T
}

export async function generateTopics(
  difficulty: DifficultyLevel, 
  wordCount: number, 
  language: ListeningLanguage = 'en-US', 
  difficultyLevel?: number,
  focusAreas?: FocusArea[],
  excludedTopics?: string[]
): Promise<TopicGenerationResponse> {
  const data = await postJson<TopicGenerationResponse>(
    "/api/ai/topics",
    { difficulty, wordCount, language, difficultyLevel, focusAreas, excludedTopics },
  )
  return data
}

// 生成听力稿
export async function generateTranscript(
  difficulty: DifficultyLevel,
  wordCount: number,
  topic: string,
  language: ListeningLanguage = 'en-US',
  difficultyLevel?: number,
  focusAreas?: FocusArea[],
  searchEnhanced?: boolean,
  searchMaxResults?: number,
): Promise<TranscriptGenerationResponse> {
  const data = await postJson<TranscriptGenerationResponse>(
    "/api/ai/transcript",
    { difficulty, wordCount, topic, language, difficultyLevel, focusAreas, searchEnhanced, searchMaxResults },
  )
  return data
}

export async function generateQuestions(
  difficulty: DifficultyLevel,
  transcript: string,
  language: ListeningLanguage = 'en-US',
  duration: number,
  difficultyLevel?: number,
  focusAreas?: FocusArea[]
): Promise<QuestionGenerationResponse> {
  const data = await postJson<QuestionGenerationResponse>(
    "/api/ai/questions",
    { difficulty, transcript, language, duration, difficultyLevel, focusAreas },
  )
  return data
}

// 批改答案
export async function gradeAnswers(
  transcript: string,
  questions: Question[],
  answers: Record<number, string>,
  language: ListeningLanguage = 'en-US',
  focusAreas?: FocusArea[]
): Promise<{
  results: GradingResult[]
  focusCoverage?: FocusCoverage
}> {
  const data = await postJson<{ 
    success: boolean; 
    results: GradingResult[]
    focusCoverage?: FocusCoverage
  }>(
    "/api/ai/grade",
    { transcript, questions, answers, language, focusAreas },
  )
  return {
    results: data.results,
    focusCoverage: data.focusCoverage
  }
}

// 扩写文本
export async function expandText(
  text: string,
  targetWordCount: number,
  topic: string,
  difficulty: DifficultyLevel,
  language: ListeningLanguage = 'en-US',
  maxAttempts?: number,
): Promise<{
  expandedText: string
  originalWordCount: number
  finalWordCount: number
  expansionAttempts: number
  meetsRequirement: boolean
  message: string
}> {
  const data = await postJson<{
    success: boolean
    expandedText: string
    originalWordCount: number
    finalWordCount: number
    expansionAttempts: number
    meetsRequirement: boolean
    message: string
  }>(
    "/api/ai/expand",
    { text, targetWordCount, topic, difficulty, language, maxAttempts },
  )
  
  return {
    expandedText: data.expandedText,
    originalWordCount: data.originalWordCount,
    finalWordCount: data.finalWordCount,
    expansionAttempts: data.expansionAttempts,
    meetsRequirement: data.meetsRequirement,
    message: data.message
  }
}
