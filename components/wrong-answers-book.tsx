"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BilingualText } from "@/components/ui/bilingual-text"
import { ArrowLeft, Lightbulb, BookX, Loader2 } from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { useWrongAnswersBook } from "@/hooks/use-wrong-answers-book"
import WrongAnswersFilterBar from "@/components/wrong-answers/WrongAnswersFilterBar"
import BatchAnalysisToolbar from "@/components/wrong-answers/BatchAnalysisToolbar"
import WrongAnswerCard from "@/components/wrong-answers/WrongAnswerCard"
import { AnalysisState } from "@/components/ai-analysis-card"

interface WrongAnswersBookProps {
  onBack: () => void
}

export function WrongAnswersBook({ onBack }: WrongAnswersBookProps) {
  const { t } = useBilingualText()
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const {
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
  } = useWrongAnswersBook()

  const questionTotals = useMemo(() => {
    const counts = new Map<string, number>()
    filteredAnswers.forEach((item) => {
      const key = item.questionId
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [filteredAnswers])

  const toggleExpanded = (cardId: string) => {
    const next = new Set(expandedCards)
    if (next.has(cardId)) {
      next.delete(cardId)
    } else {
      next.add(cardId)
    }
    setExpandedCards(next)
  }

  const handleRetryFailed = () => {
    batchProcessor.results?.failed.forEach(({ item }) => {
      const wrongAnswerItem = item as { answerId: string }
      handleRetryAnalysis(wrongAnswerItem.answerId)
    })
    batchProcessor.resetState()
  }

  const isEmpty = (wrongAnswers?.length || 0) === 0
  const itemsNeedingAnalysisCount = itemsNeedingAnalysis.length
  const questionRenderCounts = new Map<string, number>()

  return (
    <div className="space-y-6">
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
              {typeof t("components.wrongAnswersBook.wrongAnswersCount") === "string"
                ? t("components.wrongAnswersBook.wrongAnswersCount", {
                    values: { count: filteredAnswers?.length || 0 },
                  })
                : `${filteredAnswers?.length || 0} wrong answers`}
            </Badge>
          </div>
        </div>

        {(wrongAnswers?.length || 0) > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                <BilingualText translationKey="components.wrongAnswersBook.reviewTip" />
              </span>
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500">
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
          <div className="text-red-500">
            <BookX className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              <BilingualText translationKey="common.error" />
            </h3>
            <p className="mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              <BilingualText translationKey="common.retry" />
            </Button>
          </div>
        </Card>
      ) : isEmpty ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500">
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
          <Card className="glass-effect p-4">
            <WrongAnswersFilterBar
              filters={filters}
              onChange={setFilter}
              searchPlaceholder={t("components.wrongAnswersBook.searchPlaceholder") as string}
            />
          </Card>

          <Card className="glass-effect p-4">
            <BatchAnalysisToolbar
              itemsNeedingAnalysisCount={itemsNeedingAnalysisCount}
              batchStatus={batchProcessor.status}
              batchResult={batchProcessor.results}
              error={batchProcessor.error}
              isProcessing={batchProcessor.isProcessing}
              progress={batchProcessor.progress}
              onStartBatch={handleBatchAnalysis}
              onCancel={batchProcessor.cancelProcessing}
              onRetryFailed={handleRetryFailed}
              concurrencyLabel={concurrencyLabel}
              onExport={handleExport}
              exporting={exporting}
              isExportDisabled={(filteredAnswers?.length || 0) === 0}
            />
          </Card>

          <div className="grid gap-4">
            {(filteredAnswers || []).map((item) => {
              const cardId = `${item.answerId}`
              const isExpanded = expandedCards.has(cardId)
              const date = new Date(item.session.createdAt)
              const questionKey = item.questionId
              const currentCount = (questionRenderCounts.get(questionKey) ?? 0) + 1
              questionRenderCounts.set(questionKey, currentCount)
              const totalForQuestion = questionTotals.get(questionKey) ?? 1
              const questionText =
                totalForQuestion > 1 && currentCount > 1
                  ? `${item.question.question} (Attempt ${currentCount})`
                  : item.question.question

              const questionLabel = t("components.wrongAnswersBook.questionNumber", {
                values: { number: item.question.index + 1 },
              }) as string

              return (
                <WrongAnswerCard
                  key={cardId}
                  item={item}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpanded(cardId)}
                  onGenerate={handleGenerateAnalysis}
                  onRetry={handleRetryAnalysis}
                  analysisState={analysisStates.get(item.answerId) || AnalysisState.NOT_GENERATED}
                  questionLabel={questionLabel}
                  questionText={questionText}
                  renderDate={date.toLocaleDateString("zh-CN")}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
