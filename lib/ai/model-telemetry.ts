/**
 * NOTE: This data is mocked for demonstration and testing purposes.
 * In a production environment, this data would be sourced from a real-time
 * telemetry system or database.
 */
export default {}

export type ModelTelemetryPoint = {
  observedAt: string // ISO 8601 string
  latencyMs: number
  successRate: number // 0.0 to 1.0
}

export const modelTelemetrySamples: ModelTelemetryPoint[] = [
  { observedAt: "2025-11-01T09:00:00.000Z", latencyMs: 1500, successRate: 0.98 },
  { observedAt: "2025-10-31T15:00:00.000Z", latencyMs: 1600, successRate: 0.95 },
  { observedAt: "2025-10-30T10:00:00.000Z", latencyMs: 1450, successRate: 0.99 },
  { observedAt: "2025-10-29T12:00:00.000Z", latencyMs: 1700, successRate: 0.90 },
  { observedAt: "2025-10-28T18:00:00.000Z", latencyMs: 1550, successRate: 0.97 },
  { observedAt: "2025-10-27T08:00:00.000Z", latencyMs: 1650, successRate: 0.96 },
  { observedAt: "2025-10-26T11:00:00.000Z", latencyMs: 1500, successRate: 0.98 },
]

export function getTelemetrySummary(): {
  latest: ModelTelemetryPoint
  averageLatencyMs: number
  averageSuccessRate: number
} {
  if (modelTelemetrySamples.length === 0) {
    throw new Error("No telemetry samples available")
  }

  const latest = modelTelemetrySamples[0]

  const totalLatency = modelTelemetrySamples.reduce((sum, sample) => sum + sample.latencyMs, 0)
  const totalSuccessRate = modelTelemetrySamples.reduce((sum, sample) => sum + sample.successRate, 0)
  const count = modelTelemetrySamples.length

  // Averages rounded to one decimal place (latency) or two decimal places (success rate)
  const averageLatencyMs = parseFloat((totalLatency / count).toFixed(1))
  const averageSuccessRate = parseFloat((totalSuccessRate / count).toFixed(2))

  return {
    latest,
    averageLatencyMs,
    averageSuccessRate,
  }
}
