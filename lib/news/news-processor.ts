import 'server-only'
import { getPrismaClient } from '@/lib/database'
import { invokeStructured } from '@/lib/ai/cerebras-service'
import type { FetchedArticle } from './rss-fetcher'

const prisma = getPrismaClient()

const DIFFICULTIES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const TOPICS_PER_DIFFICULTY = 5
const EXPIRY_HOURS = 24

interface ArticleAnalysis {
  difficulty: string
  topic: string
  briefSummary: string
}

interface AnalysisResponse {
  articles: ArticleAnalysis[]
}

const analysisSchema = {
  type: 'object',
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          difficulty: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
          topic: { type: 'string' },
          briefSummary: { type: 'string' }
        },
        required: ['difficulty', 'topic', 'briefSummary'],
        additionalProperties: false
      }
    }
  },
  required: ['articles'],
  additionalProperties: false
} as const

function buildAnalysisPrompt(articles: { title: string; summary: string }[]): string {
  const articleList = articles.map((a, i) => `${i + 1}. Title: ${a.title}\n   Summary: ${a.summary}`).join('\n\n')

  return `You are an English language learning content curator. Analyze these news articles and determine which CEFR difficulty level (A1-C2) each is most suitable for.

Articles:
${articleList}

For each article, provide:
1. difficulty: The CEFR level (A1=beginner, A2=elementary, B1=intermediate, B2=upper-intermediate, C1=advanced, C2=proficient)
2. topic: A concise, engaging topic title for listening practice (in English, 5-10 words)
3. briefSummary: A one-sentence description of what the listening content will cover

Consider vocabulary complexity, sentence structure, and subject matter when assigning difficulty.
Return analysis for all ${articles.length} articles in the same order.`
}

export async function processAndStoreNews(fetchedArticles: FetchedArticle[]): Promise<number> {
  if (fetchedArticles.length === 0) return 0

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000)

  // 1. 过滤掉数据库中已存在的 URL
  const existingArticles = await prisma.newsArticle.findMany({
    where: {
      sourceUrl: { in: fetchedArticles.map(a => a.sourceUrl) }
    },
    select: { sourceUrl: true }
  })

  const existingUrls = new Set(existingArticles.map(a => a.sourceUrl))
  const newArticles = fetchedArticles.filter(a => !existingUrls.has(a.sourceUrl))

  if (newArticles.length === 0) return 0

  // 批量分析文章（每批20篇）
  const batchSize = 20
  const allAnalyzed: { article: FetchedArticle; analysis: ArticleAnalysis }[] = []

  for (let i = 0; i < newArticles.length; i += batchSize) {
    const batch = newArticles.slice(i, i + batchSize)
    const prompt = buildAnalysisPrompt(batch.map(a => ({ title: a.title, summary: a.summary })))

    try {
      const response = await invokeStructured<AnalysisResponse>({
        messages: [{ role: 'user', content: prompt }],
        schema: analysisSchema,
        schemaName: 'news_analysis',
        options: { temperature: 0.3, maxTokens: 2048 }
      })

      response.articles.forEach((analysis, idx) => {
        if (batch[idx]) {
          allAnalyzed.push({ article: batch[idx], analysis })
        }
      })
    } catch (error) {
      console.error('Failed to analyze batch:', error)
    }
  }

  // 按难度分组，每个难度选5篇
  const byDifficulty = new Map<string, typeof allAnalyzed>()
  for (const item of allAnalyzed) {
    const diff = item.analysis.difficulty
    if (!byDifficulty.has(diff)) byDifficulty.set(diff, [])
    byDifficulty.get(diff)!.push(item)
  }

  let topicsCreated = 0

  for (const difficulty of DIFFICULTIES) {
    const items = byDifficulty.get(difficulty) || []
    const selected = items.slice(0, TOPICS_PER_DIFFICULTY)

    for (const { article, analysis } of selected) {
      // 存储新闻文章
      const newsArticle = await prisma.newsArticle.create({
        data: {
          source: article.source,
          sourceUrl: article.sourceUrl,
          title: article.title,
          summary: article.summary,
          category: article.category,
          publishedAt: article.publishedAt,
          expiresAt
        }
      })

      // 创建话题
      await prisma.dailyTopic.create({
        data: {
          articleId: newsArticle.id,
          difficulty,
          topic: analysis.topic,
          briefSummary: analysis.briefSummary,
          expiresAt
        }
      })
      topicsCreated++
    }
  }

  return topicsCreated
}

export async function getActiveTopics(difficulty?: string, category?: string) {
  const now = new Date()
  return prisma.dailyTopic.findMany({
    where: {
      expiresAt: { gt: now },
      ...(difficulty ? { difficulty } : {}),
      ...(category ? { article: { category } } : {})
    },
    include: {
      article: { select: { source: true, sourceUrl: true, title: true, publishedAt: true, category: true } },
      transcripts: { select: { duration: true, wordCount: true } }
    },
    orderBy: { generatedAt: 'desc' }
  })
}

export async function cleanupExpiredData() {
  const now = new Date()
  await prisma.newsArticle.deleteMany({ where: { expiresAt: { lt: now } } })
}
