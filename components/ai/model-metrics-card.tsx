"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Zap,
  Activity,
  Clock,
  AlertTriangle
} from "lucide-react"
import type { ModelBenchmark } from "@/lib/ai/model-benchmarks"

interface BenchmarkResponse {
  data: ModelBenchmark & {
    lastValidatedAt: string; // API 返回的是字符串
  }
  meta: {
    generatedAt: string
  }
}

type ComponentState = "loading" | "error" | "success"

export function ModelMetricsCard() {
  const [state, setState] = useState<ComponentState>("loading")
  const [data, setData] = useState<ModelBenchmark | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchBenchmarkData = async () => {
    try {
      setState("loading")
      setError(null)
      
      const response = await fetch("/api/ai/benchmarks")
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result: BenchmarkResponse = await response.json()
      
      // 将 ISO 字符串转换回 Date 对象
      const dataWithDate: ModelBenchmark = {
        ...result.data,
        lastValidatedAt: new Date(result.data.lastValidatedAt)
      }
      
      setData(dataWithDate)
      setState("success")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "获取数据失败"
      setError(errorMessage)
      setState("error")
      console.error("Failed to fetch benchmark data:", err)
    }
  }

  useEffect(() => {
    fetchBenchmarkData()
  }, [])

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(date))
  }

  const getStateIcon = () => {
    switch (state) {
      case "loading":
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />
    }
  }

  const getStateText = () => {
    switch (state) {
      case "loading":
        return "正在加载模型指标..."
      case "error":
        return "加载失败"
      case "success":
        return "模型指标"
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {getStateIcon()}
          {getStateText()}
        </CardTitle>
        
        {state === "error" && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBenchmarkData}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 加载状态 */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-muted-foreground">正在获取 AI 模型基准测试数据...</p>
          </div>
        )}

        {/* 错误状态 */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div className="text-center space-y-2">
              <p className="text-red-600 font-medium">获取模型指标失败</p>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* 成功状态 */}
        {state === "success" && data && (
          <div className="space-y-6">
            {/* 模型基本信息 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{data.displayName}</h3>
                  <p className="text-sm text-muted-foreground">版本 {data.version}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {data.modelId}
                </Badge>
              </div>
            </div>

            {/* 性能指标 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">延迟</p>
                  <p className="text-2xl font-bold text-blue-600">{data.latencyMs}ms</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Activity className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">吞吐量</p>
                  <p className="text-2xl font-bold text-green-600">{data.throughputCharsPerSec}</p>
                  <p className="text-xs text-green-600">字符/秒</p>
                </div>
              </div>
            </div>

            {/* 模型优势 */}
            {data.strengths && data.strengths.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-600" />
                  <h4 className="font-semibold text-foreground">模型优势</h4>
                </div>
                <ul className="space-y-2">
                  {data.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 注意事项 */}
            {data.caveats && data.caveats.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <h4 className="font-semibold text-foreground">注意事项</h4>
                </div>
                <ul className="space-y-2">
                  {data.caveats.map((caveat, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{caveat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 最后验证时间 */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                最后验证时间: {formatDate(data.lastValidatedAt)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}