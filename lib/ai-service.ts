// Client-side AI Service
// 通过调用 Next.js API 路由，避免在浏览器暴露 ARK_API_KEY

import type { Question, GradingResult, ListeningLanguage, DifficultyLevel } from './types'

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

export async function generateTopics(difficulty: DifficultyLevel, wordCount: number, language: ListeningLanguage = 'en-US', difficultyLevel?: DifficultyLevel): Promise<string[]> {
  const data = await postJson<{ success: boolean; topics: string[] }>(
    "/api/ai/topics",
    { difficulty, wordCount, language, difficultyLevel },
  )
  return data.topics
}

// 生成听力稿
export async function generateTranscript(
  difficulty: DifficultyLevel,
  wordCount: number,
  topic: string,
  language: ListeningLanguage = 'en-US',
  difficultyLevel?: number,
): Promise<string> {
  const data = await postJson<{ success: boolean; transcript: string }>(
    "/api/ai/transcript",
    { difficulty, wordCount, topic, language, difficultyLevel },
  )
  return data.transcript
}

export async function generateQuestions(
  difficulty: DifficultyLevel,
  transcript: string,
  language: ListeningLanguage = 'en-US',
  duration: number,
  difficultyLevel?: number,
): Promise<Question[]> {
  const data = await postJson<{ success: boolean; questions: Question[] }>(
    "/api/ai/questions",
    { difficulty, transcript, language, duration, difficultyLevel },
  )
  return data.questions
}

// 批改答案
export async function gradeAnswers(
  transcript: string,
  questions: Question[],
  answers: Record<number, string>,
  language: ListeningLanguage = 'en-US',
): Promise<GradingResult[]> {
  const data = await postJson<{ success: boolean; results: GradingResult[] }>(
    "/api/ai/grade",
    { transcript, questions, answers, language },
  )
  return data.results
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
