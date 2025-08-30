"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, LogOut, Book } from "lucide-react"
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

// 用户信息接口
interface UserInfo {
  id: string
  email: string
  name?: string | null
  isAdmin: boolean
  createdAt: string
}

// 自定义Hook用于用户认证管理
function useUserAuth() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const { toast } = useToast()

  // 检查用户登录状态
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setIsAuthenticated(true)
        setShowAuthDialog(false)
      } else {
        // 如果token无效，清除可能存在的cookie
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        setUser(null)
        setIsAuthenticated(false)
        setShowAuthDialog(true)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
      setIsAuthenticated(false)
      setShowAuthDialog(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 用户登录成功处理
  const handleUserAuthenticated = useCallback((userData: UserInfo) => {
    setUser(userData)
    setIsAuthenticated(true)
    setShowAuthDialog(false)

    toast({
      title: "登录成功",
      description: `欢迎，${userData.name || userData.email}！`,
    })
  }, [toast])

  // 用户登出处理
  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      setUser(null)
      setIsAuthenticated(false)
      setShowAuthDialog(true)

      toast({
        title: "已登出",
        description: "您已成功登出系统",
      })
    } catch (error) {
      console.error('Logout failed:', error)
      toast({
        title: "登出失败",
        description: "登出时发生错误，请刷新页面",
        variant: "destructive"
      })
    }
  }, [toast])

  // 初始化时检查登录状态
  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  return {
    user,
    isAuthenticated,
    isLoading,
    showAuthDialog,
    handleUserAuthenticated,
    handleLogout,
    checkAuthStatus
  }
}

export const MainApp = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    showAuthDialog,
    handleUserAuthenticated,
    handleLogout
  } = useUserAuth()

  const { toast } = useToast()

  // 原有状态
  const [step, setStep] = useState<"setup" | "listening" | "questions" | "results" | "history" | "wrong-answers" | "assessment" | "assessment-result">("setup")
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "">("")
  const [duration, setDuration] = useState<number>(120)
  const [language, setLanguage] = useState<ListeningLanguage>(DEFAULT_LANGUAGE)
  const [topic, setTopic] = useState<string>("")
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([])
  const [transcript, setTranscript] = useState<string>("")
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [audioError, setAudioError] = useState<boolean>(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingMessage, setLoadingMessage] = useState<string>("")
  const [canRegenerate, setCanRegenerate] = useState<boolean>(true)

  // Assessment 相关状态
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResultData | null>(null)

  const wordCount = useMemo(() => duration * 2, [duration])

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
        title: "话题生成成功",
        description: `已生成 ${topics.length} 个话题建议`,
      })
    } catch (error) {
      console.error("Failed to generate topics:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: "话题生成失败",
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
      toast({
        title: "听力材料生成成功",
        description: "现在可以生成音频了",
      })
      setStep("listening")
    } catch (error) {
      console.error("Failed to generate transcript:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: "听力材料生成失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [difficulty, wordCount, topic, language, toast])

  const handleGenerateAudio = useCallback(async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("Generating audio...")
    setAudioError(false)

    try {
      const url = await generateAudio(transcript, { language })
      setAudioUrl(url)
      toast({
        title: "音频生成成功",
        description: "音频已准备就绪",
      })
    } catch (error) {
      console.error("Failed to generate audio:", error)
      setAudioError(true)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: "音频生成失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [transcript, language, toast])

  const handleStartQuestions = useCallback(async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("Generating questions...")

    try {
      const generatedQuestions = await generateQuestions(difficulty, transcript, language, duration)
      setQuestions(generatedQuestions)
      setStep("questions")
      toast({
        title: "题目生成成功",
        description: `已生成 ${generatedQuestions.length} 道题目`,
      })
    } catch (error) {
      console.error("Failed to generate questions:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: "题目生成失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [transcript, difficulty, language, duration, toast])

  const handleSubmitAnswers = useCallback(async () => {
    if (!questions.length || Object.keys(answers).length !== questions.length) return

    setLoading(true)
    setLoadingMessage("Grading your answers...")

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
        title: "批改完成",
        description: "查看您的答题结果",
      })
    } catch (error) {
      console.error("Failed to grade answers:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: "批改失败",
        description: errorMessage,
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
        title: "导出成功",
        description: "练习结果已导出为文本文件",
      })
    } catch (error) {
      console.error("Failed to export:", error)
      toast({
        title: "导出失败",
        description: "导出时发生错误",
        variant: "destructive",
      })
    }
  }, [currentExercise, toast])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>加载中...</p>
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
            <p>请先登录以使用应用</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                English Listening Trainer
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {user?.name || user?.email}
                </span>
                {user?.isAdmin && (
                  <Badge variant="secondary" className="text-xs">
                    Admin
                  </Badge>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center space-x-2">
                <Button
                  variant={step === "setup" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("setup")}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  练习
                </Button>
                <Button
                  variant={step === "history" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("history")}
                >
                  <History className="w-4 h-4 mr-1" />
                  历史
                </Button>
                <Button
                  variant={step === "wrong-answers" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("wrong-answers")}
                >
                  <Book className="w-4 h-4 mr-1" />
                  错题本
                </Button>
                <Button
                  variant={step === "assessment" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStep("assessment")}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  评估
                </Button>
              </div>

              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

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
              <div className="max-w-2xl mx-auto">
                <Card className="glass-effect p-8">
                  <h2 className="text-2xl font-bold text-center mb-8">创建听力练习</h2>

                  <div className="space-y-6">
                    {/* Difficulty Selection */}
                    <div>
                      <Label htmlFor="difficulty" className="text-base font-medium">
                        Difficulty Level
                      </Label>
                      <Select value={difficulty} onValueChange={(value: DifficultyLevel) => setDifficulty(value)}>
                        <SelectTrigger className="glass-effect">
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
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            {loading ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 mr-1" />
                            )}
                            生成话题
                          </Button>
                        </div>

                        {suggestedTopics.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
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
