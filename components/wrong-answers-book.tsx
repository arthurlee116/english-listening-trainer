"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BilingualText } from "@/components/ui/bilingual-text"
import { ArrowLeft, Search, BookX, Lightbulb, Eye } from "lucide-react"
import { getHistory } from "@/lib/storage"
import { useBilingualText } from "@/hooks/use-bilingual-text"
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
  const { t } = useBilingualText()
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
        return t("components.wrongAnswersBook.questionTypes.multipleChoice")
      case "fill_blank":
        return t("components.wrongAnswersBook.questionTypes.fillBlank")
      case "short_answer":
        return t("components.wrongAnswersBook.questionTypes.shortAnswer")
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
            <h2 className="text-2xl font-bold">
              <BilingualText translationKey="components.wrongAnswersBook.title" />
            </h2>
            <Badge variant="outline">
              {t("components.wrongAnswersBook.wrongAnswersCount").replace('{count}', filteredAnswers.length.toString())}
            </Badge>
          </div>
        </div>
        
        {wrongAnswers.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                <BilingualText translationKey="components.wrongAnswersBook.reviewTip" />
              </span>
            </div>
          </div>
        )}
      </Card>

      {wrongAnswers.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <BookX className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              <BilingualText translationKey="components.wrongAnswersBook.noWrongAnswersTitle" />
            </h3>
            <p>
              <BilingualText translationKey="components.wrongAnswersBook.noWrongAnswersDescription" />
            </p>
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
                  placeholder={t("components.wrongAnswersBook.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.labels.difficulty")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <BilingualText translationKey="components.wrongAnswersBook.allDifficulties" />
                  </SelectItem>
                  <SelectItem value="A1">
                    <BilingualText translationKey="common.difficultyLevels.A1" />
                  </SelectItem>
                  <SelectItem value="A2">
                    <BilingualText translationKey="common.difficultyLevels.A2" />
                  </SelectItem>
                  <SelectItem value="B1">
                    <BilingualText translationKey="common.difficultyLevels.B1" />
                  </SelectItem>
                  <SelectItem value="B2">
                    <BilingualText translationKey="common.difficultyLevels.B2" />
                  </SelectItem>
                  <SelectItem value="C1">
                    <BilingualText translationKey="common.difficultyLevels.C1" />
                  </SelectItem>
                  <SelectItem value="C2">
                    <BilingualText translationKey="common.difficultyLevels.C2" />
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.labels.language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <BilingualText translationKey="components.wrongAnswersBook.allLanguages" />
                  </SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("components.questionInterface.questionType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <BilingualText translationKey="components.wrongAnswersBook.allTypes" />
                  </SelectItem>
                  <SelectItem value="multiple_choice">
                    <BilingualText translationKey="components.wrongAnswersBook.questionTypes.multipleChoice" />
                  </SelectItem>
                  <SelectItem value="fill_blank">
                    <BilingualText translationKey="components.wrongAnswersBook.questionTypes.fillBlank" />
                  </SelectItem>
                  <SelectItem value="short_answer">
                    <BilingualText translationKey="components.wrongAnswersBook.questionTypes.shortAnswer" />
                  </SelectItem>
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
                      <h4 className="font-medium mb-2">
                        {t("components.wrongAnswersBook.questionNumber").replace('{number}', (answer.questionIndex + 1).toString())}
                      </h4>
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
                        <h5 className="font-medium text-red-800 dark:text-red-300 mb-1">
                          <BilingualText translationKey="components.wrongAnswersBook.yourAnswer" />
                        </h5>
                        <p className="text-red-700 dark:text-red-200">
                          {answer.userAnswer || t("components.wrongAnswersBook.noAnswer")}
                        </p>
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <h5 className="font-medium text-green-800 dark:text-green-300 mb-1">
                          <BilingualText translationKey="components.wrongAnswersBook.correctAnswer" />
                        </h5>
                        <p className="text-green-700 dark:text-green-200">
                          {answer.correctAnswer}
                        </p>
                      </div>
                    </div>

                    {/* Explanation */}
                    {answer.explanation && (
                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                          <BilingualText translationKey="components.wrongAnswersBook.explanation" />
                        </h5>
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
                        <BilingualText 
                          translationKey={isExpanded ? "components.wrongAnswersBook.hideListeningMaterial" : "components.wrongAnswersBook.showListeningMaterial"} 
                        />
                      </Button>
                    </div>

                    {/* Transcript */}
                    {isExpanded && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">
                          <BilingualText translationKey="components.wrongAnswersBook.listeningMaterial" />
                        </h5>
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