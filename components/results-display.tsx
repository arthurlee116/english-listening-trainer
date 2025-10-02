"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Trophy, RotateCcw, Download, ChevronDown, ChevronUp, Zap, Star, Target, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import type { Exercise, FocusArea, FocusAreaStats } from "@/lib/types"
import { getProgressMetrics, isStorageAvailable, getPracticeNote, savePracticeNote } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"

interface ResultsDisplayProps {
  exercise: Exercise
  onRestart: () => void
  onExport: () => void
  focusAreaStats?: FocusAreaStats
  onRetryWithAdjustedTags?: (adjustedTags: FocusArea[]) => void
}

export const ResultsDisplay = ({ exercise, onRestart, onExport, focusAreaStats, onRetryWithAdjustedTags }: ResultsDisplayProps) => {
  const [showDetails, setShowDetails] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [progressMetrics, setProgressMetrics] = useState<unknown>(null)
  const { t } = useBilingualText()
  const { toast } = useToast()
  const MAX_NOTE_LENGTH = 2000
  const [noteText, setNoteText] = useState("")
  const [savedNoteText, setSavedNoteText] = useState("")
  const [isNotesEnabled, setIsNotesEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Helper function to get focus area display name
  const getFocusAreaDisplayName = (focusArea: FocusArea): string => {
    const normalizedKey = focusArea.replace(/-/g, '').toLowerCase()
    return t(`components.specializedPractice.focusAreas.${normalizedKey}`)
  }
  
  const correctAnswers = exercise.results.filter(result => result.is_correct).length
  const totalQuestions = exercise.results.length
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
  
  // Load progress metrics to show improvements
  useEffect(() => {
    try {
      const metrics = getProgressMetrics()
      setProgressMetrics(metrics)
    } catch (error) {
      console.error("Failed to load progress metrics:", error)
    }
  }, [])

  // Load existing note for this exercise
  useEffect(() => {
    try {
      const available = isStorageAvailable()
      setIsNotesEnabled(available)
      if (available && exercise?.id) {
        const existing = getPracticeNote(exercise.id)
        setNoteText(existing)
        setSavedNoteText(existing)
      }
    } catch (error) {
      console.error('Failed to load practice note:', error)
      setIsNotesEnabled(false)
    }
  }, [exercise?.id])

  // Debounced auto-save when note changes
  useEffect(() => {
    if (!isNotesEnabled) return
    if (noteText === savedNoteText) return
    if (noteText.length > MAX_NOTE_LENGTH) return
    const timer = setTimeout(() => {
      if (exercise?.id) {
        const ok = savePracticeNote(exercise.id, noteText)
        if (ok) {
          setSavedNoteText(noteText)
        }
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [noteText, savedNoteText, isNotesEnabled, exercise?.id])

  const handleSaveNote = () => {
    if (!isNotesEnabled || !exercise?.id) return
    if (noteText === savedNoteText) return
    if (noteText.length > MAX_NOTE_LENGTH) {
      toast({
        title: t("components.resultsDisplay.saveFailed"),
        description: t("components.resultsDisplay.lengthExceeded").replace('{max}', String(MAX_NOTE_LENGTH)),
        variant: 'destructive'
      })
      return
    }

    try {
      setIsSaving(true)
      const ok = savePracticeNote(exercise.id, noteText)
      if (ok) {
        setSavedNoteText(noteText)
        toast({ title: t("components.resultsDisplay.saveSuccess"), description: t("components.resultsDisplay.savedLocally") })
      } else {
        toast({ title: t("components.resultsDisplay.saveFailed"), description: t("components.resultsDisplay.storageUnavailable"), variant: 'destructive' })
      }
    } catch (error) {
      console.error('Failed to save note:', error)
      toast({ title: t("components.resultsDisplay.saveFailed"), description: t("components.resultsDisplay.storageUnavailable"), variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }
  
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

      {/* Progress Impact */}
      {progressMetrics && (
        <Card className="glass-effect p-4">
          <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            {t('components.resultsDisplay.progressImpact')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-orange-500" />
              <div>
                <div className="font-medium">
                  {t('components.achievementPanel.currentStreak')}: {progressMetrics.currentStreakDays} 
                  {t('common.labels.days')}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {t('components.resultsDisplay.streakUpdate')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-green-500" />
              <div>
                <div className="font-medium">
                  {t('components.achievementPanel.averageAccuracy')}: {progressMetrics.averageAccuracy.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {t('components.resultsDisplay.accuracyUpdate')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <div>
                <div className="font-medium">
                  {t('components.achievementPanel.totalSessions')}: {progressMetrics.totalSessions}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {t('components.resultsDisplay.sessionUpdate')}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Specialized Practice Statistics */}
      {exercise.specializedMode && exercise.focusAreas && exercise.focusAreas.length > 0 && (
        <Card className="glass-effect p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            {t('components.resultsDisplay.specializedStats')}
          </h3>
          
          {/* Coverage Warning - Mobile Optimized */}
          {exercise.focusCoverage && exercise.focusCoverage.coverage < 1 && (
            <div className="mb-3 sm:mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1 text-sm sm:text-base">
                    {t('components.resultsDisplay.coverageWarning')}
                  </div>
                  <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                    {t('components.resultsDisplay.coverageWarningDesc').replace('{coverage}', Math.round(exercise.focusCoverage.coverage * 100).toString())}
                  </div>
                  {exercise.focusCoverage.unmatchedTags && exercise.focusCoverage.unmatchedTags.length > 0 && (
                    <div className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mb-2 break-words">
                      <span className="font-medium">{t('components.resultsDisplay.unmatchedTags')}: </span>
                      {exercise.focusCoverage.unmatchedTags.map(tag => getFocusAreaDisplayName(tag)).join(', ')}
                    </div>
                  )}
                  {onRetryWithAdjustedTags && (
                    <button
                      onClick={() => onRetryWithAdjustedTags(exercise.focusCoverage?.provided || [])}
                      className="text-xs sm:text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors touch-manipulation"
                    >
                      {t('components.resultsDisplay.retryWithCoveredTags')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Focus Area Performance - Mobile Optimized */}
          <div className="space-y-2 sm:space-y-3">
            {exercise.focusAreas.map(focusArea => {
              const currentAccuracy = exercise.perFocusAccuracy?.[focusArea]
              const historicalStats = focusAreaStats?.[focusArea]
              const historicalAccuracy = historicalStats?.accuracy || 0
              const improvement = currentAccuracy !== undefined && historicalAccuracy > 0 
                ? currentAccuracy - historicalAccuracy 
                : null

              return (
                <div key={focusArea} className="border rounded-lg p-3 sm:p-4">
                  <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
                      <span className="font-medium text-sm sm:text-base truncate">
                        {getFocusAreaDisplayName(focusArea)}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                      {currentAccuracy !== undefined && (
                        <span className={`text-sm sm:text-base font-medium ${
                          currentAccuracy >= 80 ? 'text-green-600' : 
                          currentAccuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {currentAccuracy.toFixed(1)}%
                        </span>
                      )}
                      {improvement !== null && (
                        <div className="flex items-center gap-1">
                          {improvement > 5 ? (
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          ) : improvement < -5 ? (
                            <TrendingDown className="w-3 h-3 text-red-600" />
                          ) : (
                            <Minus className="w-3 h-3 text-gray-500" />
                          )}
                          <span className={`text-xs ${
                            improvement > 0 ? 'text-green-600' : 
                            improvement < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {improvement > 0 ? '+' : ''}{improvement?.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex justify-between sm:block">
                      <span className="font-medium">{t('components.resultsDisplay.thisSession')}: </span>
                      <span>{currentAccuracy?.toFixed(1) || 'N/A'}%</span>
                    </div>
                    <div className="flex justify-between sm:block">
                      <span className="font-medium">{t('components.resultsDisplay.historical')}: </span>
                      <span>{historicalAccuracy > 0 ? `${historicalAccuracy.toFixed(1)}%` : t('components.resultsDisplay.noData')}</span>
                    </div>
                  </div>

                  {historicalStats && historicalStats.attempts > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{t('components.resultsDisplay.totalAttempts')}: {historicalStats.attempts}</span>
                      <span>{t('components.resultsDisplay.totalErrors')}: {historicalStats.incorrect}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Recommendations - Mobile Optimized */}
          <div className="mt-3 sm:mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 text-sm sm:text-base">
              {t('components.resultsDisplay.nextStepRecommendations')}
            </h4>
            <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 space-y-1">
              {exercise.focusAreas.map(focusArea => {
                const currentAccuracy = exercise.perFocusAccuracy?.[focusArea] || 0
                if (currentAccuracy < 70) {
                  return (
                    <div key={focusArea} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span className="flex-1">
                        {t('components.resultsDisplay.recommendationImprove').replace('{area}', 
                          getFocusAreaDisplayName(focusArea)
                        )}
                      </span>
                    </div>
                  )
                } else if (currentAccuracy >= 90) {
                  return (
                    <div key={focusArea} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span className="flex-1">
                        {t('components.resultsDisplay.recommendationMaster').replace('{area}', 
                          getFocusAreaDisplayName(focusArea)
                        )}
                      </span>
                    </div>
                  )
                }
                return null
              }).filter(Boolean)}
              
              {exercise.focusAreas.every(area => (exercise.perFocusAccuracy?.[area] || 0) >= 70) && (
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span className="flex-1">{t('components.resultsDisplay.recommendationOverall')}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

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

      {/* Practice Notes Card */}
      <Card className="glass-effect p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t("components.resultsDisplay.practiceNotes")}</h3>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {t("components.resultsDisplay.lengthHint").replace('{current}', String(noteText.length)).replace('{max}', String(MAX_NOTE_LENGTH))}
          </span>
        </div>
        <div className="space-y-3">
          <textarea
            className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted"
            placeholder={t("components.resultsDisplay.notesPlaceholder")}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              const isCmdEnter = (e.metaKey || e.ctrlKey) && e.key === 'Enter'
              if (isCmdEnter) {
                e.preventDefault()
                handleSaveNote()
              }
            }}
            disabled={!isNotesEnabled}
          />
          {!isNotesEnabled && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {t("components.resultsDisplay.storageUnavailable")}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("components.resultsDisplay.shortcutSaveHint")}
            </span>
            <Button 
              onClick={handleSaveNote} 
              disabled={!isNotesEnabled || isSaving || noteText === savedNoteText || noteText.length > MAX_NOTE_LENGTH}
            >
              {t("components.resultsDisplay.saveNotes")}
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t("components.resultsDisplay.localOnlyHint")}
        </div>
      </Card>

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