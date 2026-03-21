"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExportService } from "@/lib/export-service"
import type { AIAnalysisResponse, WrongAnswerItem } from "@/lib/types"
import { AnalysisState } from "@/components/ai-analysis-card"
import type { BatchResult, QueueStatus } from "@/lib/concurrency-service"

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

const WRONG_ANSWERS_PAGE_SIZE = 100
const ANALYZE_BATCH_LIMIT = 100

const EMPTY_STATUS: QueueStatus = {
  pending: 0,
  active: 0,
  completed: 0,
  failed: 0,
  total: 0,
}

export function useWrongAnswersBook() {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([])
  const [filteredAnswers, setFilteredAnswers] = useState<WrongAnswerItem[]>([])
  const [filters, setFilters] = useState<WrongAnswerFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysisStates, setAnalysisStates] = useState<Map<string, AnalysisState>>(new Map())
  const [exporting, setExporting] = useState(false)
  const [batchState, setBatchState] = useState<{
    isProcessing: boolean
    progress: number
    status: QueueStatus
    results: BatchResult<AIAnalysisResponse, WrongAnswerItem> | null
    error: string | null
  }>({
    isProcessing: false,
    progress: 0,
    status: EMPTY_STATUS,
    results: null,
    error: null,
  })
  const batchAbortRef = useRef<AbortController | null>(null)
  const batchCancelledRef = useRef(false)

  const updateBatchState = useCallback((updates: Partial<typeof batchState>) => {
    setBatchState((prev) => ({ ...prev, ...updates }))
  }, [])

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
      params.append("limit", String(WRONG_ANSWERS_PAGE_SIZE))

      const allWrongAnswers: WrongAnswerItem[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        params.set("page", String(page))
        const response = await fetch(`/api/wrong-answers/list?${params.toString()}`)
        if (!response || typeof (response as Response).ok !== "boolean") {
          throw new Error("Invalid response from wrong answers API")
        }

        if (!response.ok) {
          throw new Error("Failed to fetch wrong answers")
        }

        const data: WrongAnswersResponse = await response.json()
        allWrongAnswers.push(...data.wrongAnswers)
        hasMore = Boolean(data.pagination?.hasMore)
        page += 1
      }

      setWrongAnswers(allWrongAnswers)
      setFilteredAnswers(allWrongAnswers)

      const newAnalysisStates = new Map<string, AnalysisState>()
      allWrongAnswers.forEach((item) => {
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

  const applyAnalysisResult = useCallback((answerId: string, analysisResult: AIAnalysisResponse) => {
    const generatedAt = new Date().toISOString()

    const applyUpdate = (items: WrongAnswerItem[]) =>
      items.map((item) =>
        item.answerId === answerId
          ? {
              ...item,
              answer: {
                ...item.answer,
                aiAnalysis: analysisResult,
                aiAnalysisGeneratedAt: generatedAt,
                needsAnalysis: false,
              },
            }
          : item,
      )

    setWrongAnswers((prev) => applyUpdate(prev))
    setFilteredAnswers((prev) => applyUpdate(prev))
    setAnalysisStates((prev) => new Map(prev).set(answerId, AnalysisState.SUCCESS))
  }, [])

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

      applyAnalysisResult(answerId, analysisResult)
    } catch (err) {
      console.error("Error generating AI analysis:", err)
      setAnalysisStates((prev) => new Map(prev).set(answerId, AnalysisState.ERROR))
    }
  }, [applyAnalysisResult, wrongAnswers])

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

  const restorePendingAnalysisStates = useCallback((items: WrongAnswerItem[]) => {
    setAnalysisStates((prev) => {
      const next = new Map(prev)
      items.forEach((item) => {
        if (next.get(item.answerId) === AnalysisState.LOADING) {
          next.set(item.answerId, AnalysisState.NOT_GENERATED)
        }
      })
      return next
    })
  }, [])

  const handleBatchAnalysis = useCallback(async () => {
    const itemsToAnalyze = itemsNeedingAnalysis
    if (itemsToAnalyze.length === 0) {
      return
    }

    setAnalysisStates((prev) => {
      const next = new Map(prev)
      itemsToAnalyze.forEach((item) => {
        next.set(item.answerId, AnalysisState.LOADING)
      })
      return next
    })

    batchCancelledRef.current = false
    const allSuccess: AIAnalysisResponse[] = []
    const allFailures: Array<{ item: WrongAnswerItem; error: string }> = []
    const total = itemsToAnalyze.length
    let completed = 0
    let failed = 0

    updateBatchState({
      isProcessing: true,
      progress: 0,
      error: null,
      results: null,
      status: {
        pending: total,
        active: 0,
        completed: 0,
        failed: 0,
        total,
      },
    })

    const chunks: WrongAnswerItem[][] = []
    for (let index = 0; index < itemsToAnalyze.length; index += ANALYZE_BATCH_LIMIT) {
      chunks.push(itemsToAnalyze.slice(index, index + ANALYZE_BATCH_LIMIT))
    }

    try {
      for (const chunk of chunks) {
        if (batchCancelledRef.current) {
          break
        }

        const controller = new AbortController()
        batchAbortRef.current = controller

        updateBatchState({
          status: {
            pending: total - completed - failed - chunk.length,
            active: chunk.length,
            completed,
            failed,
            total,
          },
        })

        const response = await fetch("/api/ai/wrong-answers/analyze-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ answerIds: chunk.map((item) => item.answerId) }),
          signal: controller.signal,
        })

        batchAbortRef.current = null

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = payload?.error || `Failed to generate AI analysis batch: ${response.statusText}`
          chunk.forEach((item) => {
            allFailures.push({ item, error: message })
            failed += 1
          })
          setAnalysisStates((prev) => {
            const next = new Map(prev)
            chunk.forEach((item) => next.set(item.answerId, AnalysisState.ERROR))
            return next
          })
          updateBatchState({
            status: {
              pending: total - completed - failed,
              active: 0,
              completed,
              failed,
              total,
            },
            progress: Math.round(((completed + failed) / total) * 100),
          })
          continue
        }

        const responseData = await response.json() as {
          success: Array<{ answerId: string; analysis: AIAnalysisResponse }>
          failed: Array<{ answerId: string; error: string }>
        }

        const itemsById = new Map(chunk.map((item) => [item.answerId, item]))

        responseData.success.forEach(({ answerId, analysis }) => {
          allSuccess.push(analysis)
          completed += 1
          applyAnalysisResult(answerId, analysis)
        })

        responseData.failed.forEach(({ answerId, error: message }) => {
          const item = itemsById.get(answerId)
          if (!item) return
          allFailures.push({ item, error: message })
          failed += 1
          setAnalysisStates((prev) => new Map(prev).set(answerId, AnalysisState.ERROR))
        })

        const handledIds = new Set([
          ...responseData.success.map(({ answerId }) => answerId),
          ...responseData.failed.map(({ answerId }) => answerId),
        ])

        chunk.forEach((item) => {
          if (handledIds.has(item.answerId)) return
          allFailures.push({ item, error: 'Missing batch analysis result' })
          failed += 1
          setAnalysisStates((prev) => new Map(prev).set(item.answerId, AnalysisState.ERROR))
        })

        updateBatchState({
          status: {
            pending: total - completed - failed,
            active: 0,
            completed,
            failed,
            total,
          },
          progress: Math.round(((completed + failed) / total) * 100),
        })
      }

      const wasCancelled = batchCancelledRef.current
      if (wasCancelled) {
        restorePendingAnalysisStates(itemsToAnalyze)
      }
      updateBatchState({
        isProcessing: false,
        progress: wasCancelled ? Math.round(((completed + failed) / total) * 100) : 100,
        results: {
          success: allSuccess,
          failed: allFailures,
          status: {
            pending: wasCancelled ? total - completed - failed : 0,
            active: 0,
            completed,
            failed,
            total,
          },
        },
        error: wasCancelled ? 'Processing cancelled by user' : null,
        status: {
          pending: wasCancelled ? total - completed - failed : 0,
          active: 0,
          completed,
          failed,
          total,
        },
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        restorePendingAnalysisStates(itemsToAnalyze)
        updateBatchState({
          isProcessing: false,
          error: 'Processing cancelled by user',
          status: {
            pending: total - completed - failed,
            active: 0,
            completed,
            failed,
            total,
          },
          progress: Math.round(((completed + failed) / total) * 100),
        })
      } else {
        console.error("Batch analysis failed:", err)
        const errorMessage = err instanceof Error ? err.message : "Batch analysis failed"
        restorePendingAnalysisStates(itemsToAnalyze)
        updateBatchState({
          isProcessing: false,
          error: errorMessage,
          status: {
            pending: total - completed - failed,
            active: 0,
            completed,
            failed,
            total,
          },
          progress: Math.round(((completed + failed) / total) * 100),
        })
      }
    } finally {
      batchAbortRef.current = null
      batchCancelledRef.current = false
    }
  }, [applyAnalysisResult, itemsNeedingAnalysis, restorePendingAnalysisStates, updateBatchState])

  const cancelProcessing = useCallback(() => {
    batchCancelledRef.current = true
    batchAbortRef.current?.abort()
  }, [])

  const resetBatchState = useCallback(() => {
    setBatchState({
      isProcessing: false,
      progress: 0,
      status: EMPTY_STATUS,
      results: null,
      error: null,
    })
  }, [])

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

  const concurrencyLabel = `Server batch: ${ANALYZE_BATCH_LIMIT} items/request`

  return {
    wrongAnswers,
    filteredAnswers,
    filters,
    setFilter,
    loading,
    error,
    refresh,
    analysisStates,
    batchProcessor: {
      ...batchState,
      cancelProcessing,
      resetState: resetBatchState,
    },
    itemsNeedingAnalysis,
    handleGenerateAnalysis,
    handleRetryAnalysis,
    handleBatchAnalysis,
    exporting,
    handleExport,
    concurrencyLabel,
  }
}
