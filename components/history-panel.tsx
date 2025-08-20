"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Trash2, Calendar, BookPlus, Loader2 } from "lucide-react"
import { getHistory, clearHistory } from "@/lib/storage"
import { exportToTxt } from "@/lib/export"
import type { Exercise } from "@/lib/types"

interface HistoryPanelProps {
  onBack: () => void
  onRestore?: (exercise: Exercise) => void
}

export function HistoryPanel({ onBack, onRestore }: HistoryPanelProps) {
  const [history, setHistory] = useState<Exercise[]>([])
  const [collectingWrongAnswers, setCollectingWrongAnswers] = useState<boolean>(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      // 首先尝试从数据库获取历史记录
      const invitationCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
      
      if (invitationCode) {
        const response = await fetch(`/api/exercises/history?code=${encodeURIComponent(invitationCode)}&limit=20`)
        if (response.ok) {
          const data = await response.json()
          setHistory(data.history)
          return
        }
      }
      
      // 如果数据库获取失败，则从本地存储获取
      setHistory(getHistory())
    } catch (error) {
      console.error('Failed to load history from database:', error)
      // 回退到本地存储
      setHistory(getHistory())
    }
  }

  const handleExport = (exercise: Exercise) => {
    exportToTxt(exercise)
  }

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      clearHistory()
      setHistory([])
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const calculateScore = (exercise: Exercise) => {
    const singleChoiceResults = exercise.results.filter((r) => r.type === "single")
    const shortAnswerResults = exercise.results.filter((r) => r.type === "short")

    const correctCount = singleChoiceResults.filter((r) => r.is_correct).length
    const totalSingleChoice = singleChoiceResults.length
    const shortAnswerScore = shortAnswerResults[0]?.score || 0

    return Math.round(((correctCount / totalSingleChoice) * 0.7 + (shortAnswerScore / 10) * 0.3) * 100)
  }

  // 批量收集历史记录中的错题
  const handleCollectWrongAnswers = async () => {
    if (history.length === 0) {
      alert('没有历史记录可以处理')
      return
    }

    if (!confirm(`确定要收集所有 ${history.length} 条历史记录中的错题吗？这可能需要一些时间来重新分析和生成标签。`)) {
      return
    }

    try {
      setCollectingWrongAnswers(true)
      const invitationCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
      
      if (!invitationCode) {
        alert('无法获取邀请码，请重新登录')
        return
      }

      const response = await fetch('/api/wrong-answers/collect-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationCode,
          exercises: history
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert(`成功处理 ${data.processedCount} 条记录，收集了 ${data.wrongAnswersCount} 个错题！`)
      } else {
        alert('收集错题失败: ' + data.error)
      }
    } catch (error) {
      console.error('收集错题过程中发生错误:', error)
      alert('收集错题失败，请稍后重试')
    } finally {
      setCollectingWrongAnswers(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-effect p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onBack} className="glass-effect bg-transparent">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold">Practice History</h2>
          </div>
          {history.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCollectWrongAnswers}
                disabled={collectingWrongAnswers}
                className="text-orange-600 border-orange-300 hover:bg-orange-50 bg-transparent"
              >
                {collectingWrongAnswers ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BookPlus className="w-4 h-4 mr-2" />
                )}
                {collectingWrongAnswers ? '处理中...' : '收集错题'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                className="text-red-600 border-red-300 hover:bg-red-50 bg-transparent"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}
        </div>
      </Card>

      {history.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Calendar className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-gray-600 mb-2">No Practice History</h3>
          <p className="text-gray-500">Complete some exercises to see your history here</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((exercise) => (
            <Card key={exercise.id} className="glass-effect p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200" 
                  onClick={() => onRestore?.(exercise)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{exercise.difficulty}</Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Score: {calculateScore(exercise)}%
                    </Badge>
                  </div>
                  <h3 className="font-medium mb-2">{exercise.topic}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{exercise.transcript.substring(0, 150)}...</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(exercise.createdAt)}
                    </span>
                    <span>{exercise.questions.length} questions</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Click to view results</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExport(exercise)
                  }}
                  className="glass-effect ml-4"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
