"use client"

import * as React from "react"
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ModelTelemetryPoint } from "@/lib/ai/model-telemetry"

// Define the structure of the data fetched from the API
type TelemetryData = {
  latest: ModelTelemetryPoint
  averageLatencyMs: number
  averageSuccessRate: number
}

type TelemetryResponse = {
  data: TelemetryData
  meta: {
    generatedAt: string
  }
}

type State = {
  status: 'loading' | 'success' | 'error'
  data: TelemetryResponse | null
}

const initialState: State = {
  status: 'loading',
  data: null,
}

const API_URL = "/api/ai/telemetry"

export function ModelTelemetryWidget() {
  const [state, setState] = React.useState<State>(initialState)

  const fetchTelemetry = React.useCallback(async () => {
    setState({ status: 'loading', data: null })
    try {
      const response = await fetch(API_URL)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data: TelemetryResponse = await response.json()
      setState({ status: 'success', data })
    } catch (error) {
      console.error("Failed to fetch AI telemetry:", error)
      setState({ status: 'error', data: null })
    }
  }, [])

  React.useEffect(() => {
    fetchTelemetry()
  }, [fetchTelemetry])

  // Trend badge compares latest metric to the 7-day average
  const renderTrendBadge = (latest: number, average: number, isLatency: boolean) => {
    const diff = latest - average
    // Lower latency is better (diff < 0), higher success rate is better (diff > 0)
    const isBetter = isLatency ? diff < 0 : diff > 0 

    if (Math.abs(diff) < 0.01) { // Threshold for no significant change
      return null
    }

    const Icon = isBetter ? TrendingUp : TrendingDown
    const color = isBetter ? "text-green-500" : "text-red-500"
    const trendText = isBetter ? "Improved" : "Worse"

    return (
      <span className={`inline-flex items-center text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {trendText}
      </span>
    )
  }

  const renderContent = () => {
    if (state.status === 'loading') {
      return <div className="p-6 text-center text-sm text-muted-foreground">Loading AI Telemetry...</div>
    }

    if (state.status === 'error') {
      return (
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-red-500">Failed to load telemetry data.</p>
          <Button onClick={fetchTelemetry} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      )
    }

    if (state.status === 'success' && state.data) {
      const { latest, averageLatencyMs, averageSuccessRate } = state.data.data
      
      // Format observedAt via Intl.DateTimeFormat('zh-CN', ...)
      const observedAtDate = new Date(latest.observedAt)
      const formattedObservedAt = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        timeZone: 'UTC', // Assuming the ISO string is UTC
      }).format(observedAtDate)

      return (
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between border-b pb-2">
            <p className="text-sm font-medium text-muted-foreground">Latest Snapshot</p>
            <p className="text-xs text-muted-foreground">{formattedObservedAt} (UTC)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Latest Metrics */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Latency</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold">{latest.latencyMs}</span>
                <span className="text-sm text-muted-foreground">ms</span>
                {renderTrendBadge(latest.latencyMs, averageLatencyMs, true)}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Success Rate</p>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold">{(latest.successRate * 100).toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">%</span>
                {renderTrendBadge(latest.successRate, averageSuccessRate, false)}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">7-Day Average</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Latency</p>
                <span className="text-lg font-semibold">{averageLatencyMs} ms</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <span className="text-lg font-semibold">{(averageSuccessRate * 100).toFixed(1)} %</span>
              </div>
            </div>
          </div>
        </CardContent>
      )
    }
    return null
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">AI Model Telemetry Snapshot</CardTitle>
      </CardHeader>
      {renderContent()}
    </Card>
  )
}
