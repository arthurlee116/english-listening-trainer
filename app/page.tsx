"use client"

import React from "react"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, Settings, LogOut, Book } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { AuthDialog } from "@/components/auth-dialog"
import { generateTopics, generateTranscript, generateQuestions, gradeAnswers } from "@/lib/ai-service"
import { generateAudio } from "@/lib/tts-service"
import { saveToHistory } from "@/lib/storage"
import { exportToTxt } from "@/lib/export"
import { ThemeToggle } from "@/components/theme-toggle"
import { AudioPlayer } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import { HistoryPanel } from "@/components/history-panel"
import { WrongAnswersBook } from "@/components/wrong-answers-book"
import { AssessmentResult } from "@/components/assessment-result"
import { AssessmentInterface } from "@/components/assessment-interface"
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "@/lib/language-config"
import type { Exercise, Question, DifficultyLevel, ListeningLanguage } from "@/lib/types"
import { useAuthState, type AuthUserInfo } from "@/hooks/use-auth-state"
import { useLegacyMigration } from "@/hooks/use-legacy-migration"

const DIFFICULTY_LEVELS = [
  { value: "A1", labelKey: "difficultyLevels.A1" },
  { value: "A2", labelKey: "difficultyLevels.A2" },
  { value: "B1", labelKey: "difficultyLevels.B1" },
  { value: "B2", labelKey: "difficultyLevels.B2" },
  { value: "C1", labelKey: "difficultyLevels.C1" },
  { value: "C2", labelKey: "difficultyLevels.C2" },
]

// 等级与个性化难度范围映射（参考 `components/assessment-interface.tsx` 的区间定义）
const DIFFICULTY_RANGE_MAP: Record<DifficultyLevel, { min: number; max: number }> = {
  A1: { min: 1, max: 5 },
  A2: { min: 6, max: 10 },
  B1: { min: 11, max: 15 },
  B2: { min: 16, max: 20 },
  C1: { min: 21, max: 25 },
  C2: { min: 26, max: 30 },
}

const DURATION_OPTIONS = [
  { value: 60, labelKey: "durationOptions.1min" },
  { value: 120, labelKey: "durationOptions.2min" },
  { value: 180, labelKey: "durationOptions.3min" },
  { value: 300, labelKey: "durationOptions.5min" },
]

// Type guard for Error objects
function isError(error: unknown): error is Error {
  return error instanceof Error
}

// 评估结果类型
interface AssessmentResultType {
  difficultyLevel: number
  difficultyRange: {
    min: number
    max: number
    name: string
    nameEn: string
    description: string
  }
  scores: number[]
  summary: string
  details: Array<{
    audioId: number
    topic: string
    userScore: number
    difficulty: number
    performance: string
  }>
  recommendation: string
}

function HomePage() {
  const {
    user,
    isAuthenticated,
    isLoading,
    showAuthDialog,
    handleUserAuthenticated: setAuthenticatedUser,
    handleLogout: performLogout
  } = useAuthState()
  
  const { toast } = useToast()
  const { t } = useBilingualText()
  
  // Legacy data migration hook
  const { migrationStatus } = useLegacyMigration()

  // Helper function to format bilingual toast messages with parameters
  const formatToastMessage = (key: string, params?: Record<string, string | number>): string => {
    let message = t(key)
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        message = message.replace(`{${param}}`, String(value))
      })
    }
    return message
  }

  const handleUserAuthenticated = useCallback((userData: AuthUserInfo, token: string) => {
    setAuthenticatedUser(userData, token)
    toast({
      title: t("messages.loginSuccess"),
      description: formatToastMessage("messages.welcomeUser", { name: userData.name || userData.email }),
    })
  }, [formatToastMessage, setAuthenticatedUser, toast, t])

  const handleLogout = useCallback(async () => {
    const success = await performLogout()
    toast({
      title: success ? t("messages.logoutSuccess") : t("messages.logoutFailed"),
      description: success ? t("messages.logoutSuccessDesc") : t("messages.logoutFailedDesc"),
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
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResultType | null>(null)

  const wordCount = useMemo(() => duration * 2, [duration])

  // Handle legacy data migration status changes
  useEffect(() => {
    if (migrationStatus.isComplete && !migrationStatus.hasError && migrationStatus.imported) {
      toast({
        title: "Legacy Data Migrated",
        description: `Successfully migrated ${migrationStatus.imported.sessions} practice sessions to the database.`,
      })
    } else if (migrationStatus.isComplete && migrationStatus.hasError) {
      toast({
        title: "Migration Error",
        description: migrationStatus.message,
        variant: "destructive",
      })
    }
  }, [migrationStatus, toast])

  // 记忆化计算，避免不必要的重新渲染
  const isSetupComplete = useMemo(() => {
    return Boolean(difficulty && topic)
  }, [difficulty, topic])

  const handleGenerateTopics = useCallback(async () => {
    if (!difficulty) return

    setLoading(true)
    setLoadingMessage("Generating topic suggestions...")

    try {
      const topics = await generateTopics(difficulty, wordCount, language)
      setSuggestedTopics(topics)
      toast({
        title: t("messages.topicGenerationSuccess"),
        description: formatToastMessage("messages.topicGenerationSuccessDesc", { count: topics.length }),
      })
    } catch (error) {
      console.error("Failed to generate topics:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("messages.topicGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [difficulty, wordCount, language, toast])

  const handleGenerateTranscript = useCallback(async () => {
    if (!difficulty || !topic) return

    setLoading(true)
    setLoadingMessage("Generating listening transcript...")

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const generatedTranscript = await generateTranscript(difficulty, wordCount, topic, language)
        setTranscript(generatedTranscript)
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
      setStep("listening")
      toast({
        title: t("messages.transcriptGenerationSuccess"),
        description: t("messages.transcriptGenerationSuccessDesc"),
      })
    } catch (error) {
      console.error("Failed to generate transcript:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("messages.transcriptGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [difficulty, topic, wordCount, language, toast])

  const handleGenerateAudio = useCallback(async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("Generating audio...")
    setAudioError(false)
    setAudioDuration(null)

    try {
      console.log(`🎤 开始生成音频，文本长度: ${transcript.length}`)
      const audioResult = await generateAudio(transcript, { language })
      console.log(`✅ 音频生成完成，URL: ${audioResult.audioUrl}`)
      setAudioUrl(audioResult.audioUrl)
      
      // 立即设置音频时长，避免显示0:00的延迟
      const duration = typeof audioResult.duration === 'number' && audioResult.duration > 0 
        ? audioResult.duration 
        : null
      setAudioDuration(duration)
      
      // 如果时长不可用，尝试从音频元数据获取
      if (!duration && audioResult.audioUrl) {
        try {
          const response = await fetch(audioResult.audioUrl)
          if (response.ok) {
            const contentLength = response.headers.get('content-length')
            if (contentLength) {
              // 估算时长 (WAV格式，16kHz，16bit，单声道)
              const estimatedDuration = parseInt(contentLength) / (16000 * 2)
              setAudioDuration(Math.max(estimatedDuration, 1)) // 至少1秒
              console.log(`📊 估算音频时长: ${estimatedDuration.toFixed(1)}秒`)
            }
          }
        } catch (estimateError) {
          console.warn('⚠️ 无法估算音频时长:', estimateError)
        }
      }
      
      // 验证音频文件是否可访问
      try {
        const response = await fetch(audioResult.audioUrl, { method: 'HEAD' })
        console.log(`📁 音频文件检查: ${response.status} ${response.statusText}`)
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          console.log(`📊 音频文件大小: ${contentLength} bytes`)
          toast({
            title: t("messages.audioGenerationSuccess"),
            description: formatToastMessage("messages.audioGenerationSuccessDesc", { 
              duration: duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '未知'
            }),
          })
        }
      } catch (fetchError) {
        console.warn(`⚠️ 无法验证音频文件:`, fetchError)
      }
    } catch (error) {
      console.error("Failed to generate audio:", error)
      setAudioError(true)
      setAudioDuration(null)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("messages.audioGenerationFailed"),
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

    setLoading(true)
    setLoadingMessage("Generating questions...")

    try {
      const generatedQuestions = await generateQuestions(difficulty, transcript, language, duration)
      setQuestions(generatedQuestions)
      setAnswers({})
      setStep("questions")
      toast({
        title: t("messages.questionsGenerationSuccess"),
        description: formatToastMessage("messages.questionsGenerationSuccessDesc", { count: generatedQuestions.length }),
      })
    } catch (error) {
      console.error("Failed to generate questions:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("messages.questionsGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [transcript, difficulty, language, duration, toast])

  const handleSubmitAnswers = useCallback(async () => {
    if (questions.length === 0 || !user) return

    setLoading(true)
    setLoadingMessage("Grading your answers...")

    try {
      const gradingResults = await gradeAnswers(transcript, questions, answers, language)

      const exercise: Exercise = {
        id: Date.now().toString(),
        difficulty: difficulty as DifficultyLevel,
        language,
        topic,
        transcript,
        questions,
        answers,
        results: gradingResults,
        createdAt: new Date().toISOString(),
      }

      setCurrentExercise(exercise)
      saveToHistory(exercise)
      
      // 保存练习记录到数据库
      try {
        // 计算准确率和得分
        const correctCount = gradingResults.filter(result => result.is_correct).length
        const accuracy = correctCount / gradingResults.length
        const score = Math.round(accuracy * 100)

        await fetch('/api/practice/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            exerciseData: exercise,
            difficulty: difficulty,
            language: language,
            topic: topic,
            accuracy: accuracy,
            score: score,
            duration: Math.round((Date.now() - new Date(exercise.createdAt).getTime()) / 1000)
          })
        })
      } catch (error) {
        console.error('Failed to save exercise to database:', error)
        // 不阻塞用户流程，只记录错误
      }
      
      setStep("results")
      toast({
        title: t("messages.answersSubmissionSuccess"),
        description: t("messages.answersSubmissionSuccessDesc"),
      })
    } catch (error) {
      console.error("Grading failed:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("messages.gradingFailed"),
        description: formatToastMessage("messages.gradingFailedDesc", { error: errorMessage }),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [questions, transcript, answers, difficulty, language, topic, user, toast])

  const handleRestart = useCallback(() => {
    setStep("setup")
    setTopic("")
    setSuggestedTopics([])
    setTranscript("")
    setAudioUrl("")
    setAudioDuration(null)
    setAudioError(false)
    setQuestions([])
    setAnswers({})
    setCurrentExercise(null)
    setCanRegenerate(true)
  }, [])

  const handleExport = useCallback(() => {
    if (currentExercise) {
      exportToTxt(currentExercise)
      toast({
        title: t("messages.exportSuccess"),
        description: t("messages.exportSuccessDesc"),
      })
    }
  }, [currentExercise, toast])

  const handleFeedback = useCallback(() => {
    const subject = encodeURIComponent("English Listening Trainer Feedback")
    const body = encodeURIComponent(`Page URL: ${window.location.href}\n\nFeedback:\n`)
    window.open(`mailto:laoli3699@qq.com?subject=${subject}&body=${body}`)
  }, [])

  const handleRestoreExercise = useCallback((exercise: Exercise) => {
    // 恢复所有练习相关的状态
    setDifficulty(exercise.difficulty)
    setTopic(exercise.topic)
    setTranscript(exercise.transcript)
    setQuestions(exercise.questions)
    setCurrentExercise(exercise)
    
    // 恢复用户答案
    const restoredAnswers: Record<number, string> = {}
    exercise.results.forEach((result, index) => {
      // 使用question_id或者索引作为键
      const key = result.question_id ?? index
      restoredAnswers[key] = result.user_answer || ""
    })
    setAnswers(restoredAnswers)
    
    // 清除音频相关状态（历史记录中没有保存音频）
    setAudioUrl("")
    setAudioDuration(null)
    setAudioError(false)
    
    // 直接跳转到结果页面
    setStep("results")
  }, [])

  // 如果正在加载认证状态，显示加载界面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-semibold mb-2">
            <BilingualText translationKey="messages.loadingApp" />
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            <BilingualText translationKey="messages.verifyingLogin" />
          </p>
        </Card>
      </div>
    )
  }

  // 如果用户未认证，显示认证对话框
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <AuthDialog
          open={showAuthDialog}
          onUserAuthenticated={handleUserAuthenticated}
        />
      </div>
    )
  }

  if (step === "history") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <HistoryPanel 
            onBack={() => setStep("setup")} 
            onRestore={handleRestoreExercise}
          />
        </div>
      </div>
    )
  }

  if (step === "wrong-answers") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <WrongAnswersBook onBack={() => setStep("setup")} />
        </div>
      </div>
    )
  }

  if (step === "assessment") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <AssessmentInterface 
            onBack={() => setStep("setup")}
            onComplete={(result) => {
              setAssessmentResult(result)
              setStep("assessment-result")
            }}
          />
        </div>
      </div>
    )
  }

  if (step === "assessment-result" && assessmentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <AssessmentResult 
            result={assessmentResult}
            onReturnHome={() => setStep("setup")}
            onRetry={() => {
              setAssessmentResult(null)
              setStep("assessment")
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8" role="banner">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <BilingualText translationKey="pages.home.title" />
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              <BilingualText translationKey="pages.home.subtitle" />
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* User Menu */}
            {isAuthenticated && user && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm border border-gray-200" role="region" aria-label={t("labels.userMenu")}>
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">{user.name || user.email}</span>
                {user.isAdmin && (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <BilingualText translationKey="labels.administrator" />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="p-1 h-6 w-6 text-gray-500 hover:text-red-600"
                  title={t("buttons.logout")}
                  aria-label={t("buttons.logout")}
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              </div>
            )}
            {/* Personalized Difficulty Badge */}
            {assessmentResult && (
              <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                <BilingualText translationKey="labels.personalizedDifficulty" />：{assessmentResult.difficultyRange.name}
                <span className="ml-1">({assessmentResult.difficultyRange.min}-{assessmentResult.difficultyRange.max})</span>
              </Badge>
            )}
            {/* Main Navigation */}
            <nav className="flex gap-2" role="navigation" aria-label={t("labels.mainNavigation")}>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => setStep("assessment")} className="glass-effect">
                <Sparkles className="w-4 h-4 mr-2" />
                <BilingualText translationKey="buttons.assessment" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStep("history")} className="glass-effect">
                <History className="w-4 h-4 mr-2" />
                <BilingualText translationKey="buttons.history" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStep("wrong-answers")} className="glass-effect">
                <Book className="w-4 h-4 mr-2" />
                <BilingualText translationKey="buttons.wrongAnswersBook" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open('/admin', '_blank')} className="glass-effect">
                <Settings className="w-4 h-4 mr-2" />
                <BilingualText translationKey="buttons.admin" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleFeedback} className="glass-effect bg-transparent">
                <MessageSquare className="w-4 h-4 mr-2" />
                <BilingualText translationKey="buttons.feedback" />
              </Button>
            </nav>
          </div>
        </header>

        {/* Setup Step */}
        {step === "setup" && (
          <div className="max-w-2xl mx-auto">
            <Card className="glass-effect p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold">
                  <BilingualText translationKey="labels.createExercise" />
                </h2>
              </div>

              <div className="space-y-6">
                {/* Difficulty Selection */}
                <div>
                  <Label htmlFor="difficulty" className="text-base font-medium">
                    <BilingualText translationKey="labels.difficulty" />
                  </Label>
                  <Select value={difficulty} onValueChange={(value) => setDifficulty(value as DifficultyLevel | "")}>
                    <SelectTrigger className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder={t("labels.selectDifficulty")} />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <BilingualText translationKey={level.labelKey} />
                          {" "}
                          <span className="text-xs text-gray-500">
                            ({DIFFICULTY_RANGE_MAP[level.value as DifficultyLevel].min}-{DIFFICULTY_RANGE_MAP[level.value as DifficultyLevel].max})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Language Selection */}
                <div>
                  <Label htmlFor="language" className="text-base font-medium">
                    <BilingualText translationKey="labels.listeningLanguage" />
                  </Label>
                  <Select value={language} onValueChange={(value) => setLanguage(value as ListeningLanguage)}>
                    <SelectTrigger className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder={t("labels.selectLanguage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration Selection */}
                <div>
                  <Label htmlFor="duration" className="text-base font-medium">
                    <BilingualText translationKey="labels.duration" />
                  </Label>
                  <Select value={duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                    <SelectTrigger className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder={t("labels.selectDuration")} />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          <BilingualText translationKey={option.labelKey} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate Topics Button */}
                {difficulty && (
                  <Button
                    onClick={handleGenerateTopics}
                    disabled={loading}
                    className="w-full glass-effect"
                    variant="outline"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        <BilingualText translationKey="buttons.generateTopicSuggestions" />
                      </>
                    )}
                  </Button>
                )}

                {/* Suggested Topics */}
                {suggestedTopics.length > 0 && (
                  <div>
                    <Label className="text-base font-medium">
                      <BilingualText translationKey="labels.suggestedTopics" />
                    </Label>
                    <div className="grid grid-cols-1 gap-2 mt-2">
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

                {/* Manual Topic Input */}
                <div>
                  <Label htmlFor="topic" className="text-base font-medium">
                    <BilingualText translationKey="labels.manualTopic" />
                  </Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t("placeholders.enterTopic")}
                    className="glass-effect"
                  />
                </div>

                {/* Generate Exercise Button */}
                <Button
                  onClick={handleGenerateTranscript}
                  disabled={!isSetupComplete || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {loadingMessage}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      <BilingualText translationKey="buttons.generateListeningExercise" />
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
      </div>
      <Toaster />
    </div>
  )
}

HomePage.displayName = "HomePage"

export default HomePage
