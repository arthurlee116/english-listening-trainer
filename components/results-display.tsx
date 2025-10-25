"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Trophy, RotateCcw, Download, ChevronDown, ChevronUp, Zap, Star } from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import type { Exercise, UserProgressMetrics } from "@/lib/types"
import { getProgressMetrics, isStorageAvailable, getPracticeNote, savePracticeNote } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"

interface ResultsDisplayProps {
  exercise: Exercise
  onRestart: () => void
  onExport: () => void
  // 以下属性已废弃,仅为兼容历史代码保留
  focusAreaStats?: never
  onRetryWithAdjustedTags?: never
}

export const ResultsDisplay = ({ exercise, onRestart, onExport }: ResultsDisplayProps) => {
  const [showDetails, setShowDetails] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [progressMetrics, setProgressMetrics] = useState<UserProgressMetrics | null>(null)
  const { t } = useBilingualText()
  const { toast } = useToast()
  const MAX_NOTE_LENGTH = 2000
  const [noteText, setNoteText] = useState("")
  const [savedNoteText, setSavedNoteText] = useState("")
  const [isNotesEnabled, setIsNotesEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
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
      // Set to null on error to avoid rendering issues
      setProgressMetrics(null)
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
        description: t("components.resultsDisplay.lengthExceeded", {
          values: { max: MAX_NOTE_LENGTH },
        }),
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
          <Trophy className="w-8 h-8 text-yellow-400 mr-3" />
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
            <Zap className="w-4 h-4 text-sky-400" />
            {t('components.resultsDisplay.progressImpact')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
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
              <Star className="w-4 h-4 text-emerald-400" />
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
              <Zap className="w-4 h-4 text-indigo-400" />
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

      {/* Specialized Practice Statistics - REMOVED
         专项练习统计已移除,但保留类型定义以兼容历史数据展示
         历史练习记录中的 focusAreas/focusCoverage 等字段仍然存在于数据库中 */}

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
              const questionLabel = t('components.resultsDisplay.question', {
                values: { number: index + 1 },
              })

              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                    )}

                    <div className="flex-1 space-y-2">
                      <div className="font-medium">
                        {questionLabel}: {question.question}
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
            {t("components.resultsDisplay.lengthHint", {
              values: { current: noteText.length, max: MAX_NOTE_LENGTH },
            })}
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