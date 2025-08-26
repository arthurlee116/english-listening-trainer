"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, Settings, LogOut, Book, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { AudioPlayer } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import { HistoryPanel } from "@/components/history-panel"
import { WrongAnswersBook } from "@/components/wrong-answers-book"
import { InvitationDialog } from "@/components/invitation-dialog"
import { generateTopics, generateTranscript, generateQuestions, gradeAnswers } from "@/lib/ai-service"
import { generateAudio } from "@/lib/tts-service"
import { saveToHistory } from "@/lib/storage"
import { exportToTxt } from "@/lib/export"
import { ThemeToggle } from "@/components/theme-toggle"
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "@/lib/language-config"
import type { Exercise, Question, DifficultyLevel, ListeningLanguage } from "@/lib/types"
import { mapCEFRToDifficulty } from "@/lib/difficulty-service"

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

// 自定义Hook用于邀请码管理
function useInvitationCode() {
  const [invitationCode, setInvitationCode] = useState<string>("")
  const [isInvitationVerified, setIsInvitationVerified] = useState<boolean>(false)
  const [usageInfo, setUsageInfo] = useState<{ todayUsage: number; remainingUsage: number }>({ todayUsage: 0, remainingUsage: 5 })
  const [showInvitationDialog, setShowInvitationDialog] = useState<boolean>(false)
  const [hasAssessment, setHasAssessment] = useState<boolean>(false)
  const [userDifficultyLevel, setUserDifficultyLevel] = useState<number | null>(null)
  const [isCheckingAssessment, setIsCheckingAssessment] = useState<boolean>(false)
  const { toast } = useToast()

  const checkInvitationCode = useCallback(async () => {
    const storedCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
    
    if (storedCode) {
      try {
        const response = await fetch(`/api/v1/invitation/check?code=${encodeURIComponent(storedCode)}`)
        const data = await response.json()
        
        if (response.ok) {
          setInvitationCode(data.data.code)
          setIsInvitationVerified(true)
          setUsageInfo({
            todayUsage: data.data.todayUsage,
            remainingUsage: data.data.remainingUsage
          })
          
          // 检查用户是否已完成难度评估
          await checkDifficultyAssessment(data.data.code)
        } else {
          localStorage.removeItem('invitation_code')
          sessionStorage.removeItem('invitation_code')
          setShowInvitationDialog(true)
        }
      } catch (error) {
        console.error('Failed to verify invitation code:', error)
        toast({
          title: "验证失败",
          description: "无法验证邀请码，请稍后重试",
          variant: "destructive",
        })
        setShowInvitationDialog(true)
      }
    } else {
      setShowInvitationDialog(true)
    }
  }, [toast])

  const checkDifficultyAssessment = useCallback(async (code: string) => {
    try {
      setIsCheckingAssessment(true)
      const response = await fetch(`/api/assessment/status?code=${encodeURIComponent(code)}`)
      const data = await response.json()
      
      if (response.ok) {
        setHasAssessment(data.data.hasAssessment)
        setUserDifficultyLevel(data.data.difficultyLevel)
        
        if (!data.data.hasAssessment) {
          toast({
            title: "需要完成难度评估",
            description: "请先完成听力难度测试以获得个性化练习内容",
          })
        }
      } else {
        console.error('Failed to check assessment status:', data.error)
      }
    } catch (error) {
      console.error('Failed to check difficulty assessment:', error)
    } finally {
      setIsCheckingAssessment(false)
    }
  }, [toast])

  const handleInvitationCodeVerified = useCallback(async (code: string, usage: { todayUsage: number; remainingUsage: number }) => {
    setInvitationCode(code)
    setIsInvitationVerified(true)
    setUsageInfo(usage)
    setShowInvitationDialog(false)
    
    // 检查难度评估状态
    await checkDifficultyAssessment(code)
  }, [checkDifficultyAssessment])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('invitation_code')
    sessionStorage.removeItem('invitation_code')
    setInvitationCode("")
    setIsInvitationVerified(false)
    setUsageInfo({ todayUsage: 0, remainingUsage: 5 })
    setHasAssessment(false)
    setUserDifficultyLevel(null)
    setShowInvitationDialog(true)
  }, [])

  const checkUsageLimit = useCallback(async (): Promise<boolean> => {
    if (usageInfo.remainingUsage <= 0) {
      toast({
        title: "使用次数已达上限",
        description: "今日使用次数已达上限（5次），请明天再来！",
        variant: "destructive",
      })
      return false
    }
    
    try {
      const response = await fetch('/api/v1/invitation/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: invitationCode })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setUsageInfo({
          todayUsage: data.data.todayUsage,
          remainingUsage: data.data.remainingUsage
        })
        return true
      } else {
        toast({
          title: "使用次数检查失败",
          description: data.error || '使用次数检查失败',
          variant: "destructive",
        })
        return false
      }
    } catch (error) {
      console.error('Failed to check usage limit:', error)
      toast({
        title: "网络错误",
        description: "使用次数检查失败，请稍后重试",
        variant: "destructive",
      })
      return false
    }
  }, [usageInfo.remainingUsage, invitationCode, toast])

  return {
    invitationCode,
    isInvitationVerified,
    usageInfo,
    showInvitationDialog,
    hasAssessment,
    userDifficultyLevel,
    isCheckingAssessment,
    checkInvitationCode,
    handleInvitationCodeVerified,
    handleLogout,
    checkUsageLimit,
    checkDifficultyAssessment
  }
}

export default function HomePage() {
  const {
    invitationCode,
    isInvitationVerified,
    usageInfo,
    showInvitationDialog,
    hasAssessment,
    userDifficultyLevel,
    isCheckingAssessment,
    checkInvitationCode,
    handleInvitationCodeVerified,
    handleLogout,
    checkUsageLimit,
    checkDifficultyAssessment
  } = useInvitationCode()

  const { toast } = useToast()

  // 原有状态
  const [step, setStep] = useState<"setup" | "listening" | "questions" | "results" | "history" | "wrong-answers">("setup")
  const [difficulty, setDifficulty] = useState<string>("")
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

  const wordCount = useMemo(() => duration * 2, [duration]) // 120 words per minute / 60 seconds = 2 words per second

  // 为下拉菜单拼接个性化难度区间 (Lmin~Lmax)
  const difficultyLevelsWithL = useMemo(() => {
    return DIFFICULTY_LEVELS.map(level => {
      const lRange = mapCEFRToDifficulty(level.value)
      return { ...level, label: `${level.label} (L${lRange.min}~L${lRange.max})` }
    })
  }, [])

  // 记忆化计算，避免不必要的重新渲染
  const isSetupComplete = useMemo(() => {
    return Boolean(difficulty && topic)
  }, [difficulty, topic])

  const canGenerateQuestions = useMemo(() => {
    return Boolean(transcript)
  }, [transcript])

  const canSubmitAnswers = useMemo(() => {
    return questions.length > 0 && Object.keys(answers).length === questions.length
  }, [questions, answers])

  // 检查邀请码
  useEffect(() => {
    checkInvitationCode()
  }, [checkInvitationCode])

  // 在自定义hook中已经处理了，这里删除重复的函数

  const handleGenerateTopics = useCallback(async () => {
    if (!difficulty) return

    setLoading(true)
    setLoadingMessage("Generating topic suggestions...")

    try {
      const topics = await generateTopics(difficulty, wordCount, language, userDifficultyLevel || undefined)
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
  }, [difficulty, wordCount, language, userDifficultyLevel, toast])

  const handleGenerateTranscript = useCallback(async () => {
    if (!difficulty || !topic) return

    // 检查使用次数限制
    const canUse = await checkUsageLimit()
    if (!canUse) return

    setLoading(true)
    setLoadingMessage("Generating listening transcript...")

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const generatedTranscript = await generateTranscript(difficulty, wordCount, topic, language, userDifficultyLevel || undefined)
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
        title: "听力材料生成成功",
        description: "已成功生成听力材料，请点击生成音频或直接开始答题",
      })
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
  }, [difficulty, topic, wordCount, language, userDifficultyLevel, checkUsageLimit, toast])

  const handleGenerateAudio = useCallback(async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("Generating audio...")
    setAudioError(false)

    try {
      console.log(`🎤 开始生成音频，文本长度: ${transcript.length}`)
      const audioUrl = await generateAudio(transcript, { language })
      console.log(`✅ 音频生成完成，URL: ${audioUrl}`)
      setAudioUrl(audioUrl)
      
      // 验证音频文件是否可访问
      try {
        const response = await fetch(audioUrl, { method: 'HEAD' })
        console.log(`📁 音频文件检查: ${response.status} ${response.statusText}`)
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          console.log(`📊 音频文件大小: ${contentLength} bytes`)
          toast({
            title: "音频生成成功",
            description: "音频已生成，现在可以播放练习音频了",
          })
        }
      } catch (fetchError) {
        console.warn(`⚠️ 无法验证音频文件:`, fetchError)
      }
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
      const generatedQuestions = await generateQuestions(difficulty, transcript, language, duration, userDifficultyLevel || undefined)
      setQuestions(generatedQuestions)
      setAnswers({})
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
  }, [transcript, difficulty, language, duration, userDifficultyLevel, toast])

  const handleSubmitAnswers = useCallback(async () => {
    if (questions.length === 0) return

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
      
      // 同步到数据库
      try {
        await fetch('/api/v1/exercises/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exercise,
            invitationCode
          })
        })
      } catch (error) {
        console.error('Failed to sync exercise to database:', error)
        // 不阻塞用户流程，只记录错误
      }
      
      setStep("results")
      toast({
        title: "答题完成",
        description: "已完成评分，查看您的成绩和详细分析",
      })
    } catch (error) {
      console.error("Grading failed:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: "评分失败",
        description: `${errorMessage}. 请重试`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }, [questions, transcript, answers, difficulty, language, topic, invitationCode, toast])

  const handleRestart = useCallback(() => {
    setStep("setup")
    setTopic("")
    setSuggestedTopics([])
    setTranscript("")
    setAudioUrl("")
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
        title: "导出成功",
        description: "练习结果已导出为文本文件",
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
    setAudioError(false)
    
    // 直接跳转到结果页面
    setStep("results")
  }, [])

  // 如果邀请码未验证，只显示验证对话框
  if (!isInvitationVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <InvitationDialog
          open={showInvitationDialog}
          onCodeVerified={handleInvitationCodeVerified}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              English Listening Trainer
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">AI-powered listening practice for K12 students</p>
          </div>
          <div className="flex items-center gap-4">
            {/* 用户信息 */}
            {isInvitationVerified && (
              <div className="flex items-center gap-2 bg-white dark:bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-gray-900 dark:text-gray-900">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-mono text-sm font-semibold">{invitationCode}</span>
                {hasAssessment && userDifficultyLevel && (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    L{userDifficultyLevel}
                  </Badge>
                )}
                <Badge 
                  variant={usageInfo.remainingUsage > 2 ? "secondary" : usageInfo.remainingUsage > 0 ? "default" : "destructive"}
                >
                  {usageInfo.remainingUsage}/5
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="p-1 h-6 w-6 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <ThemeToggle />
              {isInvitationVerified && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.open('/assessment', '_blank')} 
                  className="glass-effect"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {hasAssessment ? '重新测试' : '难度测试'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setStep("history")} className="glass-effect">
                <History className="w-4 h-4 mr-2" />
                History
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStep("wrong-answers")} className="glass-effect">
                <Book className="w-4 h-4 mr-2" />
                错题本
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open('/admin', '_blank')} className="glass-effect">
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
              <Button variant="outline" size="sm" onClick={handleFeedback} className="glass-effect bg-transparent">
                <MessageSquare className="w-4 h-4 mr-2" />
                Feedback
              </Button>
            </div>
          </div>
        </div>

        {/* Difficulty Assessment Reminder */}
        {isInvitationVerified && !hasAssessment && !isCheckingAssessment && (
          <div className="max-w-2xl mx-auto mb-6">
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
              <div className="p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                    需要完成难度评估
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                    为了获得最适合您水平的练习内容，请先完成听力难度测试。测试大约需要15分钟，包含5段不同难度的音频。
                  </p>
                  <Button 
                    onClick={() => window.open('/assessment', '_blank')} 
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    开始难度测试
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Setup Step */}
        {step === "setup" && (
          <div className="max-w-2xl mx-auto">
            <Card className="glass-effect p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold">Create Your Listening Exercise</h2>
                {hasAssessment && userDifficultyLevel && (
                  <Badge variant="secondary" className="ml-2">
                    个性化难度: L{userDifficultyLevel}
                  </Badge>
                )}
              </div>

              <div className="space-y-6">
                {/* Difficulty Selection */}
                <div>
                  <Label htmlFor="difficulty" className="text-base font-medium">
                    Difficulty Level
                  </Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Select difficulty level" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficultyLevelsWithL.map((level) => (
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
                    Listening Language
                  </Label>
                  <Select value={language} onValueChange={(value) => setLanguage(value as ListeningLanguage)}>
                    <SelectTrigger className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Select listening language" />
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
                    Duration
                  </Label>
                  <Select value={duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                    <SelectTrigger className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Select duration" />
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
                        Generate Topic Suggestions
                      </>
                    )}
                  </Button>
                )}

                {/* Suggested Topics */}
                {suggestedTopics.length > 0 && (
                  <div>
                    <Label className="text-base font-medium">Suggested Topics</Label>
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
      </div>
      <Toaster />
    </div>
  )
}
