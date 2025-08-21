// Client-side AI Service
// 通过调用 Next.js API 路由，避免在浏览器暴露 ARK_API_KEY

import type { Question, GradingResult } from './types'

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

// 生成听力话题
export async function generateTopics(difficulty: string, wordCount: number): Promise<string[]> {
  const data = await postJson<{ success: boolean; topics: string[] }>(
    "/api/ai/topics",
    { difficulty, wordCount },
  )
  return data.topics
}

// 生成听力稿
export async function generateTranscript(
  difficulty: string,
  wordCount: number,
  topic: string,
): Promise<string> {
  const data = await postJson<{ success: boolean; transcript: string }>(
    "/api/ai/transcript",
    { difficulty, wordCount, topic },
  )
  return data.transcript
}

// 生成问题
export async function generateQuestions(
  difficulty: string,
  transcript: string,
): Promise<Question[]> {
  const data = await postJson<{ success: boolean; questions: Question[] }>(
    "/api/ai/questions",
    { difficulty, transcript },
  )
  return data.questions
}

// 批改答案
export async function gradeAnswers(
  transcript: string,
  questions: Question[],
  answers: Record<number, string>,
): Promise<GradingResult[]> {
  const data = await postJson<{ success: boolean; results: GradingResult[] }>(
    "/api/ai/grade",
    { transcript, questions, answers },
  )
  return data.results
}

// 扩写文本
export async function expandText(
  text: string,
  targetWordCount: number,
  topic: string,
  difficulty: string,
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
    { text, targetWordCount, topic, difficulty, maxAttempts },
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
