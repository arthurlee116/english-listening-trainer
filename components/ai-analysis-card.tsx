"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useThemeClasses, combineThemeClasses } from "@/hooks/use-theme-classes"
import { 
  ChevronDown, 
  ChevronUp, 
  Brain, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Lightbulb,
  Target,
  MessageSquare,
  Quote
} from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import type { AIAnalysisResponse } from "@/lib/types"

export enum AnalysisState {
  NOT_GENERATED = 'not_generated',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

interface AIAnalysisCardProps {
  answerId: string
  analysis?: AIAnalysisResponse
  state: AnalysisState
  onGenerate: (answerId: string) => void
  onRetry: (answerId: string) => void
}

export function AIAnalysisCard({ 
  answerId, 
  analysis, 
  state, 
  onGenerate, 
  onRetry 
}: AIAnalysisCardProps) {
  const { t } = useBilingualText()
  const [isExpanded, setIsExpanded] = useState(false)
  const { textClass, iconClass, borderClass } = useThemeClasses()

  const getStateIcon = () => {
    switch (state) {
      case AnalysisState.NOT_GENERATED:
        return <Brain className="w-4 h-4" />
      case AnalysisState.LOADING:
        return <Loader2 className="w-4 h-4 animate-spin" />
      case AnalysisState.SUCCESS:
        return <CheckCircle className={combineThemeClasses("w-4 h-4 text-green-600", iconClass('success'))} />
      case AnalysisState.ERROR:
        return <AlertCircle className={combineThemeClasses("w-4 h-4 text-red-600", iconClass('error'))} />
    }
  }

  const getStateText = () => {
    switch (state) {
      case AnalysisState.NOT_GENERATED:
        return t("components.aiAnalysisCard.notGenerated")
      case AnalysisState.LOADING:
        return t("components.aiAnalysisCard.generating")
      case AnalysisState.SUCCESS:
        return t("components.aiAnalysisCard.analysisComplete")
      case AnalysisState.ERROR:
        return t("components.aiAnalysisCard.analysisFailed")
    }
  }

  const getStateColor = () => {
    switch (state) {
      case AnalysisState.NOT_GENERATED:
        return "border-emphasis-light bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
      case AnalysisState.LOADING:
        return "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-600"
      case AnalysisState.SUCCESS:
        return "border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-600"
      case AnalysisState.ERROR:
        return "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-600"
    }
  }

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return "bg-green-100 text-green-800 border-green-300"
      case 'medium':
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case 'low':
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-emphasis-light"
    }
  }

  return (
    <Card className={`p-4 ${getStateColor()}`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStateIcon()}
            <h5 className="font-medium">
              <BilingualText translationKey="components.aiAnalysisCard.title" />
            </h5>
            {analysis && (
              <Badge className={getConfidenceBadgeColor(analysis.confidence)}>
                {t(`components.aiAnalysisCard.confidence.${analysis.confidence}`)}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {state === AnalysisState.NOT_GENERATED && (
              <Button
                size="sm"
                onClick={() => onGenerate(answerId)}
                disabled={false}
              >
                <Brain className="w-4 h-4 mr-1" />
                <BilingualText translationKey="components.aiAnalysisCard.generateAnalysis" />
              </Button>
            )}
            
            {state === AnalysisState.ERROR && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetry(answerId)}
                disabled={false}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                <BilingualText translationKey="common.buttons.retry" />
              </Button>
            )}
            
            {(state === AnalysisState.SUCCESS || state === AnalysisState.ERROR) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* State Message */}
        <p className={combineThemeClasses(
          "text-sm text-gray-600 dark:text-gray-400",
          textClass('secondary')
        )}>
          {getStateText()}
        </p>

        {/* Analysis Content */}
        {isExpanded && analysis && state === AnalysisState.SUCCESS && (
          <div className="space-y-4 pt-2 border-t separator-light dark:border-gray-700">
            {/* Main Analysis */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className={combineThemeClasses("w-4 h-4 text-blue-600", iconClass('info'))} />
                <h6 className="font-medium">
                  <BilingualText translationKey="components.aiAnalysisCard.detailedAnalysis" />
                </h6>
              </div>
              <p className={combineThemeClasses(
                "text-sm text-gray-700 dark:text-gray-300 leading-relaxed",
                textClass('primary')
              )}>
                {analysis.analysis}
              </p>
            </div>

            {/* Key Reason */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Target className={combineThemeClasses("w-4 h-4 text-orange-600", iconClass('warning'))} />
                <h6 className="font-medium">
                  <BilingualText translationKey="components.aiAnalysisCard.keyReason" />
                </h6>
              </div>
              <p className={combineThemeClasses(
                "text-sm text-gray-700 dark:text-gray-300",
                textClass('primary')
              )}>
                {analysis.key_reason}
              </p>
            </div>

            {/* Ability Tags */}
            {analysis.ability_tags && analysis.ability_tags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Brain className={combineThemeClasses("w-4 h-4 text-purple-600", iconClass('primary'))} />
                  <h6 className="font-medium">
                    <BilingualText translationKey="components.aiAnalysisCard.abilityTags" />
                  </h6>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.ability_tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Signal Words */}
            {analysis.signal_words && analysis.signal_words.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className={combineThemeClasses("w-4 h-4 text-yellow-600", iconClass('warning'))} />
                  <h6 className="font-medium">
                    <BilingualText translationKey="components.aiAnalysisCard.signalWords" />
                  </h6>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.signal_words.map((word, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy */}
            {analysis.strategy && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className={combineThemeClasses("w-4 h-4 text-green-600", iconClass('success'))} />
                  <h6 className="font-medium">
                    <BilingualText translationKey="components.aiAnalysisCard.strategy" />
                  </h6>
                </div>
                <p className={combineThemeClasses(
                  "text-sm text-gray-700 dark:text-gray-300",
                  textClass('primary')
                )}>
                  {analysis.strategy}
                </p>
              </div>
            )}

            {/* Related Sentences */}
            {analysis.related_sentences && analysis.related_sentences.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Quote className={combineThemeClasses("w-4 h-4 text-indigo-600", iconClass('info'))} />
                  <h6 className="font-medium">
                    <BilingualText translationKey="components.aiAnalysisCard.relatedSentences" />
                  </h6>
                </div>
                <div className="space-y-2">
                  {analysis.related_sentences.map((sentence, index) => (
                    <div key={index} className="bg-white dark:bg-gray-900 p-3 rounded border">
                      <blockquote className={combineThemeClasses(
                        "text-sm italic text-gray-600 dark:text-gray-400 mb-1",
                        textClass('secondary')
                      )}>
                        "{sentence.quote}"
                      </blockquote>
                      <p className={combineThemeClasses(
                        "text-xs text-gray-500 dark:text-gray-500",
                        textClass('muted')
                      )}>
                        {sentence.comment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {isExpanded && state === AnalysisState.ERROR && (
          <div className={combineThemeClasses(
            "pt-2 border-t dark:border-gray-700",
            borderClass('default')
          )}>
            <p className={combineThemeClasses(
              "text-sm text-red-600 dark:text-red-400",
              iconClass('error')
            )}>
              <BilingualText translationKey="components.aiAnalysisCard.errorMessage" />
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}