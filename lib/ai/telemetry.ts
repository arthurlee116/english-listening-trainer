

export type TelemetryClientVariant = 'proxy' | 'direct'

export interface ArkCallAttemptTelemetry {
  attempt: number
  variant: TelemetryClientVariant
  durationMs: number
  success: boolean
  error?: string
}

export interface ArkCallTelemetry {
  label?: string
  success: boolean
  attempts: ArkCallAttemptTelemetry[]
  totalBackoffMs: number
  fallbackPath: string
  finalError?: string
  proxyEnabled: boolean
  timestamp: number
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

type TelemetryListener = (event: ArkCallTelemetry) => void

const listeners = new Set<TelemetryListener>()

export function addAiTelemetryListener(listener: TelemetryListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitAiTelemetry(event: ArkCallTelemetry): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      console.warn('AI telemetry listener failed', error)
    }
  }
}
