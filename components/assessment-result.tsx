"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle, TrendingUp, BookOpen } from "lucide-react"

interface AssessmentResultProps {
  result: {
    difficultyLevel: number
    difficultyRange: {
      min: number
      max: number
      name: string
      nameEn: string
      description: string
    }
    scores: number[]
    summary: string
    details: Array<{
      audioId: number
      topic: string
      userScore: number
      difficulty: number
      performance: string
    }>
    recommendation: string
  }
  onReturnHome: () => void
  onRetry?: () => void
}

export const AssessmentResult = ({ result, onReturnHome, onRetry }: AssessmentResultProps) => {
  const averageScore = result.scores.reduce((sum, score) => sum + score, 0) / result.scores.length

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case '优秀': return 'text-green-600 bg-green-50 border-green-200'
      case '良好': return 'text-blue-600 bg-blue-50 border-blue-200'
      case '一般': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case '需改进': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-light'
    }
  }

  const getScoreIcon = (score: number) => {
    if (score >= 8) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (score >= 6) return <TrendingUp className="h-4 w-4 text-blue-500" />
    if (score >= 4) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    return <AlertTriangle className="h-4 w-4 text-red-500" />
  }

  return (
    <div className="space-y-6">
      {/* 主要结果展示 */}
      <Card className="p-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-4">评估完成</h1>
        
        <div className="flex items-center justify-center space-x-4 mb-4">
          <Badge variant="outline" className="text-xl px-6 py-3">
            难度等级: {result.difficultyLevel}/30
          </Badge>
          <Badge className="text-xl px-6 py-3">
            {result.difficultyRange.name}
          </Badge>
        </div>

        <div className="text-gray-600 mb-6">
          <p className="mb-2">{result.difficultyRange.description}</p>
          <p>平均评分: <span className="font-semibold text-blue-600">{averageScore.toFixed(1)}/10</span></p>
        </div>
      </Card>

      {/* 评估摘要 */}
      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertDescription className="text-base">
          {result.summary}
        </AlertDescription>
      </Alert>

      {/* 详细表现 */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          各段音频表现
        </h3>
        <div className="space-y-4">
          {result.details.map((detail) => (
            <div 
              key={detail.audioId} 
              className="flex items-center justify-between p-4 rounded-lg border-2 transition-colors hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-1">
                  {getScoreIcon(detail.userScore)}
                  <h4 className="font-medium text-gray-800">
                    第{detail.audioId}段 - {detail.topic}
                  </h4>
                </div>
                <p className="text-sm text-gray-600">
                  音频难度: {detail.difficulty}/30
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <Badge 
                  variant="outline"
                  className={getPerformanceColor(detail.performance)}
                >
                  {detail.performance}
                </Badge>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">
                    {detail.userScore}
                  </div>
                  <div className="text-xs text-gray-500">
                    /10分
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 学习建议 */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-base">
          <strong>学习建议:</strong> {result.recommendation}
        </AlertDescription>
      </Alert>

      {/* 操作按钮 */}
      <div className="flex justify-center space-x-4">
        <Button onClick={onReturnHome} size="lg" className="px-8">
          <BookOpen className="h-4 w-4 mr-2" />
          开始练习
        </Button>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="lg" className="px-8">
            重新测试
          </Button>
        )}
      </div>

      {/* 说明文字 */}
      <div className="text-center text-sm text-gray-500 mt-6">
        <p>系统将根据您的难度等级自动调整练习内容的难度</p>
      </div>
    </div>
  )
}

AssessmentResult.displayName = "AssessmentResult"