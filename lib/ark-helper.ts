// 该文件仅在服务端运行
import "server-only"
import { HttpsProxyAgent } from 'https-proxy-agent'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { getAIConfig } from './config-manager'

export interface ArkMessage {
  role: "system" | "user" | "assistant"
  content: string
}

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY

if (!CEREBRAS_API_KEY) {
  throw new Error("CEREBRAS_API_KEY 环境变量未设置")
}

// 代理与基础地址配置
const config = getAIConfig()

// 强制使用代理：从 HTTPS_PROXY/HTTP_PROXY/PROXY_URL 中读取
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.PROXY_URL

if (!proxyUrl) {
  throw new Error('必须配置代理以访问 Cerebras（设置 HTTPS_PROXY/HTTP_PROXY/PROXY_URL）')
}

const clientOptions: any = {
  apiKey: CEREBRAS_API_KEY,
}

// 使用配置的 baseUrl（如设置）
if (config.baseUrl) {
  clientOptions.baseURL = config.baseUrl
}

// 如提供代理，则注入 httpAgent
try {
  const agent = new HttpsProxyAgent(proxyUrl)
  clientOptions.httpAgent = agent
  clientOptions.httpsAgent = agent
  console.log(`🌐 Using proxy for Cerebras API: ${proxyUrl}`)
} catch (e) {
  console.error('❌ 代理URL无效，无法初始化 Cerebras 客户端: ', proxyUrl)
  throw e
}

// 初始化 Cerebras 客户端（可带 baseURL 与代理）
const client = new Cerebras(clientOptions)

// Cerebras 模型 ID
const CEREBRAS_MODEL_ID = config.defaultModel || "qwen-3-235b-a22b-instruct-2507"

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

      if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
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
