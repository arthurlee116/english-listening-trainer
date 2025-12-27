import 'server-only'
import { getPrismaClient } from '@/lib/database'
import { invokeStructured } from '@/lib/ai/cerebras-service'

const prisma = getPrismaClient()

// 时长对应的目标字数 (按每分钟约150词计算)
const DURATION_WORD_COUNTS: Record<number, number> = {
  1: 150,
  2: 300,
  3: 450,
  5: 750
}

const DURATIONS = [1, 2, 3, 5]

interface TranscriptResponse {
  transcript: string
}

const transcriptSchema = {
  type: 'object',
  properties: {
    transcript: { type: 'string' }
  },
  required: ['transcript'],
  additionalProperties: false
} as const

function getDifficultyDescriptor(difficulty: string): string {
  const descriptors: Record<string, string> = {
    'A1': 'Use very simple vocabulary and short sentences. Topics should be familiar and concrete (family, shopping, daily routines). Speak slowly and clearly.',
    'A2': 'Use basic vocabulary and simple sentence structures. Include common expressions. Topics can include travel, work, and hobbies.',
    'B1': 'Use intermediate vocabulary with some complex sentences. Include opinions and explanations. Topics can be more abstract.',
    'B2': 'Use varied vocabulary and complex sentence structures. Include nuanced opinions, hypotheticals, and detailed explanations.',
    'C1': 'Use sophisticated vocabulary and complex grammatical structures. Include idiomatic expressions, subtle humor, and abstract concepts.',
    'C2': 'Use native-level vocabulary including rare words and idioms. Include complex arguments, cultural references, and nuanced perspectives.'
  }
  return descriptors[difficulty] || descriptors['B1']
}

function buildTranscriptPrompt(
  topic: string,
  summary: string,
  newsTitle: string,
  difficulty: string,
  wordCount: number
): string {
  return `You are creating an English listening comprehension script based on a news story.

News Context:
- Original headline: ${newsTitle}
- Topic for practice: ${topic}
- Brief: ${summary}

Target: ${wordCount} words (±10%)
Difficulty: ${difficulty}
${getDifficultyDescriptor(difficulty)}

Requirements:
- Create engaging, natural-sounding content suitable for listening practice
- Base the content on the news context but expand it into a coherent narrative
- Match vocabulary and sentence complexity to the difficulty level
- Include varied sentence structures appropriate for the level
- Make it informative and interesting
- Do NOT include any meta-commentary or instructions

Generate the listening script now.`
}

export async function generateTranscriptsForTopic(topicId: string): Promise<number> {
  const topic = await prisma.dailyTopic.findUnique({
    where: { id: topicId },
    include: { article: true, transcripts: true }
  })

  if (!topic || !topic.article) return 0

  // 检查已有的时长版本
  const existingDurations = new Set(topic.transcripts.map((t: { duration: number }) => t.duration))
  const missingDurations = DURATIONS.filter(d => !existingDurations.has(d))

  let generated = 0

  for (const duration of missingDurations) {
    const wordCount = DURATION_WORD_COUNTS[duration]
    const prompt = buildTranscriptPrompt(
      topic.topic,
      topic.briefSummary,
      topic.article.title,
      topic.difficulty,
      wordCount
    )

    try {
      const response = await invokeStructured<TranscriptResponse>({
        messages: [{ role: 'user', content: prompt }],
        schema: transcriptSchema,
        schemaName: 'transcript_generation',
        options: { temperature: 0.7, maxTokens: 2048 }
      })

      const actualWordCount = response.transcript.split(/\s+/).length

      await prisma.preGeneratedTranscript.create({
        data: {
          topicId,
          duration,
          wordCount: actualWordCount,
          transcript: response.transcript
        }
      })
      generated++
    } catch (error) {
      console.error(`Failed to generate ${duration}min transcript for topic ${topicId}:`, error)
    }
  }

  return generated
}

export async function generateAllPendingTranscripts(): Promise<number> {
  const now = new Date()
  
  // 找出所有活跃话题中缺少稿子的
  const topics = await prisma.dailyTopic.findMany({
    where: { expiresAt: { gt: now } },
    include: { transcripts: true }
  })

  let totalGenerated = 0

  for (const topic of topics) {
    const existingDurations = topic.transcripts.length
    if (existingDurations < DURATIONS.length) {
      const generated = await generateTranscriptsForTopic(topic.id)
      totalGenerated += generated
    }
  }

  return totalGenerated
}

export async function getTranscript(topicId: string, duration: number) {
  return prisma.preGeneratedTranscript.findUnique({
    where: { topicId_duration: { topicId, duration } }
  })
}
