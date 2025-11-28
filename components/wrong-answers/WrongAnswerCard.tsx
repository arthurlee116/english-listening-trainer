"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Eye } from "lucide-react"
import { AIAnalysisCard, AnalysisState } from "@/components/ai-analysis-card"
import type { WrongAnswerItem } from "@/lib/types"
import { useBilingualText } from "@/hooks/use-bilingual-text"

interface WrongAnswerCardProps {
  item: WrongAnswerItem
  isExpanded: boolean
  onToggle: () => void
  onGenerate: (answerId: string) => void
  onRetry: (answerId: string) => void
  analysisState: AnalysisState
  questionLabel: string
  questionText: string
  renderDate: string
}

function getTypeLabel(type: string, t: ReturnType<typeof useBilingualText>["t"]) {
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

function getTypeBadgeColor(type: string) {
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
      return "bg-slate-900/60 text-slate-200 border border-slate-600"
  }
}

export default function WrongAnswerCard({
  item,
  isExpanded,
  onToggle,
  onGenerate,
  onRetry,
  analysisState,
  questionLabel,
  questionText,
  renderDate,
}: WrongAnswerCardProps) {
  const { t } = useBilingualText()

  return (
    <Card className="glass-effect p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline">{item.session.topic}</Badge>
            <Badge variant="outline">{item.session.difficulty}</Badge>
            <Badge variant="outline">{item.session.language}</Badge>
            <Badge className={getTypeBadgeColor(item.question.type)}>
              {getTypeLabel(item.question.type, t)}
            </Badge>
          </div>
          <div className="text-sm text-gray-500">{renderDate}</div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-medium mb-2">{questionLabel}</h4>
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
            <p className="text-green-700 dark:text-green-200">{item.question.correctAnswer}</p>
          </div>
        </div>

        {item.question.explanation && (
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-1">
              <BilingualText translationKey="components.wrongAnswersBook.explanation" />
            </h5>
            <p className="text-blue-700 dark:text-blue-200">{item.question.explanation}</p>
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onToggle}>
            <Eye className="w-4 h-4 mr-2" />
            <BilingualText
              translationKey={
                isExpanded
                  ? "components.wrongAnswersBook.hideListeningMaterial"
                  : "components.wrongAnswersBook.showListeningMaterial"
              }
            />
          </Button>
        </div>

        <AIAnalysisCard
          answerId={item.answerId}
          analysis={item.answer.aiAnalysis}
          state={analysisState}
          onGenerate={onGenerate}
          onRetry={onRetry}
        />

        {isExpanded && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h5 className="font-medium mb-2">
              <BilingualText translationKey="components.wrongAnswersBook.listeningMaterial" />
            </h5>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{item.question.transcript}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
