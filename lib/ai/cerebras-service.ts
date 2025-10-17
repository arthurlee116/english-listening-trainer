import 'server-only'
import type { ArkMessage, ArkCallOptions } from '../ark-helper'
import { callArkAPI } from '../ark-helper'

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
    schemaName,
    label: schemaName,
    responseFormat: buildResponseFormat(schemaName, schema),
    maxRetries: options?.maxRetries,
    timeoutMs: options?.timeoutMs,
    disableProxy: options?.disableProxy,
    enableProxyHealthCheck: options?.enableProxyHealthCheck,
    signal: options?.signal
  }

  if (typeof options?.temperature === 'number') {
    arkOptions.temperature = options.temperature
  }

  if (typeof options?.maxTokens === 'number') {
    arkOptions.maxTokens = options.maxTokens
  }

  return callArkAPI<T>(arkOptions)
}
