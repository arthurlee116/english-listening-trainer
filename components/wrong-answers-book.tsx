"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { BilingualText } from "@/components/ui/bilingual-text"
import { ArrowLeft, Search, BookX, Lightbulb, Eye, Loader2, Zap, AlertTriangle, Download, X } from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { AIAnalysisCard, AnalysisState } from "@/components/ai-analysis-card"
import { ExportService } from "@/lib/export-service"
import { aiAnalysisConcurrency } from "@/lib/concurrency-service"
import { useBatchProcessing } from "@/hooks/use-batch-processing"
import type { AIAnalysisResponse, WrongAnswerItem } from "@/lib/types"

interface WrongAnswersResponse {
  wrongAnswers: WrongAnswerItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasMore: boolean
  }
}

interface WrongAnswersBookProps {
  onBack: () => void
}

export function WrongAnswersBook({ onBack }: WrongAnswersBookProps) {
  const { t } = useBilingualText()
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([])
  const [filteredAnswers, setFilteredAnswers] = useState<WrongAnswerItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysisStates, setAnalysisStates] = useState<Map<string, AnalysisState>>(new Map())
  const [exporting, setExporting] = useState(false)
  
  // Use the new batch processing hook
  const batchProcessor = useBatchProcessing(aiAnalysisConcurrency)

  const questionTotals = useMemo(() => {
    const counts = new Map<string, number>()
    filteredAnswers.forEach(item => {
      const key = item.questionId
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [filteredAnswers])

  // Fetch wrong answers from database API
  const fetchWrongAnswers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (difficultyFilter !== 'all') params.append('difficulty', difficultyFilter)
      if (languageFilter !== 'all') params.append('language', languageFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      params.append('limit', '100') // Get up to 100 items

      const response = await fetch(`/api/wrong-answers/list?${params.toString()}`)
      if (!response || typeof (response as Response).ok !== 'boolean') {
        throw new Error('Invalid response from wrong answers API')
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch wrong answers')
      }

      const data: WrongAnswersResponse = await response.json()
      setWrongAnswers(data.wrongAnswers)
      setFilteredAnswers(data.wrongAnswers)
      
      // Initialize analysis states
      const newAnalysisStates = new Map<string, AnalysisState>()
      data.wrongAnswers.forEach(item => {
        if (item.answer.aiAnalysis) {
          newAnalysisStates.set(item.answerId, AnalysisState.SUCCESS)
        } else {
          newAnalysisStates.set(item.answerId, AnalysisState.NOT_GENERATED)
        }
      })
      setAnalysisStates(newAnalysisStates)
    } catch (err) {
      console.error('Error fetching wrong answers:', err)
      setError(err instanceof Error ? err.message : 'Failed to load wrong answers')
    } finally {
      setLoading(false)
    }
  }

  // Refetch when filters change (with debounce for search)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchWrongAnswers()
    }, searchTerm ? 500 : 0) // Debounce search by 500ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm, difficultyFilter, languageFilter, typeFilter])

  // Handle AI analysis generation
  const handleGenerateAnalysis = async (answerId: string) => {
    try {
      // Find the corresponding wrong answer item
      const item = wrongAnswers.find(w => w.answerId === answerId)
      if (!item) return

      // Set loading state
      setAnalysisStates(prev => new Map(prev).set(answerId, AnalysisState.LOADING))

      // Prepare request data
      const requestData = {
        questionId: item.questionId,
        answerId: item.answerId,
        questionType: item.question.type,
        question: item.question.question,
        options: item.question.options,
        userAnswer: item.answer.userAnswer,
        correctAnswer: item.question.correctAnswer,
        transcript: item.question.transcript,
        exerciseTopic: item.session.topic,
        exerciseDifficulty: item.session.difficulty,
        language: item.session.language,
        attemptedAt: item.answer.attemptedAt
      }

      const response = await fetch('/api/ai/wrong-answers/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error('Failed to generate AI analysis')
      }

      const responseData = await response.json()
      
      // Extract the actual analysis from the response
      const analysisResult: AIAnalysisResponse = responseData.analysis
      
      // Validate that analysis was actually provided
      if (!analysisResult) {
        throw new Error('Missing analysis in API response')
      }

      // Update the wrong answer item with the new analysis
      setWrongAnswers(prev => prev.map(w => 
        w.answerId === answerId 
          ? { 
              ...w, 
              answer: { 
                ...w.answer, 
                aiAnalysis: analysisResult,
                aiAnalysisGeneratedAt: new Date().toISOString(),
                needsAnalysis: false
              }
            }
          : w
      ))

      setFilteredAnswers(prev => prev.map(w => 
        w.answerId === answerId 
          ? { 
              ...w, 
              answer: { 
                ...w.answer, 
                aiAnalysis: analysisResult,
                aiAnalysisGeneratedAt: new Date().toISOString(),
                needsAnalysis: false
              }
            }
          : w
      ))

      // Set success state
      setAnalysisStates(prev => new Map(prev).set(answerId, AnalysisState.SUCCESS))

    } catch (err) {
      console.error('Error generating AI analysis:', err)
      setAnalysisStates(prev => new Map(prev).set(answerId, AnalysisState.ERROR))
    }
  }

  // Handle retry analysis
  const handleRetryAnalysis = (answerId: string) => {
    handleGenerateAnalysis(answerId)
  }

  // Get items that need analysis
  const getItemsNeedingAnalysis = () => {
    return (filteredAnswers || []).filter(item => 
      !item.answer.aiAnalysis && 
      analysisStates.get(item.answerId) !== AnalysisState.LOADING
    )
  }

  // Handle batch analysis with concurrency control
  const handleBatchAnalysis = async () => {
    const itemsToAnalyze = getItemsNeedingAnalysis()
    
    if (itemsToAnalyze.length === 0) {
      return
    }

    // Set all items to loading state
    const newAnalysisStates = new Map(analysisStates)
    itemsToAnalyze.forEach(item => {
      newAnalysisStates.set(item.answerId, AnalysisState.LOADING)
    })
    setAnalysisStates(newAnalysisStates)

    try {
      // Process items using the concurrency service
      await batchProcessor.processBatch(
        itemsToAnalyze,
        async (item: WrongAnswerItem) => {
          const requestData = {
            questionId: item.questionId,
            answerId: item.answerId,
            questionType: item.question.type,
            question: item.question.question,
            options: item.question.options,
            userAnswer: item.answer.userAnswer,
            correctAnswer: item.question.correctAnswer,
            transcript: item.question.transcript,
            exerciseTopic: item.session.topic,
            exerciseDifficulty: item.session.difficulty,
            language: item.session.language,
            attemptedAt: item.answer.attemptedAt
          }

          const response = await fetch('/api/ai/wrong-answers/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
          })

          if (!response.ok) {
            throw new Error(`Failed to generate AI analysis: ${response.statusText}`)
          }

          const responseData = await response.json()
          
          // Extract the actual analysis from the response
          const analysisResult: AIAnalysisResponse = responseData.analysis
          
          // Validate that analysis was actually provided
          if (!analysisResult) {
            throw new Error('Missing analysis in API response')
          }

          // Update the item with analysis
          setWrongAnswers(prev => prev.map(w => 
            w.answerId === item.answerId 
              ? { 
                  ...w, 
                  answer: { 
                    ...w.answer, 
                    aiAnalysis: analysisResult,
                    aiAnalysisGeneratedAt: new Date().toISOString(),
                    needsAnalysis: false
                  }
                }
              : w
          ))

          setFilteredAnswers(prev => prev.map(w => 
            w.answerId === item.answerId 
              ? { 
                  ...w, 
                  answer: { 
                    ...w.answer, 
                    aiAnalysis: analysisResult,
                    aiAnalysisGeneratedAt: new Date().toISOString(),
                    needsAnalysis: false
                  }
                }
              : w
          ))

          // Set success state
          setAnalysisStates(prev => new Map(prev).set(item.answerId, AnalysisState.SUCCESS))

          return analysisResult
        },
        {
          onProgress: (status) => {
            // Progress is automatically handled by the hook
            console.log('Batch progress:', status)
          },
          onComplete: (results) => {
            console.log('Batch completed:', results)
            
            // Update failed items to error state
            results.failed.forEach(({ item }) => {
              const wrongAnswerItem = item as WrongAnswerItem
              setAnalysisStates(prev => new Map(prev).set(wrongAnswerItem.answerId, AnalysisState.ERROR))
            })
          },
          onError: (error) => {
            console.error('Batch processing error:', error)
            
            // Reset all loading states to not generated on error
            itemsToAnalyze.forEach(item => {
              setAnalysisStates(prev => new Map(prev).set(item.answerId, AnalysisState.NOT_GENERATED))
            })
          }
        }
      )
    } catch (error) {
      console.error('Batch analysis failed:', error)
    }
  }

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
      case "single":
        return t("components.wrongAnswersBook.questionTypes.multipleChoice")
      case "short":
        return t("components.wrongAnswersBook.questionTypes.shortAnswer")
      default:
        return type
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "multiple_choice":
      case "single":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "fill_blank":
        return "bg-green-100 text-green-800 border-green-300"
      case "short_answer":
      case "short":
        return "bg-purple-100 text-purple-800 border-purple-300"
      default:
        return "bg-gray-100 text-gray-800 border-emphasis-light"
    }
  }

  // Handle export to TXT
  const handleExport = async () => {
    try {
      setExporting(true)
      
      // Generate export content
      const exportContent = await ExportService.exportToTXT(filteredAnswers || [], {
        includeTranscript: true,
        includeTimestamps: true,
        format: 'detailed'
      })
      
      // Trigger download
      ExportService.downloadFile(exportContent)
      
      // Show success feedback (could add toast notification here)
      console.log('Export completed successfully')
      
    } catch (err) {
      console.error('Error exporting wrong answers:', err)
      // Could add error toast notification here
    } finally {
      setExporting(false)
    }
  }

  const concurrencyStatus = aiAnalysisConcurrency?.getStatus?.()
  const defaultConcurrencyLabel = '10 max concurrent'
  const concurrencyLabel = concurrencyStatus && typeof concurrencyStatus.total === 'number'
    ? (concurrencyStatus.total > 0
        ? `${concurrencyStatus.active}/${concurrencyStatus.total} active`
        : defaultConcurrencyLabel)
    : defaultConcurrencyLabel

  const questionRenderCounts = new Map<string, number>()

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
              {(typeof t("components.wrongAnswersBook.wrongAnswersCount") === 'string'
                ? t("components.wrongAnswersBook.wrongAnswersCount").replace('{count}', (filteredAnswers?.length || 0).toString())
                : `${filteredAnswers?.length || 0} wrong answers`)
              }
            </Badge>
          </div>
        </div>
        
        {(wrongAnswers?.length || 0) > 0 && (
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

      {loading ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium mb-2">
              <BilingualText translationKey="common.loading" />
            </h3>
            <p>
              <BilingualText translationKey="components.wrongAnswersBook.loadingWrongAnswers" />
            </p>
          </div>
        </Card>
      ) : error ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-red-500 dark:text-red-400">
            <BookX className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              <BilingualText translationKey="common.error" />
            </h3>
            <p className="mb-4">{error}</p>
            <Button onClick={fetchWrongAnswers} variant="outline">
              <BilingualText translationKey="common.retry" />
            </Button>
          </div>
        </Card>
      ) : (wrongAnswers?.length || 0) === 0 ? (
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

          {/* Batch Analysis Toolbar */}
          <Card className="glass-effect p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {t("components.wrongAnswersBook.batchAnalysis.itemsNeedingAnalysis").replace('{count}', getItemsNeedingAnalysis().length.toString())}
                </div>

                {batchProcessor.isProcessing && (
                  <div className="flex items-center gap-2">
                    <Progress value={batchProcessor.progress} className="w-32" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {batchProcessor.status.completed + batchProcessor.status.failed}/{batchProcessor.status.total}
                    </span>
                    <div className="text-xs text-gray-500">
                      Active: {batchProcessor.status.active}
                    </div>
                  </div>
                )}

                {batchProcessor.results && (
                  <div className="text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      {t("components.wrongAnswersBook.batchAnalysis.successCount").replace('{count}', batchProcessor.results.success.length.toString())}
                    </span>
                    {batchProcessor.results.failed.length > 0 && (
                      <span className="text-red-600 dark:text-red-400 ml-2">
                        {t("components.wrongAnswersBook.batchAnalysis.failedCount").replace('{count}', batchProcessor.results.failed.length.toString())}
                      </span>
                    )}
                  </div>
                )}

                {batchProcessor.error && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Error: {batchProcessor.error}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {getItemsNeedingAnalysis().length > 0 && !batchProcessor.isProcessing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        disabled={batchProcessor.isProcessing}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.generateAll" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.confirmTitle" />
                          </div>
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2">
                            <p>
                              {t("components.wrongAnswersBook.batchAnalysis.confirmDescription").replace('{count}', getItemsNeedingAnalysis().length.toString())}
                            </p>
                            <p className="text-sm text-orange-600 dark:text-orange-400">
                              <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.processingWarning" />
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              Concurrency limit: {concurrencyLabel}
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          <BilingualText translationKey="common.buttons.cancel" />
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleBatchAnalysis}>
                          <Zap className="w-4 h-4 mr-2" />
                          <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.startProcessing" />
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {batchProcessor.isProcessing && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={batchProcessor.cancelProcessing}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Processing
                  </Button>
                )}

                {batchProcessor.results && batchProcessor.results.failed.length > 0 && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      batchProcessor.results?.failed.forEach(({ item }) => {
                        const wrongAnswerItem = item as WrongAnswerItem
                        handleRetryAnalysis(wrongAnswerItem.answerId)
                      })
                      batchProcessor.resetState()
                    }}
                  >
                    <BilingualText translationKey="components.wrongAnswersBook.batchAnalysis.retryFailed" />
                  </Button>
                )}

                {/* Export Button */}
                <Button 
                  variant="outline"
                  onClick={handleExport}
                  disabled={exporting || (filteredAnswers?.length || 0) === 0}
                  className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white border-0"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  <BilingualText translationKey="components.wrongAnswersBook.export.exportAsTxt" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Wrong Answers List */}
          <div className="grid gap-4">
            {(filteredAnswers || []).map((item) => {
              const cardId = `${item.answerId}`
              const isExpanded = expandedCards.has(cardId)
              const date = new Date(item.session.createdAt)
              const questionKey = item.questionId
              const currentCount = (questionRenderCounts.get(questionKey) ?? 0) + 1
              questionRenderCounts.set(questionKey, currentCount)
              const totalForQuestion = questionTotals.get(questionKey) ?? 1
              const questionText = totalForQuestion > 1 && currentCount > 1
                ? `${item.question.question} (Attempt ${currentCount})`
                : item.question.question

              return (
                <Card key={cardId} className="glass-effect p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.session.topic}</Badge>
                        <Badge variant="outline">{item.session.difficulty}</Badge>
                        <Badge variant="outline">{item.session.language}</Badge>
                        <Badge className={getTypeBadgeColor(item.question.type)}>
                          {getTypeLabel(item.question.type)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        {date.toLocaleDateString('zh-CN')}
                      </div>
                    </div>

                    {/* Question */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">
                        {t("components.wrongAnswersBook.questionNumber").replace('{number}', (item.question.index + 1).toString())}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">{questionText}</p>
                      
                      {item.question.options && (item.question.type === "multiple_choice" || item.question.type === "single") && (
                        <div className="mt-2 space-y-1">
                          {item.question.options.map((option, idx) => (
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
                          {item.answer.userAnswer || t("components.wrongAnswersBook.noAnswer")}
                        </p>
                      </div>
                      
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <h5 className="font-medium text-green-800 dark:text-green-300 mb-1">
                          <BilingualText translationKey="components.wrongAnswersBook.correctAnswer" />
                        </h5>
                        <p className="text-green-700 dark:text-green-200">
                          {item.question.correctAnswer}
                        </p>
                      </div>
                    </div>

                    {/* Explanation */}
                    {item.question.explanation && (
                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                          <BilingualText translationKey="components.wrongAnswersBook.explanation" />
                        </h5>
                        <p className="text-blue-700 dark:text-blue-200">
                          {item.question.explanation}
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

                    {/* AI Analysis Card */}
                    <AIAnalysisCard
                      answerId={item.answerId}
                      analysis={item.answer.aiAnalysis}
                      state={analysisStates.get(item.answerId) || AnalysisState.NOT_GENERATED}
                      onGenerate={handleGenerateAnalysis}
                      onRetry={handleRetryAnalysis}
                    />

                    {/* Transcript */}
                    {isExpanded && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h5 className="font-medium mb-2">
                          <BilingualText translationKey="components.wrongAnswersBook.listeningMaterial" />
                        </h5>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                          {item.question.transcript}
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
