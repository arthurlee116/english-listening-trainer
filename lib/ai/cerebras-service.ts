import 'server-only'
import type { ArkMessage, ArkCallOptions } from '../ark-helper'
import { callArkAPI } from '../ark-helper'

const DEFAULT_TEMPERATURE = 0.3
const DEFAULT_MAX_TOKENS = 8192

export interface StructuredCallOverrides {
  temperature?: number
  maxTokens?: number
  maxRetries?: number
  timeoutMs?: number
  disableProxy?: boolean
  enableProxyHealthCheck?: boolean
  signal?: AbortSignal
}

export interface InvokeStructuredParams {
  messages: ArkMessage[]
  schema: Record<string, unknown>
  schemaName: string
  model?: string
  options?: StructuredCallOverrides
}

function buildResponseFormat(schemaName: string, schema: Record<string, unknown>) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: schemaName,
      strict: true,
      schema
    }
  }
}

function createParser<T>(schemaName: string) {
  return (payload: string): T => {
    try {
      return JSON.parse(payload) as T
    } catch (error) {
      const snippet = payload.slice(0, 200)
      throw new Error(
        `Failed to parse structured response (${schemaName}): ${
          error instanceof Error ? error.message : String(error)
        }\nPayload preview: ${snippet}${payload.length > 200 ? '…' : ''}`
      )
    }
  }
}

export async function invokeStructured<T>(params: InvokeStructuredParams): Promise<T> {
  const {
    messages,
    schema,
    schemaName,
    model,
    options
  } = params

  const arkOptions: ArkCallOptions<T> = {
    messages,
    model,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    responseFormat: buildResponseFormat(schemaName, schema),
    parser: createParser<T>(schemaName),
    maxRetries: options?.maxRetries,
    timeoutMs: options?.timeoutMs,
    disableProxy: options?.disableProxy,
    enableProxyHealthCheck: options?.enableProxyHealthCheck,
    signal: options?.signal
  }

  return callArkAPI<T>(arkOptions)
}
