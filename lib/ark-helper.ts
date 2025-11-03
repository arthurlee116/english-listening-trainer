// 该文件仅在服务端运行
import type CerebrasSdk from '@cerebras/cerebras_cloud_sdk'
import { configManager, type AIServiceConfig } from './config-manager'
import { getCerebrasClientManager, type ProxyStatusSnapshot } from './ai/cerebras-client-manager'
import { RetryPolicy } from './ai/retry-strategy'
import { createStructuredJsonParser } from './ai/parsers'
import { emitAiTelemetry } from './ai/telemetry'

export interface ArkMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ArkCallOptions<T> {
  messages: ArkMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: Parameters<CerebrasSdk['chat']['completions']['create']>[0]['response_format']
  parser?: (payload: unknown) => T
  schemaName?: string
  label?: string
  maxRetries?: number
  timeoutMs?: number
  signal?: AbortSignal
}

type ChatCompletionParams = Parameters<CerebrasSdk['chat']['completions']['create']>[0]
type ChatCompletionOptions = Parameters<CerebrasSdk['chat']['completions']['create']>[1]
type ChatCompletionResponse = Awaited<ReturnType<CerebrasSdk['chat']['completions']['create']>>

// 类型守卫:判断是否为非流式的 ChatCompletion
function isNonStreamChatCompletion(response: ChatCompletionResponse): response is Extract<ChatCompletionResponse, { usage?: unknown }> {
  return response != null && typeof response === 'object' && 'choices' in response && !Symbol.asyncIterator
}

const MAX_CONTENT_PREVIEW = 400

function describePayload(payload: unknown): string {
  if (payload == null) {
    return 'null'
  }

  if (typeof payload === 'string') {
    return payload.length > MAX_CONTENT_PREVIEW
      ? `${payload.slice(0, MAX_CONTENT_PREVIEW)}...`
      : payload
  }

  try {
    const serialized = JSON.stringify(payload)
    return serialized.length > MAX_CONTENT_PREVIEW
      ? `${serialized.slice(0, MAX_CONTENT_PREVIEW)}...`
      : serialized
  } catch {
    return `[unserializable ${typeof payload}]`
  }
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const preview = describePayload(content)
    throw new Error(
      `Failed to serialize response content (type: ${typeof content}): ${reason}. Payload preview: ${preview}`
    )
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : 'Unknown error'
}

function buildPayload(
  options: ArkCallOptions<unknown>,
  config: AIServiceConfig
): ChatCompletionParams {
  const payload: ChatCompletionParams = {
    model: options.model ?? config.defaultModel,
    messages: options.messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    temperature: options.temperature ?? config.defaultTemperature,
    max_tokens: options.maxTokens ?? config.defaultMaxTokens
  }

  if (options.responseFormat) {
    payload.response_format = options.responseFormat
  }

  return payload
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveParser<T>(options: ArkCallOptions<T>): (payload: unknown) => T {
  if (options.parser) {
    return options.parser
  }
  const schemaName = options.schemaName ?? options.label ?? 'ark_response'
  return createStructuredJsonParser<T>(schemaName)
}

function extractUsage(response: ChatCompletionResponse | undefined): { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined {
  if (!response) {
    return undefined
  }
  // 只有非流式响应才有 usage 属性
  if (isNonStreamChatCompletion(response) && 'usage' in response) {
    const usage = response.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    if (usage && typeof usage === 'object') {
      return {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      }
    }
  }
  return undefined
}

export async function callArkAPI<T>(options: ArkCallOptions<T>): Promise<T> {
  const config = configManager.getAIConfig()
  const manager = getCerebrasClientManager()
  const parser = resolveParser(options)
  const payload = buildPayload(options, config)
  const timeoutMs = options.timeoutMs ?? config.timeout
  const retryPolicy = new RetryPolicy()

  const maxAttempts = Math.max(1, options.maxRetries ?? config.maxRetries)

  const attemptRecords: Array<{
    attempt: number
    durationMs: number
    success: boolean
    error?: string
  }> = []

  let attempts = 0
  let lastError: unknown = null
  let totalBackoffMs = 0
  let responseUsage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined

  const client = manager.getClient(config)

  while (attempts < maxAttempts) {
    attempts += 1
    const startTime = Date.now()

    try {
      const completionOptions: ChatCompletionOptions = {
        timeout: timeoutMs,
        signal: options.signal
      }
      const response = await client.chat.completions.create(payload, completionOptions)

      if (!('choices' in response) || !Array.isArray(response.choices)) {
        throw new Error('Unexpected response format from Cerebras API')
      }

      const choice = response.choices[0]?.message?.content
      const contentString = getContentString(choice)
      const parsed = parser(contentString)

      const durationMs = Date.now() - startTime
      attemptRecords.push({
        attempt: attempts,
        durationMs,
        success: true
      })
      responseUsage = extractUsage(response)

      emitAiTelemetry({
        label: options.label ?? options.schemaName,
        success: true,
        attempts: attemptRecords.map(r => ({
          ...r,
          variant: 'proxy' as const
        })),
        totalBackoffMs,
        fallbackPath: 'proxy-only',
        proxyEnabled: true,
        timestamp: Date.now(),
        usage: responseUsage
      })

      return parsed
    } catch (error) {
      const durationMs = Date.now() - startTime
      const formattedError = formatError(error)
      lastError = error

      attemptRecords.push({
        attempt: attempts,
        durationMs,
        success: false,
        error: formattedError
      })

      if (attempts >= maxAttempts) {
        break
      }

      const delay = retryPolicy.getDelay(attempts)
      totalBackoffMs += delay
      await sleep(delay)
    }
  }

  const failureMessage = `Cerebras API failed after ${attempts} attempts (proxy-only): ${formatError(lastError)}`

  emitAiTelemetry({
    label: options.label ?? options.schemaName,
    success: false,
    attempts: attemptRecords.map(r => ({
      ...r,
      variant: 'proxy' as const
    })),
    totalBackoffMs,
    fallbackPath: 'proxy-only',
    finalError: formatError(lastError),
    proxyEnabled: true,
    timestamp: Date.now()
  })

  throw new Error(failureMessage)
}

export function getProxyStatus(): ProxyStatusSnapshot {
  return getCerebrasClientManager().getProxyStatus()
}
