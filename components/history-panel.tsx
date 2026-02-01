"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, Calendar, Trophy, Eye, Trash2 } from "lucide-react"
import { clearHistory, deletePracticeNote, getHistory, getPracticeNote, isStorageAvailable, mergePracticeHistory, savePracticeNote } from "@/lib/storage"
import type { Exercise, FocusArea, DifficultyLevel, ListeningLanguage } from "@/lib/types"
import type { ExerciseHistoryEntry } from "@/lib/storage"
import { FOCUS_AREA_LABELS } from "@/lib/types"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface HistoryPanelProps {
  onBack: () => void
  onRestore: (exercise: Exercise) => void
}

const PAGE_SIZE = 10

interface PracticeHistorySession {
  id: string
  difficulty: DifficultyLevel
  language: ListeningLanguage
  topic: string
  accuracy?: number | null
  score?: number | null
  duration?: number | null
  createdAt: string
  exerciseData: Exercise | null
}

interface PracticeHistoryResponse {
  sessions: PracticeHistorySession[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasMore: boolean
  }
}

export const HistoryPanel = ({ onBack, onRestore }: HistoryPanelProps) => {
  const { t } = useBilingualText()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [noteFilter, setNoteFilter] = useState<string>("all")
  const [focusAreaFilter, setFocusAreaFilter] = useState<string>("all")
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [noteEditingExercise, setNoteEditingExercise] = useState<Exercise | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { toast } = useToast()

  const mapSessionToExercise = (session: PracticeHistorySession): ExerciseHistoryEntry => {
    if (session.exerciseData && typeof session.exerciseData === 'object') {
      return {
        ...session.exerciseData,
        createdAt: session.exerciseData.createdAt || session.createdAt,
        totalDurationSec: session.exerciseData.totalDurationSec ?? session.duration ?? undefined,
        sessionId: session.id
      }
    }

    return {
      id: session.id,
      difficulty: session.difficulty,
      language: session.language,
      topic: session.topic || 'Untitled',
      transcript: '',
      questions: [],
      answers: {},
      results: [],
      createdAt: session.createdAt,
      totalDurationSec: session.duration ?? undefined,
      sessionId: session.id
    }
  }

  useEffect(() => {
    let isActive = true

    const loadHistory = async () => {
      setIsLoading(true)
      setLoadError(null)

      let localHistory: ExerciseHistoryEntry[] = []
      try {
        const history = getHistory()
        localHistory = Array.isArray(history) ? history : []
      } catch {
        localHistory = []
      }

      try {
        const response = await fetch(`/api/practice/history?page=${page}&limit=${PAGE_SIZE}`, {
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error(`History request failed with status ${response.status}`)
        }

        const data = (await response.json()) as PracticeHistoryResponse
        const serverHistory = Array.isArray(data.sessions) ? data.sessions.map(mapSessionToExercise) : []
        const merged = mergePracticeHistory({ serverHistory, localHistory, pageSize: PAGE_SIZE })

        if (!isActive) return
        setExercises(merged)
        setHasMore(Boolean(data.pagination?.hasMore))
        setTotalPages(Math.max(data.pagination?.totalPages ?? 1, 1))
      } catch (error) {
        if (!isActive) return
        const message = error instanceof Error ? error.message : String(error)
        setLoadError(message)
        setExercises(localHistory)
        setHasMore(false)
        setTotalPages(1)
        toast({
          title: t("common.messages.error"),
          description: t("components.historyPanel.loadFailed")
        })
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadHistory()
    return () => {
      isActive = false
    }
  }, [page, toast, t])

  const getResultsArray = (exercise: Exercise | null | undefined): Exercise["results"] => {
    if (exercise && Array.isArray(exercise.results)) {
      return exercise.results
    }
    return []
  }

  const getAccuracyPercent = (exercise: Exercise): number => {
    const results = getResultsArray(exercise)
    if (results.length === 0) return 0
    const correctAnswers = results.filter(result => result.is_correct).length
    return Math.round((correctAnswers / results.length) * 100)
  }

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

    // 按能力标签过滤 - 专项模式已下线,隐藏相关过滤
    if (focusAreaFilter !== "all") {
      if (focusAreaFilter !== "specialized" && focusAreaFilter !== "general") {
        // 特定标签过滤
        filtered = filtered.filter(exercise => {
          return exercise.focusAreas && exercise.focusAreas.includes(focusAreaFilter as FocusArea)
        })
      }
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
          const aScore = getAccuracyPercent(a)
          const bScore = getAccuracyPercent(b)
          return bScore - aScore
        }
        case "score_low": {
          const aScoreLow = getAccuracyPercent(a)
          const bScoreLow = getAccuracyPercent(b)
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              aria-label="Back"
            >
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

      {(isLoading || loadError) && (
        <Card className="glass-effect p-4">
          <div className="text-sm text-gray-600">
            {isLoading
              ? t("common.messages.loading")
              : t("components.historyPanel.loadFailed")}
            {loadError && (
              <span className="ml-2">
                {t("components.historyPanel.showingLocal")}
              </span>
            )}
          </div>
        </Card>
      )}

      {exercises.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-500">
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
                <SelectTrigger aria-label={t("common.labels.difficulty")}>
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
                <SelectTrigger aria-label={t("common.labels.language")}>
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
                <SelectTrigger aria-label={t("components.historyPanel.sortBy")}>
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
                <SelectTrigger aria-label={t("components.historyPanel.filterBy")}>
                  <SelectValue placeholder={t("components.historyPanel.filterBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("components.historyPanel.allNotes")}</SelectItem>
                  <SelectItem value="has">{t("components.historyPanel.withNotes")}</SelectItem>
                  <SelectItem value="none">{t("components.historyPanel.withoutNotes")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={focusAreaFilter} onValueChange={setFocusAreaFilter}>
                <SelectTrigger aria-label={t("components.questionInterface.focusAreas")}>
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
              const accuracy = getAccuracyPercent(exercise)
              const results = getResultsArray(exercise)
              const correctAnswers = results.filter(result => result.is_correct).length
              const totalQuestions = results.length
              const date = new Date(exercise.createdAt)

              return (
                <Card key={exercise.id} className="glass-effect p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold truncate">{exercise.topic}</h3>
                        <Badge variant="outline">{exercise.difficulty}</Badge>
                        <Badge variant="outline">{exercise.language}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
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
                          <div className="text-sm text-gray-700">
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

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={isLoading || page <= 1}
            >
              <BilingualText translationKey="common.buttons.previous" />
            </Button>
            <span className="text-sm text-gray-600">
              {t("components.historyPanel.pageLabel", {
                values: { page, total: totalPages }
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={isLoading || !hasMore}
            >
              <BilingualText translationKey="common.buttons.next" />
            </Button>
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
