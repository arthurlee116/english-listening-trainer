"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useBatchProcessing } from "@/hooks/use-batch-processing"
import { aiAnalysisConcurrency } from "@/lib/concurrency-service"
import { ExportService } from "@/lib/export-service"
import type { AIAnalysisResponse, WrongAnswerItem } from "@/lib/types"
import { AnalysisState } from "@/components/ai-analysis-card"

interface WrongAnswersResponse {
  wrongAnswers: WrongAnswerItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasMore: boolean
  }
}

export interface WrongAnswerFilters {
  searchTerm: string
  difficulty: string
  language: string
  type: string
}

const DEFAULT_FILTERS: WrongAnswerFilters = {
  searchTerm: "",
  difficulty: "all",
  language: "all",
  type: "all",
}

export function useWrongAnswersBook() {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([])
  const [filteredAnswers, setFilteredAnswers] = useState<WrongAnswerItem[]>([])
  const [filters, setFilters] = useState<WrongAnswerFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysisStates, setAnalysisStates] = useState<Map<string, AnalysisState>>(new Map())
  const [exporting, setExporting] = useState(false)

  const batchProcessor = useBatchProcessing(aiAnalysisConcurrency)

  const setFilter = useCallback(<K extends keyof WrongAnswerFilters>(key: K, value: WrongAnswerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters.searchTerm) params.append("search", filters.searchTerm)
      if (filters.difficulty !== "all") params.append("difficulty", filters.difficulty)
      if (filters.language !== "all") params.append("language", filters.language)
      if (filters.type !== "all") params.append("type", filters.type)
      params.append("limit", "100")

      const response = await fetch(`/api/wrong-answers/list?${params.toString()}`)
      if (!response || typeof (response as Response).ok !== "boolean") {
        throw new Error("Invalid response from wrong answers API")
      }

      if (!response.ok) {
        throw new Error("Failed to fetch wrong answers")
      }

      const data: WrongAnswersResponse = await response.json()
      setWrongAnswers(data.wrongAnswers)
      setFilteredAnswers(data.wrongAnswers)

      const newAnalysisStates = new Map<string, AnalysisState>()
      data.wrongAnswers.forEach((item) => {
        if (item.answer.aiAnalysis) {
          newAnalysisStates.set(item.answerId, AnalysisState.SUCCESS)
        } else {
          newAnalysisStates.set(item.answerId, AnalysisState.NOT_GENERATED)
        }
      })
      setAnalysisStates(newAnalysisStates)
    } catch (err) {
      console.error("Error fetching wrong answers:", err)
      setError(err instanceof Error ? err.message : "Failed to load wrong answers")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      refresh()
    }, filters.searchTerm ? 500 : 0)

    return () => clearTimeout(timeoutId)
  }, [filters.searchTerm, filters.difficulty, filters.language, filters.type, refresh])

  const handleGenerateAnalysis = useCallback(async (answerId: string) => {
    const item = wrongAnswers.find((w) => w.answerId === answerId)
    if (!item) return

    try {
      setAnalysisStates((prev) => new Map(prev).set(answerId, AnalysisState.LOADING))

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
        attemptedAt: item.answer.attemptedAt,
      }

      const response = await fetch("/api/ai/wrong-answers/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error("Failed to generate AI analysis")
      }

      const responseData = await response.json()
      const analysisResult: AIAnalysisResponse = responseData.analysis

      if (!analysisResult) {
        throw new Error("Missing analysis in API response")
      }

      setWrongAnswers((prev) =>
        prev.map((w) =>
          w.answerId === answerId
            ? {
                ...w,
                answer: {
                  ...w.answer,
                  aiAnalysis: analysisResult,
                  aiAnalysisGeneratedAt: new Date().toISOString(),
                  needsAnalysis: false,
                },
              }
            : w,
        ),
      )

      setFilteredAnswers((prev) =>
        prev.map((w) =>
          w.answerId === answerId
            ? {
                ...w,
                answer: {
                  ...w.answer,
                  aiAnalysis: analysisResult,
                  aiAnalysisGeneratedAt: new Date().toISOString(),
                  needsAnalysis: false,
                },
              }
            : w,
        ),
      )

      setAnalysisStates((prev) => new Map(prev).set(answerId, AnalysisState.SUCCESS))
    } catch (err) {
      console.error("Error generating AI analysis:", err)
      setAnalysisStates((prev) => new Map(prev).set(answerId, AnalysisState.ERROR))
    }
  }, [wrongAnswers])

  const handleRetryAnalysis = useCallback((answerId: string) => {
    handleGenerateAnalysis(answerId)
  }, [handleGenerateAnalysis])

  const itemsNeedingAnalysis = useMemo(
    () =>
      (filteredAnswers || []).filter(
        (item) => !item.answer.aiAnalysis && analysisStates.get(item.answerId) !== AnalysisState.LOADING,
      ),
    [analysisStates, filteredAnswers],
  )

  const handleBatchAnalysis = useCallback(async () => {
    const itemsToAnalyze = itemsNeedingAnalysis
    if (itemsToAnalyze.length === 0) {
      return
    }

    const newAnalysisStates = new Map(analysisStates)
    itemsToAnalyze.forEach((item) => {
      newAnalysisStates.set(item.answerId, AnalysisState.LOADING)
    })
    setAnalysisStates(newAnalysisStates)

    try {
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
            attemptedAt: item.answer.attemptedAt,
          }

          const response = await fetch("/api/ai/wrong-answers/analyze", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          })

          if (!response.ok) {
            throw new Error(`Failed to generate AI analysis: ${response.statusText}`)
          }

          const responseData = await response.json()
          const analysisResult: AIAnalysisResponse = responseData.analysis

          if (!analysisResult) {
            throw new Error("Missing analysis in API response")
          }

          setWrongAnswers((prev) =>
            prev.map((w) =>
              w.answerId === item.answerId
                ? {
                    ...w,
                    answer: {
                      ...w.answer,
                      aiAnalysis: analysisResult,
                      aiAnalysisGeneratedAt: new Date().toISOString(),
                      needsAnalysis: false,
                    },
                  }
                : w,
            ),
          )

          setFilteredAnswers((prev) =>
            prev.map((w) =>
              w.answerId === item.answerId
                ? {
                    ...w,
                    answer: {
                      ...w.answer,
                      aiAnalysis: analysisResult,
                      aiAnalysisGeneratedAt: new Date().toISOString(),
                      needsAnalysis: false,
                    },
                  }
                : w,
            ),
          )

          setAnalysisStates((prev) => new Map(prev).set(item.answerId, AnalysisState.SUCCESS))

          return analysisResult
        },
        {
          onProgress: (status) => {
            console.log("Batch progress:", status)
          },
          onComplete: (results) => {
            results.failed.forEach(({ item }) => {
              const wrongAnswerItem = item as WrongAnswerItem
              setAnalysisStates((prev) => new Map(prev).set(wrongAnswerItem.answerId, AnalysisState.ERROR))
            })
          },
          onError: (batchError) => {
            console.error("Batch processing error:", batchError)
            itemsToAnalyze.forEach((item) => {
              setAnalysisStates((prev) => new Map(prev).set(item.answerId, AnalysisState.NOT_GENERATED))
            })
          },
        },
      )
    } catch (err) {
      console.error("Batch analysis failed:", err)
    }
  }, [analysisStates, batchProcessor, itemsNeedingAnalysis])

  const handleExport = useCallback(async () => {
    try {
      setExporting(true)
      const exportContent = await ExportService.exportToTXT(filteredAnswers || [], {
        includeTranscript: true,
        includeTimestamps: true,
        format: "detailed",
      })
      ExportService.downloadFile(exportContent)
    } catch (err) {
      console.error("Error exporting wrong answers:", err)
    } finally {
      setExporting(false)
    }
  }, [filteredAnswers])

  const concurrencyStatus = aiAnalysisConcurrency?.getStatus?.()
  const defaultConcurrencyLabel = "10 max concurrent"
  const concurrencyLabel =
    concurrencyStatus && typeof concurrencyStatus.total === "number"
      ? concurrencyStatus.total > 0
        ? `${concurrencyStatus.active}/${concurrencyStatus.total} active`
        : defaultConcurrencyLabel
      : defaultConcurrencyLabel

  return {
    wrongAnswers,
    filteredAnswers,
    filters,
    setFilter,
    loading,
    error,
    refresh,
    analysisStates,
    batchProcessor,
    itemsNeedingAnalysis,
    handleGenerateAnalysis,
    handleRetryAnalysis,
    handleBatchAnalysis,
    exporting,
    handleExport,
    concurrencyLabel,
  }
}
