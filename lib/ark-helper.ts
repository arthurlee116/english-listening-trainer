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

// Cerebras API 代理配置：支持环境变量覆盖和自动回退
const DEFAULT_LOCAL_PROXY = 'http://127.0.0.1:7890'
const DEFAULT_REMOTE_PROXY = 'http://81.71.93.183:10811'

const resolvedProxyUrl = process.env.CEREBRAS_PROXY_URL
  ?? (process.env.NODE_ENV === 'production' ? DEFAULT_REMOTE_PROXY : DEFAULT_LOCAL_PROXY)

let proxyAgent: HttpsProxyAgent | undefined
let client: Cerebras

// 初始化代理和客户端
function initializeClient() {
  try {
    if (resolvedProxyUrl) {
      console.log(`Initializing Cerebras client with proxy: ${resolvedProxyUrl}`)
      proxyAgent = new HttpsProxyAgent(resolvedProxyUrl)

      client = new Cerebras({
        apiKey: CEREBRAS_API_KEY,
        httpAgent: proxyAgent,
      })
    } else {
      console.log('Initializing Cerebras client without proxy')
      client = new Cerebras({
        apiKey: CEREBRAS_API_KEY,
      })
    }
  } catch (error) {
    console.error('Failed to initialize Cerebras client with proxy, falling back to direct connection:', error)
    client = new Cerebras({
      apiKey: CEREBRAS_API_KEY,
    })
  }
}

// 初始化客户端
initializeClient()

// 代理健康检查和自动回退
let proxyHealthy = true
let lastProxyCheck = 0
const PROXY_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

async function checkProxyHealth(): Promise<boolean> {
  const now = Date.now()
  if (now - lastProxyCheck < PROXY_CHECK_INTERVAL) {
    return proxyHealthy
  }

  lastProxyCheck = now

  if (!proxyAgent) {
    proxyHealthy = true
    return true
  }

  try {
    // Simple health check - try to make a minimal request
    const testClient = new Cerebras({
      apiKey: CEREBRAS_API_KEY,
      httpAgent: proxyAgent,
    })

    // Make a minimal request to test connectivity
    await testClient.chat.completions.create({
      model: CEREBRAS_MODEL_ID,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1,
      temperature: 0
    })

    proxyHealthy = true
    return true
  } catch (error) {
    console.warn('Proxy health check failed:', error)
    proxyHealthy = false
    return false
  }
}

// 创建回退客户端（无代理）
function createFallbackClient(): Cerebras {
  return new Cerebras({
    apiKey: CEREBRAS_API_KEY,
  })
}

// Cerebras 模型 ID
const CEREBRAS_MODEL_ID = "qwen-3-235b-a22b-instruct-2507"

/**
 * 调用 Cerebras 大模型 API，支持代理回退和增强错误处理
 * @param messages 聊天上下文
 * @param schema JSON Schema 用于结构化输出
 * @param schemaName Schema 名称
 * @param maxRetries 最大重试次数，默认 3
 */
export async function callArkAPI(
  messages: ArkMessage[],
  schema: Record<string, unknown>,
  schemaName: string,
  maxRetries = 3,
): Promise<unknown> {
  let currentClient = client
  let triedFallback = false

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check proxy health on first attempt
      if (attempt === 1 && proxyAgent) {
        const isHealthy = await checkProxyHealth()
        if (!isHealthy && !triedFallback) {
          console.log('Proxy unhealthy, switching to fallback client')
          currentClient = createFallbackClient()
          triedFallback = true
        }
      }

      const response = await currentClient.chat.completions.create({
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

      // Parse JSON response
      let parsedContent
      try {
        parsedContent = typeof content === "string" ? JSON.parse(content) : content
      } catch (parseError) {
        throw new Error(`Failed to parse API response as JSON: ${parseError}`)
      }

      return parsedContent

    } catch (error) {
      console.error(`Cerebras API attempt ${attempt} failed:`, error)

      // If this is a proxy-related error and we haven't tried fallback yet
      if (!triedFallback && proxyAgent && isProxyError(error)) {
        console.log('Proxy error detected, switching to fallback client')
        currentClient = createFallbackClient()
        triedFallback = true
        // Don't count this as a retry attempt
        attempt--
        continue
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Cerebras API failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Exponential backoff with jitter
      const baseDelay = Math.pow(2, attempt) * 1000
      const jitter = Math.random() * 1000
      const delay = baseDelay + jitter

      console.log(`Retrying in ${delay}ms...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw new Error("Cerebras API failed after max retries")
}

/**
 * 检查是否为代理相关错误
 */
function isProxyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return (
    message.includes('proxy') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection')
  )
}

/**
 * 获取当前代理状态信息
 */
export function getProxyStatus(): {
  proxyUrl: string | null
  proxyHealthy: boolean
  lastCheck: number
} {
  return {
    proxyUrl: resolvedProxyUrl || null,
    proxyHealthy,
    lastCheck: lastProxyCheck
  }
} 
