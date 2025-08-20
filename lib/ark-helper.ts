// 该文件仅在服务端运行
import "server-only"
import { HttpsProxyAgent } from 'https-proxy-agent'
import Cerebras from '@cerebras/cerebras_cloud_sdk'

export interface ArkMessage {
  role: "system" | "user" | "assistant"
  content: string
}

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY

if (!CEREBRAS_API_KEY) {
  throw new Error("CEREBRAS_API_KEY 环境变量未设置")
}

// 代理配置（本机代理端口：7890）
const PROXY_URL = 'http://127.0.0.1:7890'
const proxyAgent = new HttpsProxyAgent(PROXY_URL)

// 初始化 Cerebras 客户端，使用代理
const client = new Cerebras({
  apiKey: CEREBRAS_API_KEY,
  httpAgent: proxyAgent,
})

// Cerebras 模型 ID
const CEREBRAS_MODEL_ID = "qwen-3-235b-a22b-instruct-2507"

/**
 * 调用 Cerebras 大模型 API
 * @param messages 聊天上下文
 * @param schema JSON Schema 用于结构化输出
 * @param schemaName Schema 名称
 * @param maxRetries 最大重试次数，默认 5
 */
export async function callArkAPI(
  messages: ArkMessage[],
  schema: Record<string, unknown>,
  schemaName: string,
  maxRetries = 5,
): Promise<unknown> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: CEREBRAS_MODEL_ID,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
        temperature: 0.3,
        max_tokens: 8192,
      })

      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error("Invalid response structure from Cerebras API")
      }

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error("No content in Cerebras API response")
      }

      return typeof content === "string" ? JSON.parse(content) : content
    } catch (error) {
      console.error(`Cerebras API attempt ${attempt} failed:`, error)
      if (attempt === maxRetries) throw error
      // 指数退避
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
    }
  }
  // 理论上不会走到这里
  throw new Error("Cerebras API failed after max retries")
} 
