import 'server-only'

const EXA_API_KEY = process.env.EXA_API_KEY

interface ExaSearchResult {
  title: string
  url: string
  text: string
  publishedDate?: string
}

interface ExaSearchResponse {
  results: ExaSearchResult[]
}

export interface NewsEnhancementResult {
  sources: {
    title: string
    url: string
    snippet: string
    publishedDate?: string
  }[]
  context: string // 合并后的上下文，用于注入prompt
}

export async function searchNewsForTopic(topic: string, maxResults = 5): Promise<NewsEnhancementResult> {
  if (!EXA_API_KEY) {
    console.warn('[Exa Search] API key not configured')
    return { sources: [], context: '' }
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EXA_API_KEY
      },
      body: JSON.stringify({
        query: topic,
        type: 'neural',
        useAutoprompt: true,
        numResults: maxResults,
        contents: {
          text: { maxCharacters: 500 }
        },
        category: 'news'
      })
    })

    if (!response.ok) {
      throw new Error(`Exa API error: ${response.status}`)
    }

    const data: ExaSearchResponse = await response.json()
    
    const sources = data.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.text?.slice(0, 300) || '',
      publishedDate: r.publishedDate
    }))

    // 构建上下文字符串
    const context = sources.map((s, i) => 
      `[Source ${i + 1}] ${s.title}\n${s.snippet}`
    ).join('\n\n')

    return { sources, context }
  } catch (error) {
    console.error('[Exa Search] Failed:', error)
    return { sources: [], context: '' }
  }
}

export function buildEnhancedTranscriptPrompt(
  baseTopic: string,
  newsContext: string,
  difficulty: string,
  wordCount: number
): string {
  const difficultyDescriptors: Record<string, string> = {
    'A1': 'Use very simple vocabulary and short sentences. Topics should be familiar and concrete.',
    'A2': 'Use basic vocabulary and simple sentence structures. Include common expressions.',
    'B1': 'Use intermediate vocabulary with some complex sentences. Include opinions and explanations.',
    'B2': 'Use varied vocabulary and complex sentence structures. Include nuanced opinions.',
    'C1': 'Use sophisticated vocabulary and complex grammatical structures. Include idiomatic expressions.',
    'C2': 'Use native-level vocabulary including rare words and idioms. Include complex arguments.'
  }

  return `You are creating an English listening comprehension script on the topic: "${baseTopic}"

Here is recent news context to inform your content:
${newsContext}

Target: ${wordCount} words (±10%)
Difficulty: ${difficulty}
${difficultyDescriptors[difficulty] || difficultyDescriptors['B1']}

Requirements:
- Create engaging, natural-sounding content suitable for listening practice
- Incorporate relevant information from the news context
- Match vocabulary and sentence complexity to the difficulty level
- Make it informative and current
- Do NOT include any meta-commentary or instructions

Generate the listening script now.`
}
