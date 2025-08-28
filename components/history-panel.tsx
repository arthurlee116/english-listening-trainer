"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Calendar, Trophy, Eye, Trash2, Filter } from "lucide-react"
import { getHistory, clearHistory } from "@/lib/storage"
import type { Exercise } from "@/lib/types"

interface HistoryPanelProps {
  onBack: () => void
  onRestore: (exercise: Exercise) => void
}

export function HistoryPanel({ onBack, onRestore }: HistoryPanelProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")

  useEffect(() => {
    const history = getHistory()
    setExercises(history)
    setFilteredExercises(history)
  }, [])

  useEffect(() => {
    let filtered = [...exercises]

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.topic.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 难度过滤
    if (difficultyFilter !== "all") {
      filtered = filtered.filter(exercise => exercise.difficulty === difficultyFilter)
    }

    // 语言过滤
    if (languageFilter !== "all") {
      filtered = filtered.filter(exercise => exercise.language === languageFilter)
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "score_high":
          const aScore = Math.round((a.results.filter(r => r.is_correct).length / a.results.length) * 100)
          const bScore = Math.round((b.results.filter(r => r.is_correct).length / b.results.length) * 100)
          return bScore - aScore
        case "score_low":
          const aScoreLow = Math.round((a.results.filter(r => r.is_correct).length / a.results.length) * 100)
          const bScoreLow = Math.round((b.results.filter(r => r.is_correct).length / b.results.length) * 100)
          return aScoreLow - bScoreLow
        default:
          return 0
      }
    })

    setFilteredExercises(filtered)
  }, [exercises, searchTerm, difficultyFilter, languageFilter, sortBy])

  const handleClearHistory = () => {
    if (window.confirm("确定要清空所有练习历史吗？此操作不可撤销。")) {
      clearHistory()
      setExercises([])
      setFilteredExercises([])
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800 border-green-300"
    if (score >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-red-100 text-red-800 border-red-300"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-effect p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold">练习历史</h2>
            <Badge variant="outline">{filteredExercises.length} 条记录</Badge>
          </div>
          
          {exercises.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleClearHistory}>
              <Trash2 className="w-4 h-4 mr-2" />
              清空历史
            </Button>
          )}
        </div>
      </Card>

      {exercises.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">暂无练习记录</h3>
            <p>完成练习后，记录将显示在这里</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card className="glass-effect p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索话题..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="难度级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有难度</SelectItem>
                  <SelectItem value="A1">A1 - Beginner</SelectItem>
                  <SelectItem value="A2">A2 - Elementary</SelectItem>
                  <SelectItem value="B1">B1 - Intermediate</SelectItem>
                  <SelectItem value="B2">B2 - Upper Intermediate</SelectItem>
                  <SelectItem value="C1">C1 - Advanced</SelectItem>
                  <SelectItem value="C2">C2 - Proficient</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有语言</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新优先</SelectItem>
                  <SelectItem value="oldest">最旧优先</SelectItem>
                  <SelectItem value="score_high">得分从高到低</SelectItem>
                  <SelectItem value="score_low">得分从低到高</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Exercise List */}
          <div className="grid gap-4">
            {filteredExercises.map((exercise, index) => {
              const correctAnswers = exercise.results.filter(result => result.is_correct).length
              const totalQuestions = exercise.results.length
              const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
              const date = new Date(exercise.createdAt)

              return (
                <Card key={exercise.id} className="glass-effect p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold truncate">{exercise.topic}</h3>
                        <Badge variant="outline">{exercise.difficulty}</Badge>
                        <Badge variant="outline">{exercise.language}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {date.toLocaleDateString('zh-CN')} {date.toLocaleTimeString('zh-CN', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          <span className={getScoreColor(accuracy)}>{accuracy}%</span>
                        </div>
                        <Badge className={getScoreBadgeColor(accuracy)}>
                          {correctAnswers}/{totalQuestions} 正确
                        </Badge>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => onRestore(exercise)}
                      className="ml-4"
                      size="sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      查看详情
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}