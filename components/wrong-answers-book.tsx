"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, BookX, Lightbulb, Eye } from "lucide-react"
import { getHistory } from "@/lib/storage"
import type { Exercise } from "@/lib/types"

interface WrongAnswer {
  exerciseId: string
  exerciseTopic: string
  exerciseDifficulty: string
  exerciseLanguage: string
  exerciseDate: string
  questionIndex: number
  question: string
  questionType: string
  options?: string[] | null
  userAnswer: string
  correctAnswer: string
  explanation?: string
  transcript: string
}

interface WrongAnswersBookProps {
  onBack: () => void
}

export function WrongAnswersBook({ onBack }: WrongAnswersBookProps) {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])
  const [filteredAnswers, setFilteredAnswers] = useState<WrongAnswer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    const history: Exercise[] = getHistory()
    const allWrongAnswers: WrongAnswer[] = []

    history.forEach(exercise => {
      exercise.results.forEach((result, index) => {
        if (!result.is_correct) {
          const question = exercise.questions[index]
          const userAnswer = exercise.answers[index] || ""
          
          allWrongAnswers.push({
            exerciseId: exercise.id,
            exerciseTopic: exercise.topic,
            exerciseDifficulty: exercise.difficulty,
            exerciseLanguage: exercise.language,
            exerciseDate: exercise.createdAt,
            questionIndex: index,
            question: question.question,
            questionType: question.type,
            options: question.options,
            userAnswer,
            correctAnswer: result.correct_answer || "",
            explanation: question.explanation,
            transcript: exercise.transcript
          })
        }
      })
    })

    // 按日期倒序排列
    allWrongAnswers.sort((a, b) => 
      new Date(b.exerciseDate).getTime() - new Date(a.exerciseDate).getTime()
    )

    setWrongAnswers(allWrongAnswers)
    setFilteredAnswers(allWrongAnswers)
  }, [])

  useEffect(() => {
    let filtered = [...wrongAnswers]

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(answer =>
        answer.exerciseTopic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        answer.question.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 难度过滤
    if (difficultyFilter !== "all") {
      filtered = filtered.filter(answer => answer.exerciseDifficulty === difficultyFilter)
    }

    // 语言过滤
    if (languageFilter !== "all") {
      filtered = filtered.filter(answer => answer.exerciseLanguage === languageFilter)
    }

    // 题目类型过滤
    if (typeFilter !== "all") {
      filtered = filtered.filter(answer => answer.questionType === typeFilter)
    }

    setFilteredAnswers(filtered)
  }, [wrongAnswers, searchTerm, difficultyFilter, languageFilter, typeFilter])

  const toggleExpanded = (cardId: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId)
    } else {
      newExpanded.add(cardId)
    }
    setExpandedCards(newExpanded)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "multiple_choice":
        return "单选题"
      case "fill_blank":
        return "填空题"
      case "short_answer":
        return "简答题"
      default:
        return type
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "multiple_choice":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "fill_blank":
        return "bg-green-100 text-green-800 border-green-300"
      case "short_answer":
        return "bg-purple-100 text-purple-800 border-purple-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
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
            <h2 className="text-2xl font-bold">错题本</h2>
            <Badge variant="outline">{filteredAnswers.length} 道错题</Badge>
          </div>
        </div>
        
        {wrongAnswers.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                复习错题可以帮助您巩固知识点，提高学习效果
              </span>
            </div>
          </div>
        )}
      </Card>

      {wrongAnswers.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <BookX className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">暂无错题记录</h3>
            <p>完成练习后，答错的题目将收录在这里</p>
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
                  placeholder="搜索题目或话题..."
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
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="题目类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有类型</SelectItem>
                  <SelectItem value="multiple_choice">单选题</SelectItem>
                  <SelectItem value="fill_blank">填空题</SelectItem>
                  <SelectItem value="short_answer">简答题</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Wrong Answers List */}
          <div className="grid gap-4">
            {filteredAnswers.map((answer, _index) => {
              const cardId = `${answer.exerciseId}-${answer.questionIndex}`
              const isExpanded = expandedCards.has(cardId)
              const date = new Date(answer.exerciseDate)

              return (
                <Card key={cardId} className="glass-effect p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{answer.exerciseTopic}</Badge>
                        <Badge variant="outline">{answer.exerciseDifficulty}</Badge>
                        <Badge variant="outline">{answer.exerciseLanguage}</Badge>
                        <Badge className={getTypeBadgeColor(answer.questionType)}>
                          {getTypeLabel(answer.questionType)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        {date.toLocaleDateString('zh-CN')}
                      </div>
                    </div>

                    {/* Question */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">题目 {answer.questionIndex + 1}</h4>
                      <p className="text-gray-700 dark:text-gray-300">{answer.question}</p>
                      
                      {answer.options && answer.questionType === "multiple_choice" && (
                        <div className="mt-2 space-y-1">
                          {answer.options.map((option, idx) => (
                            <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                              {String.fromCharCode(65 + idx)}. {option}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Answers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                        <h5 className="font-medium text-red-800 dark:text-red-300 mb-1">您的答案</h5>
                        <p className="text-red-700 dark:text-red-200">
                          {answer.userAnswer || "未回答"}
                        </p>
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <h5 className="font-medium text-green-800 dark:text-green-300 mb-1">正确答案</h5>
                        <p className="text-green-700 dark:text-green-200">
                          {answer.correctAnswer}
                        </p>
                      </div>
                    </div>

                    {/* Explanation */}
                    {answer.explanation && (
                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-1">解析</h5>
                        <p className="text-blue-700 dark:text-blue-200">
                          {answer.explanation}
                        </p>
                      </div>
                    )}

                    {/* Toggle for transcript */}
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(cardId)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {isExpanded ? "隐藏" : "查看"}听力材料
                      </Button>
                    </div>

                    {/* Transcript */}
                    {isExpanded && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">听力材料</h5>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {answer.transcript}
                        </p>
                      </div>
                    )}
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