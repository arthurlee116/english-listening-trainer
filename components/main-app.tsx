"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, LogOut, Book, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { AuthDialog } from "@/components/auth-dialog"
import { MigrationNotification } from "@/components/migration-notification"
import { generateTopics, generateTranscript, generateQuestions, gradeAnswers } from "@/lib/ai-service"
import { generateAudio } from "@/lib/tts-service"
import { saveToHistory } from "@/lib/storage"
import { exportToTxt } from "@/lib/export"
import { AudioPlayer } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import { HistoryPanel } from "@/components/history-panel"
import { WrongAnswersBook } from "@/components/wrong-answers-book"
import { AssessmentResult } from "@/components/assessment-result"
import { AssessmentInterface } from "@/components/assessment-interface"
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "@/lib/language-config"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useLegacyMigration } from "@/hooks/use-legacy-migration"
import type { Exercise, Question, DifficultyLevel, ListeningLanguage } from "@/lib/types"
import { useAuthState, type AuthUserInfo } from "@/hooks/use-auth-state"
import { useThemeClasses, combineThemeClasses } from "@/hooks/use-theme-classes"

interface AssessmentResultData {
  difficultyLevel: number;
  difficultyRange: {
    min: number;
    max: number;
    name: string;
    nameEn: string;
    description: string;
  };
  scores: number[];
  summary: string;
  details: Array<{
    audioId: number;
    topic: string;
    userScore: number;
    difficulty: number;
    performance: string;
  }>;
  recommendation: string;
}

const DIFFICULTY_LEVELS = [
  { value: "A1", label: "A1 - Beginner" },
  { value: "A2", label: "A2 - Elementary" },
  { value: "B1", label: "B1 - Intermediate" },
  { value: "B2", label: "B2 - Upper Intermediate" },
  { value: "C1", label: "C1 - Advanced" },
  { value: "C2", label: "C2 - Proficient" },
]

const DURATION_OPTIONS = [
  { value: 60, label: "1 minute (~120 words)" },
  { value: 120, label: "2 minutes (~240 words)" },
  { value: 180, label: "3 minutes (~360 words)" },
  { value: 300, label: "5 minutes (~600 words)" },
]

// Type guard for Error objects
function isError(error: unknown): error is Error {
  return error instanceof Error
}

export const MainApp = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    showAuthDialog,
    handleUserAuthenticated: setAuthenticatedUser,
    handleLogout: performLogout,
    checkAuthStatus
  } = useAuthState()

  const { toast } = useToast()
  const { t } = useBilingualText()
  const { shouldShowNotification } = useLegacyMigration()
  const { textClass, iconClass, borderClass } = useThemeClasses()

  const handleUserAuthenticated = useCallback((userData: AuthUserInfo, token: string) => {
    setAuthenticatedUser(userData, token)
    toast({
      title: t("common.messages.loginSuccess"),
      description: t("common.messages.welcomeUser", {
        values: { name: userData.name || userData.email },
      }),
    })
  }, [setAuthenticatedUser, toast, t])

  const handleLogout = useCallback(async () => {
    const success = await performLogout()
    toast({
      title: success ? t("common.messages.logoutSuccess") : t("common.messages.logoutFailed"),
      description: success ? t("common.messages.logoutSuccessDesc") : t("common.messages.logoutFailedDesc"),
      ...(success ? {} : { variant: "destructive" as const })
    })
  }, [performLogout, toast, t])

  // 原有状态
  const [step, setStep] = useState<"setup" | "listening" | "questions" | "results" | "history" | "wrong-answers" | "assessment" | "assessment-result">("setup")
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "">("")
  const [duration, setDuration] = useState<number>(120)
  const [language, setLanguage] = useState<ListeningLanguage>(DEFAULT_LANGUAGE)
  const [topic, setTopic] = useState<string>("")
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([])
  const [transcript, setTranscript] = useState<string>("")
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [audioError, setAudioError] = useState<boolean>(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingMessage, setLoadingMessage] = useState<string>("")
  const [canRegenerate, setCanRegenerate] = useState<boolean>(true)

  // Assessment 相关状态
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResultData | null>(null)
  const [assessmentCompletedAt, setAssessmentCompletedAt] = useState<string | null>(
    user?.assessmentCompletedAt ?? null
  )
  const [assessmentSyncing, setAssessmentSyncing] = useState(false)

  const wordCount = useMemo(() => duration * 2, [duration])

  useEffect(() => {
    setAssessmentCompletedAt(user?.assessmentCompletedAt ?? null)
  }, [user?.assessmentCompletedAt])

  const hasCompletedAssessment = Boolean(assessmentCompletedAt)
  const isAssessmentGateActive = isAuthenticated && !hasCompletedAssessment

  const persistAssessmentCompletion = useCallback(async () => {
    const completionTimestamp = new Date().toISOString()

    if (!isAuthenticated) {
      setAssessmentCompletedAt(completionTimestamp)
      toast({
        title: t("messages.assessmentCompleteTitle"),
        description: t("messages.assessmentCompleteDescription"),
      })
      return completionTimestamp
    }

    setAssessmentSyncing(true)

    try {
      const response = await fetch("/api/assessment/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentCompletedAt: completionTimestamp })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error ?? t("messages.assessmentSyncFailed"))
      }

      const data = await response.json() as { assessmentCompletedAt: string | null }
      const serverTimestamp = data.assessmentCompletedAt ?? completionTimestamp
      setAssessmentCompletedAt(serverTimestamp)

      toast({
        title: t("messages.assessmentCompleteTitle"),
        description: t("messages.assessmentCompleteDescription"),
      })

      void checkAuthStatus()

      return serverTimestamp
    } catch (error) {
      const message = error instanceof Error ? error.message : t("messages.assessmentSyncFailed")
      toast({
        title: t("messages.assessmentSyncFailed"),
        description: message,
        variant: "destructive",
      })
      return null
    } finally {
      setAssessmentSyncing(false)
    }
  }, [isAuthenticated, toast, t, checkAuthStatus])

  // 记忆化计算，避免不必要的重新渲染
  const isSetupComplete = useMemo(() => {
    return Boolean(difficulty && topic)
  }, [difficulty, topic])


  const handleGenerateTopics = useCallback(async () => {
    if (!difficulty) return

    if (isAssessmentGateActive) {
      toast({
        title: t("messages.assessmentRequiredTitle"),
        description: t("messages.assessmentRequiredDescription"),
      })
      return
    }

    setLoading(true)
    setLoadingMessage(t("common.messages.processing"))

    try {
      const response = await generateTopics(difficulty, wordCount, language)
      const topics = response?.topics || []
      setSuggestedTopics(topics)
      toast({
        title: t("common.messages.topicGenerationSuccess"),
        description: t("common.messages.topicGenerationSuccessDesc", {
          values: { count: topics.length },
        }),
      })
    } catch (error) {
      console.error("Failed to generate topics:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("common.messages.topicGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [difficulty, isAssessmentGateActive, wordCount, language, toast, t])

  const handleGenerateTranscript = useCallback(async () => {
    if (!difficulty || !topic) return

    if (isAssessmentGateActive) {
      toast({
        title: t("messages.assessmentRequiredTitle"),
        description: t("messages.assessmentRequiredDescription"),
      })
      return
    }

    setLoading(true)
    setLoadingMessage(t("common.messages.processing"))

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const response = await generateTranscript(difficulty, wordCount, topic, language)
        setTranscript(response?.transcript || "")
        setCanRegenerate(true)
      } catch (error) {
        console.error(`Transcript generation attempt ${attempt} failed:`, error)
        if (attempt < 3) {
          await attemptGeneration(attempt + 1)
        } else {
          throw new Error("AI output failed after 3 attempts")
        }
      }
    }

    try {
      await attemptGeneration(1)
      toast({
        title: t("common.messages.transcriptGenerationSuccess"),
        description: t("common.messages.transcriptGenerationSuccessDesc"),
      })
      setStep("listening")
    } catch (error) {
      console.error("Failed to generate transcript:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("common.messages.transcriptGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [difficulty, isAssessmentGateActive, wordCount, topic, language, toast, t])

  const handleGenerateAudio = useCallback(async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage(t("components.audioPlayer.loadingAudio"))
    setAudioError(false)
    setAudioDuration(null)

    try {
      const audioResult = await generateAudio(transcript, { language })
      setAudioUrl(audioResult.audioUrl)
      setAudioDuration(typeof audioResult.duration === 'number' ? audioResult.duration : null)
      toast({
        title: t("common.messages.audioGenerationSuccess"),
        description: t("common.messages.audioGenerationSuccessDesc"),
      })
    } catch (error) {
      console.error("Failed to generate audio:", error)
      setAudioError(true)
      setAudioDuration(null)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("common.messages.audioGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [transcript, language, toast])

  const handleStartQuestions = useCallback(async () => {
    if (!transcript || !difficulty) return

    if (isAssessmentGateActive) {
      toast({
        title: t("messages.assessmentRequiredTitle"),
        description: t("messages.assessmentRequiredDescription"),
      })
      return
    }

    setLoading(true)
    setLoadingMessage(t("common.messages.processing"))

    try {
      const response = await generateQuestions(difficulty, transcript, language, duration)
      const generatedQuestions = response?.questions || []
      setQuestions(generatedQuestions)
      setStep("questions")
      toast({
        title: t("common.messages.questionsGenerationSuccess"),
        description: t("common.messages.questionsGenerationSuccessDesc", {
          values: { count: generatedQuestions.length },
        }),
      })
    } catch (error) {
      console.error("Failed to generate questions:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("common.messages.questionsGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [transcript, difficulty, isAssessmentGateActive, language, duration, toast, t])

  const handleSubmitAnswers = useCallback(async () => {
    if (!questions.length || Object.keys(answers).length !== questions.length) return

    setLoading(true)
    setLoadingMessage(t("common.messages.processing"))

    try {
      const results = await gradeAnswers(transcript, questions, answers, language)
      const exercise: Exercise = {
        id: Date.now().toString(),
        difficulty: difficulty as DifficultyLevel,
        language,
        topic,
        transcript,
        questions,
        answers,
        results,
        createdAt: new Date().toISOString(),
      }

      setCurrentExercise(exercise)
      await saveToHistory(exercise)
      setStep("results")

      toast({
        title: t("common.messages.answersSubmissionSuccess"),
        description: t("common.messages.answersSubmissionSuccessDesc"),
      })
    } catch (error) {
      console.error("Failed to grade answers:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("common.messages.gradingFailed"),
        description: t("common.messages.gradingFailedDesc", {
          values: { error: errorMessage },
        }),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [questions, answers, difficulty, language, topic, transcript, toast])

  const handleRestart = useCallback(() => {
    setStep("setup")
    setTranscript("")
    setAudioUrl("")
    setAudioDuration(null)
    setQuestions([])
    setAnswers({})
    setCurrentExercise(null)
    setSuggestedTopics([])
    setAudioError(false)
    setCanRegenerate(true)
  }, [])

  const handleExport = useCallback(async () => {
    if (!currentExercise) return

    try {
      // 直接调用导出函数（内部已处理下载逻辑）
      exportToTxt(currentExercise)

      toast({
        title: t("common.messages.exportSuccess"),
        description: t("common.messages.exportSuccessDesc"),
      })
    } catch (error) {
      console.error("Failed to export:", error)
      toast({
        title: t("common.messages.error"),
        description: "导出时发生错误",
        variant: "destructive",
      })
    }
  }, [currentExercise, toast])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={combineThemeClasses("w-8 h-8 animate-spin mx-auto mb-4", iconClass('loading'))} />
          <h2 className="text-lg font-semibold mb-2">
            <BilingualText translationKey="messages.loadingApp" />
          </h2>
          <p className={combineThemeClasses(
            "text-gray-600 dark:text-gray-300",
            textClass('secondary')
          )}>
            <BilingualText translationKey="messages.verifyingLogin" />
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthDialog
          open={showAuthDialog}
          onUserAuthenticated={handleUserAuthenticated}
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className={combineThemeClasses(
              "text-gray-600 dark:text-gray-300",
              textClass('secondary')
            )}>
              <BilingualText en="Please log in to use the application" zh="请先登录以使用应用" />
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Header */}
      <header className={combineThemeClasses(
        "sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800",
        borderClass('default')
      )} role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className={combineThemeClasses(
                "text-xl font-bold text-gray-900 dark:text-white",
                textClass('primary')
              )}>
                <BilingualText translationKey="pages.home.title" />
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Menu */}
              <div className="flex items-center space-x-2" role="region" aria-label={t("labels.userMenu")}>
                <User className={combineThemeClasses("w-4 h-4", iconClass('nav'))} />
                <span className={combineThemeClasses(
                  "text-sm text-gray-700 dark:text-gray-300",
                  textClass('secondary')
                )}>
                  {user?.name || user?.email}
                </span>
                {user?.isAdmin && (
                  <Badge variant="secondary" className="text-xs">
                    <BilingualText translationKey="labels.administrator" />
                  </Badge>
                )}
              </div>

              {/* Navigation Buttons */}
              <nav className="flex items-center space-x-2" role="navigation" aria-label={t("labels.mainNavigation")}>
                <Button
                  variant={step === "setup" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("setup")}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  <BilingualText translationKey="buttons.practice" />
                </Button>
                <Button
                  variant={step === "history" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("history")}
                >
                  <History className="w-4 h-4 mr-1" />
                  <BilingualText translationKey="buttons.history" />
                </Button>
                <Button
                  variant={step === "wrong-answers" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("wrong-answers")}
                >
                  <Book className="w-4 h-4 mr-1" />
                  <BilingualText translationKey="buttons.wrongAnswersBook" />
                </Button>
                <Button
                  variant={step === "assessment" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("assessment")}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  <BilingualText translationKey="buttons.assessment" />
                </Button>
              </nav>

              <Button variant="ghost" size="sm" onClick={handleLogout} title={t("buttons.logout")} aria-label={t("buttons.logout")}> 
                <LogOut className="w-4 h-4 mr-1" />
                <BilingualText translationKey="buttons.logout" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Migration Notification */}
      {shouldShowNotification() && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <MigrationNotification />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* History Panel */}
        {step === "history" && (
          <HistoryPanel
            onBack={() => setStep("setup")}
            onRestore={(exercise) => {
              setCurrentExercise(exercise)
              setStep("results")
            }}
          />
        )}

        {/* Wrong Answers Book */}
        {step === "wrong-answers" && (
          <WrongAnswersBook onBack={() => setStep("setup")} />
        )}

        {/* Assessment */}
        {step === "assessment" && (
          <AssessmentInterface
            onBack={() => setStep("setup")}
            onComplete={(result) => {
              setAssessmentResult(result)
              void persistAssessmentCompletion()
              setStep("assessment-result")
            }}
          />
        )}

        {/* Assessment Result */}
        {step === "assessment-result" && assessmentResult && (
          <AssessmentResult
            result={assessmentResult}
            onReturnHome={() => {
              setStep("assessment")
              setAssessmentResult(null)
            }}
          />
        )}

        {/* Exercise Flow */}
        {step !== "history" && step !== "wrong-answers" && step !== "assessment" && step !== "assessment-result" && (
          <>
            {/* Setup Step */}
            {step === "setup" && (
              <div className="max-w-2xl mx-auto space-y-4">
                {isAssessmentGateActive && (
                  <Card className="border border-amber-400 bg-amber-50/80 dark:border-amber-500 dark:bg-amber-500/10">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                            <BilingualText translationKey="messages.assessmentRequiredTitle" />
                          </h3>
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            <BilingualText translationKey="messages.assessmentRequiredDescription" />
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setStep("assessment")}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          disabled={assessmentSyncing}
                        >
                          {assessmentSyncing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              <BilingualText translationKey="messages.processing" />
                            </>
                          ) : (
                            <BilingualText translationKey="buttons.assessment" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
                <Card className="glass-effect p-8">
                  <h2 className="text-2xl font-bold text-center mb-8">创建听力练习</h2>

                  <div className="space-y-6">
                    {/* Difficulty Selection */}
                    <div>
                      <Label htmlFor="difficulty" className="text-base font-medium">
                        Difficulty Level
                      </Label>
                      <Select value={difficulty} onValueChange={(value: DifficultyLevel) => setDifficulty(value)}>
                        <SelectTrigger id="difficulty" className="glass-effect">
                          <SelectValue placeholder="选择难度级别" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIFFICULTY_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language Selection */}
                    <div>
                      <Label htmlFor="language" className="text-base font-medium">
                        Language
                      </Label>
                      <Select value={language} onValueChange={(value: ListeningLanguage) => setLanguage(value)}>
                        <SelectTrigger className="glass-effect">
                          <SelectValue placeholder="选择语言" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Duration Selection */}
                    <div>
                      <Label htmlFor="duration" className="text-base font-medium">
                        Duration
                      </Label>
                      <Select value={duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                        <SelectTrigger className="glass-effect">
                          <SelectValue placeholder="选择时长" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Topic Generation */}
                    {difficulty && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-base font-medium">
                            Topic Suggestions
                          </Label>
                          <Button
                            onClick={handleGenerateTopics}
                            disabled={loading || isAssessmentGateActive}
                            variant="outline"
                            size="sm"
                          >
                            {loading ? (
                              <Loader2 className={combineThemeClasses("w-3 h-3 mr-1 animate-spin", iconClass('loading'))} />
                            ) : (
                              <Sparkles className={combineThemeClasses("w-3 h-3 mr-1", iconClass('secondary'))} />
                            )}
                            生成话题
                          </Button>
                        </div>

                        {suggestedTopics.length > 0 && (
                          <div>
                            <p className={combineThemeClasses(
                              "text-sm text-gray-600 dark:text-gray-400 mb-2",
                              textClass('tertiary')
                            )}>
                              点击选择一个话题：
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {suggestedTopics.map((suggestedTopic, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  className="glass-effect justify-start text-left h-auto py-3 px-4"
                                  onClick={() => setTopic(suggestedTopic)}
                                >
                                  <span className="text-sm">{suggestedTopic}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manual Topic Input */}
                    <div>
                      <Label htmlFor="topic" className="text-base font-medium">
                        Topic (or enter your own)
                      </Label>
                      <Input
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Enter a topic for your listening exercise"
                        className="glass-effect"
                      />
                    </div>

                    {/* Generate Exercise Button */}
                    <Button
                      onClick={handleGenerateTranscript}
                      disabled={!isSetupComplete || loading || isAssessmentGateActive}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className={combineThemeClasses("w-4 h-4 mr-2 animate-spin", iconClass('loading'))} />
                          {loadingMessage}
                        </>
                      ) : (
                        <>
                          <Sparkles className={combineThemeClasses("w-4 h-4 mr-2", iconClass('primary'))} />
                          Generate Listening Exercise
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* Listening Step */}
            {step === "listening" && (
              <div className="max-w-4xl mx-auto">
                <AudioPlayer
                  transcript={transcript}
                  difficulty={difficulty}
                  topic={topic}
                  wordCount={wordCount}
                  audioUrl={audioUrl}
                  audioError={audioError}
                  onGenerateAudio={handleGenerateAudio}
                  onStartQuestions={handleStartQuestions}
                  onRegenerate={canRegenerate ? handleGenerateTranscript : undefined}
                  loading={loading}
                  loadingMessage={loadingMessage}
                  initialDuration={audioDuration ?? undefined}
                  assessmentRequired={isAssessmentGateActive}
                />
              </div>
            )}

            {/* Questions Step */}
            {step === "questions" && questions.length > 0 && (
              <div className="max-w-4xl mx-auto">
                <QuestionInterface
                  questions={questions}
                  answers={answers}
                  onAnswerChange={setAnswers}
                  onSubmit={handleSubmitAnswers}
                  loading={loading}
                  loadingMessage={loadingMessage}
                  audioUrl={audioUrl}
                  transcript={transcript}
                  initialDuration={audioDuration ?? undefined}
                />
              </div>
            )}

            {/* Results Step */}
            {step === "results" && currentExercise && (
              <div className="max-w-4xl mx-auto">
                <ResultsDisplay exercise={currentExercise} onRestart={handleRestart} onExport={handleExport} />
              </div>
            )}
          </>
        )}
      </main>
      <Toaster />
    </div>
  )
}

MainApp.displayName = "MainApp"
