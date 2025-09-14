"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Trophy, RotateCcw, Download, ChevronDown, ChevronUp } from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import type { Exercise } from "@/lib/types"

interface ResultsDisplayProps {
  exercise: Exercise
  onRestart: () => void
  onExport: () => void
}

export const ResultsDisplay = ({ exercise, onRestart, onExport }: ResultsDisplayProps) => {
  const [showDetails, setShowDetails] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const { t } = useBilingualText()
  
  const correctAnswers = exercise.results.filter(result => result.is_correct).length
  const totalQuestions = exercise.results.length
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
  
  const getAccuracyColor = (acc: number) => {
    if (acc >= 90) return "text-green-600"
    if (acc >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getAccuracyBadgeColor = (acc: number) => {
    if (acc >= 90) return "bg-green-100 text-green-800 border-green-300"
    if (acc >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-red-100 text-red-800 border-red-300"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-effect p-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="w-8 h-8 text-yellow-500 mr-3" />
          <h2 className="text-2xl font-bold">{t('components.resultsDisplay.exerciseComplete')}</h2>
        </div>
        
        <div className="space-y-4">
          <div className={`text-4xl font-bold ${getAccuracyColor(accuracy)}`}>
            {accuracy}%
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <Badge className={getAccuracyBadgeColor(accuracy)}>
              {correctAnswers}/{totalQuestions} {t('components.resultsDisplay.correct')}
            </Badge>
            <Badge variant="outline">
              {t(`common.difficultyLevels.${exercise.difficulty}`)} {t('components.resultsDisplay.level')}
            </Badge>
            <Badge variant="outline">
              {exercise.language}
            </Badge>
          </div>
          
          <Progress value={accuracy} className="w-full max-w-md mx-auto" />
          
          <p className="text-gray-600 dark:text-gray-300">
            {t('common.labels.topic')}：{exercise.topic}
          </p>
        </div>
      </Card>

      {/* Details toggle button */}
      <div className="flex justify-center">
        <Button
          onClick={() => setShowDetails(!showDetails)}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {showDetails ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              {t('components.resultsDisplay.hideDetails')}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              {t('components.resultsDisplay.showDetails')}
            </>
          )}
        </Button>
      </div>

      {/* Detailed Results */}
      {showDetails && (
        <Card className="glass-effect p-6">
          <h3 className="text-lg font-semibold mb-4">{t('components.resultsDisplay.answerDetails')}</h3>
          <div className="space-y-4">
            {exercise.questions.map((question, index) => {
              const result = exercise.results[index]
              const userAnswer = exercise.answers[index] || ""
              const isCorrect = result?.is_correct || false
              
              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 space-y-2">
                      <div className="font-medium">
                        {t('components.resultsDisplay.question')} {index + 1}: {question.question}
                      </div>
                      
                      {question.type === "single" && question.options && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {t('components.resultsDisplay.options')}：{question.options.join(" / ")}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{t('components.resultsDisplay.yourAnswer')}：</span>
                          <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                            {userAnswer || t('components.resultsDisplay.noAnswer')}
                          </span>
                        </div>
                        
                        {!isCorrect && result?.correct_answer && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{t('components.resultsDisplay.correctAnswer')}：</span>
                            <span className="text-green-600">{result.correct_answer}</span>
                          </div>
                        )}
                      </div>
                      
                      {question.explanation && (
                        <div className="text-sm bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <span className="font-medium text-blue-800 dark:text-blue-300">{t('components.resultsDisplay.explanation')}：</span>
                          <span className="text-blue-700 dark:text-blue-200">{question.explanation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={onRestart} className="flex-1 sm:flex-none">
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('components.resultsDisplay.startNewPractice')}
        </Button>
        <Button onClick={onExport} variant="outline" className="flex-1 sm:flex-none">
          <Download className="w-4 h-4 mr-2" />
          {t('components.resultsDisplay.exportResults')}
        </Button>
      </div>

      {/* Transcript Toggle */}
      <div className="flex justify-center">
        <Button
          onClick={() => setShowTranscript(!showTranscript)}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {showTranscript ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              {t('components.resultsDisplay.hideTranscript')}
            </> 
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              {t('components.resultsDisplay.showTranscript')}
            </>
          )}
        </Button>
      </div>

      {/* Transcript Reference */}
      {showTranscript && (
        <Card className="glass-effect p-6">
          <h3 className="text-lg font-semibold mb-4">{t('components.resultsDisplay.listeningMaterial')}</h3>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {exercise.transcript}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

ResultsDisplay.displayName = "ResultsDisplay"