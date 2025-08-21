"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, Settings, LogOut, Book } from "lucide-react"
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
import type { Exercise, Question } from "@/lib/types"

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

export default function HomePage() {
  // 邀请码相关状态
  const [invitationCode, setInvitationCode] = useState<string>("")
  const [isInvitationVerified, setIsInvitationVerified] = useState<boolean>(false)
  const [usageInfo, setUsageInfo] = useState<{ todayUsage: number; remainingUsage: number }>({ todayUsage: 0, remainingUsage: 5 })
  const [showInvitationDialog, setShowInvitationDialog] = useState<boolean>(false)

  // 原有状态
  const [step, setStep] = useState<"setup" | "listening" | "questions" | "results" | "history" | "wrong-answers">("setup")
  const [difficulty, setDifficulty] = useState<string>("")
  const [duration, setDuration] = useState<number>(120)
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

  const wordCount = duration * 2 // 120 words per minute / 60 seconds = 2 words per second

  // 检查邀请码
  useEffect(() => {
    const checkInvitationCode = async () => {
      // 先检查本地存储
      const storedCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
      
      if (storedCode) {
        try {
          // 验证邀请码是否仍然有效
          const response = await fetch(`/api/invitation/check?code=${encodeURIComponent(storedCode)}`)
          const data = await response.json()
          
          if (response.ok) {
            setInvitationCode(data.code)
            setIsInvitationVerified(true)
            setUsageInfo({
              todayUsage: data.todayUsage,
              remainingUsage: data.remainingUsage
            })
          } else {
            // 邀请码无效，清除本地存储
            localStorage.removeItem('invitation_code')
            sessionStorage.removeItem('invitation_code')
            setShowInvitationDialog(true)
          }
        } catch (error) {
          console.error('Failed to verify invitation code:', error)
          setShowInvitationDialog(true)
        }
      } else {
        setShowInvitationDialog(true)
      }
    }
    
    checkInvitationCode()
  }, [])

  // 处理邀请码验证成功
  const handleInvitationCodeVerified = (code: string, usage: { todayUsage: number; remainingUsage: number }) => {
    setInvitationCode(code)
    setIsInvitationVerified(true)
    setUsageInfo(usage)
    setShowInvitationDialog(false)
  }

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('invitation_code')
    sessionStorage.removeItem('invitation_code')
    setInvitationCode("")
    setIsInvitationVerified(false)
    setUsageInfo({ todayUsage: 0, remainingUsage: 5 })
    setShowInvitationDialog(true)
    setStep("setup")
  }

  // 检查使用次数限制
  const checkUsageLimit = async (): Promise<boolean> => {
    if (usageInfo.remainingUsage <= 0) {
      alert('今日使用次数已达上限（5次），请明天再来！')
      return false
    }
    
    try {
      const response = await fetch('/api/invitation/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: invitationCode })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setUsageInfo({
          todayUsage: data.todayUsage,
          remainingUsage: data.remainingUsage
        })
        return true
      } else {
        alert(data.error || '使用次数检查失败')
        return false
      }
    } catch (error) {
      console.error('Failed to check usage limit:', error)
      alert('使用次数检查失败，请稍后重试')
      return false
    }
  }

  const handleGenerateTopics = async () => {
    if (!difficulty) return

    setLoading(true)
    setLoadingMessage("Generating topic suggestions...")

    try {
      const topics = await generateTopics(difficulty, wordCount)
      setSuggestedTopics(topics)
    } catch (error) {
      console.error("Failed to generate topics:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      alert(`Failed to generate topics: ${errorMessage}`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleGenerateTranscript = async () => {
    if (!difficulty || !topic) return

    // 检查使用次数限制
    const canUse = await checkUsageLimit()
    if (!canUse) return

    setLoading(true)
    setLoadingMessage("Generating listening transcript...")

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const generatedTranscript = await generateTranscript(difficulty, wordCount, topic)
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
    } catch (error) {
      console.error("Failed to generate transcript:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      alert(`Failed to generate transcript: ${errorMessage}`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleGenerateAudio = async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("Generating audio...")
    setAudioError(false)

    try {
      console.log(`🎤 开始生成音频，文本长度: ${transcript.length}`)
      const audioUrl = await generateAudio(transcript)
      console.log(`✅ 音频生成完成，URL: ${audioUrl}`)
      setAudioUrl(audioUrl)
      
      // 验证音频文件是否可访问
      try {
        const response = await fetch(audioUrl, { method: 'HEAD' })
        console.log(`📁 音频文件检查: ${response.status} ${response.statusText}`)
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          console.log(`📊 音频文件大小: ${contentLength} bytes`)
        }
      } catch (fetchError) {
        console.warn(`⚠️ 无法验证音频文件:`, fetchError)
      }
    } catch (error) {
      console.error("Failed to generate audio:", error)
      setAudioError(true)
      const errorMessage = isError(error) ? error.message : String(error)
      alert(`Failed to generate audio: ${errorMessage}`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleStartQuestions = async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("Generating questions...")

    try {
      const generatedQuestions = await generateQuestions(difficulty, transcript)
      setQuestions(generatedQuestions)
      setAnswers({})
      setStep("questions")
    } catch (error) {
      console.error("Failed to generate questions:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      alert(`Failed to generate questions: ${errorMessage}`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleSubmitAnswers = async () => {
    if (questions.length === 0) return

    setLoading(true)
    setLoadingMessage("Grading your answers...")

    try {
      const gradingResults = await gradeAnswers(transcript, questions, answers)

      const exercise: Exercise = {
        id: Date.now().toString(),
        difficulty,
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
        await fetch('/api/exercises/save', {
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
    } catch (error) {
      console.error("Grading failed:", error)
      const errorMessage = isError(error) ? error.message : String(error)
      alert(`Failed to grade answers: ${errorMessage}. Please try again.`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleRestart = () => {
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
  }

  const handleExport = () => {
    if (currentExercise) {
      exportToTxt(currentExercise)
    }
  }

  const handleFeedback = () => {
    const subject = encodeURIComponent("English Listening Trainer Feedback")
    const body = encodeURIComponent(`Page URL: ${window.location.href}\n\nFeedback:\n`)
    window.open(`mailto:laoli3699@qq.com?subject=${subject}&body=${body}`)
  }

  const handleRestoreExercise = (exercise: Exercise) => {
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
  }

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

        {/* Setup Step */}
        {step === "setup" && (
          <div className="max-w-2xl mx-auto">
            <Card className="glass-effect p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold">Create Your Listening Exercise</h2>
              </div>

              <div className="space-y-6">
                {/* Difficulty Selection */}
                <div>
                  <Label htmlFor="difficulty" className="text-base font-medium">
                    Difficulty Level
                  </Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="glass-effect">
                      <SelectValue placeholder="Select difficulty level" />
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

                {/* Duration Selection */}
                <div>
                  <Label htmlFor="duration" className="text-base font-medium">
                    Duration
                  </Label>
                  <Select value={duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                    <SelectTrigger className="glass-effect">
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
                  disabled={!difficulty || !topic || loading}
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
    </div>
  )
}
