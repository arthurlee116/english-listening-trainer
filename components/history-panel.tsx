"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Calendar, Trophy, Eye, Trash2, TrendingUp, Target } from "lucide-react"
import { getHistory, clearHistory, getPracticeNote, savePracticeNote, deletePracticeNote, isStorageAvailable } from "@/lib/storage"
import type { Exercise, FocusArea } from "@/lib/types"
import { FOCUS_AREA_LABELS } from "@/lib/types"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { BilingualText } from "@/components/ui/bilingual-text"
import { getProgressMetrics } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import type { UserProgressMetrics } from "@/lib/types"

interface HistoryPanelProps {
  onBack: () => void
  onRestore: (exercise: Exercise) => void
}

export const HistoryPanel = ({ onBack, onRestore }: HistoryPanelProps) => {
  const { t } = useBilingualText()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [progressMetrics, setProgressMetrics] = useState<UserProgressMetrics | null>(null)
  const [noteFilter, setNoteFilter] = useState<string>("all")
  const [focusAreaFilter, setFocusAreaFilter] = useState<string>("all")
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [noteEditingExercise, setNoteEditingExercise] = useState<Exercise | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const history = getHistory()
    setExercises(history)
    setFilteredExercises(history)
    
    // Load progress metrics for statistics display
    try {
      const metrics = getProgressMetrics()
      setProgressMetrics(metrics)
    } catch (error) {
      console.error("Failed to load progress metrics:", error)
    }
  }, [])

  useEffect(() => {
    let filtered = [...exercises]

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.topic.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 难度过滤
    if (difficultyFilter !== "all") {
      filtered = filtered.filter(exercise => exercise.difficulty === difficultyFilter)
    }

    // 语言过滤
    if (languageFilter !== "all") {
      filtered = filtered.filter(exercise => exercise.language === languageFilter)
    }

    // 按笔记过滤
    if (noteFilter !== "all") {
      filtered = filtered.filter(exercise => {
        const note = getPracticeNote(exercise.id)
        return noteFilter === 'has' ? !!note : !note
      })
    }

    // 按能力标签过滤
    if (focusAreaFilter !== "all") {
      filtered = filtered.filter(exercise => {
        if (focusAreaFilter === "specialized") {
          return exercise.specializedMode === true
        } else if (focusAreaFilter === "general") {
          return !exercise.specializedMode
        } else {
          // 特定标签过滤
          return exercise.focusAreas && exercise.focusAreas.includes(focusAreaFilter as FocusArea)
        }
      })
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest": {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        case "oldest": {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        }
        case "score_high": {
          const aScore = Math.round((a.results.filter(r => r.is_correct).length / a.results.length) * 100)
          const bScore = Math.round((b.results.filter(r => r.is_correct).length / b.results.length) * 100)
          return bScore - aScore
        }
        case "score_low": {
          const aScoreLow = Math.round((a.results.filter(r => r.is_correct).length / a.results.length) * 100)
          const bScoreLow = Math.round((b.results.filter(r => r.is_correct).length / b.results.length) * 100)
          return aScoreLow - bScoreLow
        }
        default: {
          return 0
        }
      }
    })

    setFilteredExercises(filtered)
  }, [exercises, searchTerm, difficultyFilter, languageFilter, sortBy, noteFilter, focusAreaFilter])

  const handleClearHistory = () => {
    if (window.confirm(t("components.historyPanel.confirmClearHistory"))) {
      clearHistory()
      setExercises([])
      setFilteredExercises([])
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800 border-green-300"
    if (score >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-red-100 text-red-800 border-red-300"
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
              <BilingualText translationKey="components.historyPanel.practiceHistory" />
            </h2>
            <Badge variant="outline">
              {t("components.historyPanel.recordsCount", {
                values: { count: filteredExercises.length },
              })}
            </Badge>
          </div>
          
          {exercises.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleClearHistory}>
              <Trash2 className="w-4 h-4 mr-2" />
              <BilingualText translationKey="common.buttons.clearHistory" />
            </Button>
          )}
        </div>
      </Card>

      {exercises.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              <BilingualText translationKey="components.historyPanel.noRecords" />
            </h3>
            <p>
              <BilingualText translationKey="components.historyPanel.noRecordsDescription" />
            </p>
          </div>
        </Card>
      ) : (
        <>          
          {/* Statistics Summary */}
          {progressMetrics && (
            <Card className="glass-effect p-4 mb-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <BilingualText translationKey="components.achievementPanel.statisticsOverview" />
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
                <div>
                  <div className="text-lg font-bold text-blue-600">{progressMetrics.totalSessions}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <BilingualText translationKey="components.achievementPanel.totalSessions" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">{progressMetrics.averageAccuracy.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <BilingualText translationKey="components.achievementPanel.averageAccuracy" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-600">{progressMetrics.currentStreakDays}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <BilingualText translationKey="components.achievementPanel.currentStreak" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600">{progressMetrics.totalListeningMinutes}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <BilingualText translationKey="components.achievementPanel.totalListeningTime" />
                  </div>
                </div>
              </div>
              
              {/* 专项练习统计 */}
              {(() => {
                const specializedExercises = exercises.filter(ex => ex.specializedMode)
                const generalExercises = exercises.filter(ex => !ex.specializedMode)
                
                if (specializedExercises.length > 0) {
                  return (
                    <div className="border-t pt-3">
                      <div className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-600" />
                        <BilingualText translationKey="components.specializedPractice.title" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-center text-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                          <div className="font-bold text-blue-600">{specializedExercises.length}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <BilingualText translationKey="components.specializedPractice.title" />
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                          <div className="font-bold text-gray-600 dark:text-gray-300">{generalExercises.length}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <BilingualText translationKey="components.generalPractice.title" />
                          </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded sm:col-span-2 lg:col-span-1">
                          <div className="font-bold text-green-600">
                            {specializedExercises.length > 0 
                              ? Math.round(specializedExercises.reduce((acc, ex) => {
                                  const correct = ex.results.filter(r => r.is_correct).length
                                  return acc + (correct / ex.results.length) * 100
                                }, 0) / specializedExercises.length)
                              : 0}%
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <BilingualText translationKey="components.specializedPractice.accuracy" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </Card>
          )}
          
          {/* Filters */}
          <Card className="glass-effect p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={t("components.historyPanel.searchTopics")}
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
                  <SelectItem value="all">{t("components.historyPanel.allDifficulties")}</SelectItem>
                  <SelectItem value="A1">{t("common.difficultyLevels.A1")}</SelectItem>
                  <SelectItem value="A2">{t("common.difficultyLevels.A2")}</SelectItem>
                  <SelectItem value="B1">{t("common.difficultyLevels.B1")}</SelectItem>
                  <SelectItem value="B2">{t("common.difficultyLevels.B2")}</SelectItem>
                  <SelectItem value="C1">{t("common.difficultyLevels.C1")}</SelectItem>
                  <SelectItem value="C2">{t("common.difficultyLevels.C2")}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.labels.language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("components.historyPanel.allLanguages")}</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder={t("components.historyPanel.sortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("components.historyPanel.sortNewest")}</SelectItem>
                  <SelectItem value="oldest">{t("components.historyPanel.sortOldest")}</SelectItem>
                  <SelectItem value="score_high">{t("components.historyPanel.sortScoreHigh")}</SelectItem>
                  <SelectItem value="score_low">{t("components.historyPanel.sortScoreLow")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={noteFilter} onValueChange={setNoteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("components.historyPanel.filterBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("components.historyPanel.allNotes")}</SelectItem>
                  <SelectItem value="has">{t("components.historyPanel.withNotes")}</SelectItem>
                  <SelectItem value="none">{t("components.historyPanel.withoutNotes")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={focusAreaFilter} onValueChange={setFocusAreaFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("components.questionInterface.focusAreas")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <BilingualText translationKey="components.historyPanel.allDifficulties" />
                  </SelectItem>
                  <SelectItem value="specialized">
                    <BilingualText translationKey="components.specializedPractice.title" />
                  </SelectItem>
                  <SelectItem value="general">
                    <BilingualText translationKey="components.generalPractice.title" />
                  </SelectItem>
                  {Object.values(FOCUS_AREA_LABELS).map((label) => (
                    <SelectItem key={label.code} value={label.code}>
                      <BilingualText translationKey={`components.specializedPractice.focusAreas.${label.code.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Exercise List */}
          <div className="grid gap-4">
            {filteredExercises.map((exercise, _index) => {
              const correctAnswers = exercise.results.filter(result => result.is_correct).length
              const totalQuestions = exercise.results.length
              const accuracy = Math.round((correctAnswers / totalQuestions) * 100)
              const date = new Date(exercise.createdAt)

              return (
                <Card key={exercise.id} className="glass-effect p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold truncate">{exercise.topic}</h3>
                        <Badge variant="outline">{exercise.difficulty}</Badge>
                        <Badge variant="outline">{exercise.language}</Badge>
                        {exercise.specializedMode && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
                            <Target className="w-3 h-3 mr-1" />
                            <BilingualText translationKey="components.specializedPractice.title" />
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          <span className={getScoreColor(accuracy)}>{accuracy}%</span>
                        </div>
                        <Badge className={getScoreBadgeColor(accuracy)}>
                          {correctAnswers}/{totalQuestions} {t("components.historyPanel.correct")}
                        </Badge>
                      </div>
                      
                      {/* 专项练习标签信息 - Mobile Optimized */}
                      {exercise.specializedMode && exercise.focusAreas && exercise.focusAreas.length > 0 && (
                        <div className="mt-2">
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-2">
                            <span className="text-xs text-gray-500 font-medium mb-1 sm:mb-0 sm:mr-2">
                              <BilingualText translationKey="components.questionInterface.focusAreas" />:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {exercise.focusAreas.map((area) => {
                                const label = FOCUS_AREA_LABELS[area]
                                const areaAccuracy = exercise.perFocusAccuracy?.[area]
                                return (
                                  <Badge 
                                    key={area} 
                                    variant="outline" 
                                    className="text-xs px-2 py-0.5"
                                    title={label?.description}
                                  >
                                    <BilingualText translationKey={`components.specializedPractice.focusAreas.${area}`} />
                                    {areaAccuracy !== undefined && (
                                      <span className="ml-1 text-gray-500">({areaAccuracy}%)</span>
                                    )}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                          {exercise.focusCoverage && exercise.focusCoverage.coverage < 1 && (
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                              <span className="font-medium">
                                <BilingualText translationKey="components.specializedPractice.coverage.provided" />
                              </span>
                              <span>{Math.round(exercise.focusCoverage.coverage * 100)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      onClick={() => onRestore(exercise)}
                      className="ml-4"
                      size="sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      <BilingualText translationKey="common.buttons.viewDetails" />
                    </Button>
                  </div>
                  {/* Note Preview and quick actions */}
                  <div className="mt-3 pt-3 border-t">
                    {(() => {
                      const note = getPracticeNote(exercise.id)
                      const hasNote = !!note
                      const summary = note.length > 80 ? note.slice(0, 80) + '…' : note
                      return (
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">
                              {t("components.historyPanel.noteLabel")}:
                            </span>
                            <span className="ml-2">
                              {hasNote ? summary : t("components.historyPanel.noNote")}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNoteEditingExercise(exercise)
                                setNoteDraft(note)
                                setNoteDialogOpen(true)
                              }}
                            >
                              {t("components.historyPanel.viewNote")}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setNoteEditingExercise(exercise)
                                setNoteDraft(note)
                                setNoteDialogOpen(true)
                              }}
                            >
                              {t("components.historyPanel.editNote")}
                            </Button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </Card>
              )
            })}
          </div>
          {/* Note Dialog */}
          <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("components.historyPanel.editNote")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[150px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    const isCmdEnter = (e.metaKey || e.ctrlKey) && e.key === 'Enter'
                    if (isCmdEnter) {
                      e.preventDefault()
                      if (noteEditingExercise) {
                        const ok = savePracticeNote(noteEditingExercise.id, noteDraft)
                        if (ok) {
                          toast({ title: t("components.resultsDisplay.saveSuccess"), description: t("components.resultsDisplay.savedLocally") })
                          setNoteDialogOpen(false)
                        } else {
                          toast({ title: t("components.resultsDisplay.saveFailed"), description: t("components.resultsDisplay.storageUnavailable"), variant: 'destructive' })
                        }
                      }
                    }
                  }}
                />
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setNoteDialogOpen(false)}
                >
                  {t("common.buttons.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!noteEditingExercise) return
                    const ok = deletePracticeNote(noteEditingExercise.id)
                    if (ok) {
                      toast({ title: t("components.historyPanel.noteDeleted"), description: t("components.historyPanel.noteDeletedDesc") })
                      setNoteDraft("")
                      setNoteDialogOpen(false)
                    } else {
                      toast({ title: t("components.resultsDisplay.saveFailed"), description: t("components.resultsDisplay.storageUnavailable"), variant: 'destructive' })
                    }
                  }}
                >
                  {t("components.historyPanel.deleteNote")}
                </Button>
                <Button
                  onClick={() => {
                    if (!noteEditingExercise) return
                    if (!isStorageAvailable()) {
                      toast({ title: t("components.resultsDisplay.saveFailed"), description: t("components.resultsDisplay.storageUnavailable"), variant: 'destructive' })
                      return
                    }
                    const ok = savePracticeNote(noteEditingExercise.id, noteDraft)
                    if (ok) {
                      toast({ title: t("components.resultsDisplay.saveSuccess"), description: t("components.resultsDisplay.savedLocally") })
                      setNoteDialogOpen(false)
                    } else {
                      toast({ title: t("components.resultsDisplay.saveFailed"), description: t("components.resultsDisplay.storageUnavailable"), variant: 'destructive' })
                    }
                  }}
                >
                  {t("common.buttons.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

HistoryPanel.displayName = "HistoryPanel"