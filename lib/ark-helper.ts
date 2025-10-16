// 该文件仅在服务端运行
import 'server-only'
import { Agent as NodeHttpsAgent } from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { configManager, type AIServiceConfig } from './config-manager'

export interface ArkMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ArkCallOptions<T> {
  messages: ArkMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: Cerebras.ChatCompletionCreateParams['response_format']
  parser?: (payload: string) => T
  maxRetries?: number
  timeoutMs?: number
  disableProxy?: boolean
  enableProxyHealthCheck?: boolean
  signal?: AbortSignal
}

type ClientVariant = 'direct' | 'proxy'

let cachedDirectClient: Cerebras | null = null
let cachedProxyClient: Cerebras | null = null
let directAgent: NodeHttpsAgent | null = null
let proxyAgent: HttpsProxyAgent<string> | null = null
let cachedConfigFingerprint: string | null = null

const defaultParser = <T>(payload: string): T => {
  return JSON.parse(payload) as T
}

const PROXY_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
let proxyHealthy = true
let lastProxyCheck = 0
let proxyCheckInFlight: Promise<boolean> | null = null

function ensureClientsForConfig(config: AIServiceConfig): void {
  const fingerprint = [
    config.baseUrl,
    config.timeout,
    config.maxRetries,
    config.proxyUrl ?? '',
    config.enableProxyHealthCheck ? '1' : '0'
  ].join('|')

  if (fingerprint === cachedConfigFingerprint) {
    return
  }

  cachedConfigFingerprint = fingerprint
  cachedDirectClient = null
  cachedProxyClient = null
  directAgent = null
  proxyAgent = null
}

function getHttpsAgent(): NodeHttpsAgent {
  if (!directAgent) {
    directAgent = new NodeHttpsAgent({
      keepAlive: true,
      maxSockets: 32
    })
  }
  return directAgent
}

function getProxyAgent(config: AIServiceConfig): HttpsProxyAgent<string> | null {
  if (!config.proxyUrl) {
    return null
  }
  if (!proxyAgent) {
    try {
      proxyAgent = new HttpsProxyAgent(config.proxyUrl)
    } catch (error) {
      console.error('Failed to initialize proxy agent, disabling proxy usage:', error)
      proxyAgent = null
    }
  }
  return proxyAgent
}

function createClient(variant: ClientVariant, config: AIServiceConfig): Cerebras | null {
  const baseOptions = {
    apiKey: config.cerebrasApiKey,
    baseURL: config.baseUrl,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    warmTCPConnection: false
  }

  if (variant === 'proxy') {
    const agent = getProxyAgent(config)
    if (!agent) {
      return null
    }
    return new Cerebras({
      ...baseOptions,
      httpAgent: agent
    })
  }

  return new Cerebras({
    ...baseOptions,
    httpAgent: getHttpsAgent()
  })
}

function getClient(variant: ClientVariant, config: AIServiceConfig): Cerebras | null {
  ensureClientsForConfig(config)

  if (variant === 'proxy') {
    if (!cachedProxyClient) {
      cachedProxyClient = createClient('proxy', config)
    }
    return cachedProxyClient
  }

  if (!cachedDirectClient) {
    cachedDirectClient = createClient('direct', config)
  }
  return cachedDirectClient
}

async function ensureProxyHealthy(config: AIServiceConfig): Promise<boolean> {
  if (!config.proxyUrl || !config.enableProxyHealthCheck) {
    return true
  }

  const now = Date.now()
  if (proxyCheckInFlight) {
    return proxyCheckInFlight
  }

  if (now - lastProxyCheck < PROXY_CHECK_INTERVAL) {
    return proxyHealthy
  }

  const proxyClient = getClient('proxy', config)
  if (!proxyClient) {
    proxyHealthy = false
    lastProxyCheck = now
    return proxyHealthy
  }

  proxyCheckInFlight = (async () => {
    try {
      await proxyClient.models.list({}, { timeout: Math.min(5000, config.timeout) })
      proxyHealthy = true
    } catch (error) {
      console.warn('Proxy health check failed:', error)
      proxyHealthy = false
    } finally {
      lastProxyCheck = Date.now()
      proxyCheckInFlight = null
    }
    return proxyHealthy
  })()

  return proxyCheckInFlight
}

function isProxyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
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

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : 'Unknown error'
}

function getContentString(content: unknown): string {
  if (content == null) {
    throw new Error('No content in Cerebras API response')
  }
  if (typeof content === 'string') {
    return content
  }
  try {
    return JSON.stringify(content)
  } catch (err) {
    throw new Error(`Failed to serialize response content: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function buildPayload(
  options: ArkCallOptions<unknown>,
  config: AIServiceConfig
): Cerebras.ChatCompletionCreateParams {
  const payload: Cerebras.ChatCompletionCreateParams = {
    model: options.model || config.defaultModel,
    messages: options.messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 8192
  }

  if (options.responseFormat) {
    payload.response_format = options.responseFormat
  }

  return payload
}

function computeBackoffDelay(attempt: number): number {
  const baseDelay = Math.pow(2, attempt) * 250
  const jitter = Math.random() * 250
  return Math.min(baseDelay + jitter, 8000)
}

export async function callArkAPI<T>(options: ArkCallOptions<T>): Promise<T> {
  const config = configManager.getAIConfig()

  const disableProxy = options.disableProxy === true
  const allowProxy = !disableProxy && !!config.proxyUrl
  const proxyHealthChecksEnabled = options.enableProxyHealthCheck ?? config.enableProxyHealthCheck
  const maxAttempts = Math.max(1, options.maxRetries ?? config.maxRetries)
  const timeoutMs = options.timeoutMs ?? config.timeout
  const parser = options.parser ?? defaultParser<T>

  const payload = buildPayload(options, config)

  let attempt = 0
  let useProxy = allowProxy
  let lastError: unknown = null
  let proxyMarkedUnavailable = !allowProxy

  while (attempt < maxAttempts) {
    attempt += 1

    if (useProxy && proxyHealthChecksEnabled) {
      const healthy = await ensureProxyHealthy(config)
      if (!healthy) {
        useProxy = false
        proxyMarkedUnavailable = true
        attempt -= 1
        continue
      }
    }

    const client = getClient(useProxy ? 'proxy' : 'direct', config)

    if (!client) {
      useProxy = false
      proxyMarkedUnavailable = true
      attempt -= 1
      continue
    }

    try {
      const response = await client.chat.completions.create(
        payload,
        {
          timeout: timeoutMs,
          signal: options.signal
        }
      )

      // 确保响应不是 Stream 类型
      if ('choices' in response && Array.isArray(response.choices)) {
        const choice = response.choices[0]?.message?.content
        const contentString = getContentString(choice)
        return parser(contentString)
      }
      
      throw new Error('Unexpected response format from Cerebras API')
    } catch (error) {
      lastError = error

      if (useProxy && allowProxy && !proxyMarkedUnavailable && isProxyError(error)) {
        console.warn('Proxy error detected, switching to direct client')
        useProxy = false
        proxyMarkedUnavailable = true
        attempt -= 1
        continue
      }

      if (attempt >= maxAttempts) {
        break
      }

      const delay = computeBackoffDelay(attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error(`Cerebras API failed after ${maxAttempts} attempts: ${formatError(lastError)}`)
}

export function getProxyStatus(): {
  proxyUrl: string | null
  proxyHealthy: boolean
  lastCheck: number
} {
  const config = configManager.getAIConfig()
  return {
    proxyUrl: config.proxyUrl,
    proxyHealthy,
    lastCheck: lastProxyCheck
  }
}
