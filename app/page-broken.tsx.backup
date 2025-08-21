"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, Settings, LogOut } from "lucide-react"
import { AudioPlayer } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import { HistoryPanel } from "@/components/history-panel"
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
  const [step, setStep] = useState<"setup" | "listening" | "questions" | "results" | "history">("setup")
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
    } catch (error) {
      const errorMessage = isError(error) ? error.message : String(error)
      alert(`AI output exception: ${errorMessage}. Please try again.`)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleAcceptTranscript = async () => {
    setCanRegenerate(false)
    setLoading(true)
    setLoadingMessage("Generating audio & questions...")

    // 并行请求
    const audioPromise = generateAudio(transcript)
      .then((audio) => {
        setAudioUrl(audio)
        setAudioError(false)
        return true
      })
      .catch((error) => {
        console.error("TTS failed:", error)
        setAudioError(true)
        return false
      })

    const questionPromise = generateQuestions(difficulty, transcript)
      .then((qs) => {
        setQuestions(qs)
        return true
      })
      .catch((error) => {
        console.error("Question generation failed:", error)
        const errorMessage = isError(error) ? error.message : String(error)
        alert(`Failed to generate questions: ${errorMessage}. Please try again.`)
        return false
      })

    const [_, questionsOk] = await Promise.all([audioPromise, questionPromise])

    if (questionsOk) {
      setStep("listening")
    }

    setLoading(false)
    setLoadingMessage("")
  }

  const handleRetryAudio = async () => {
    if (!transcript) return

    setLoading(true)
    setLoadingMessage("重新生成音频...")

    try {
      const audio = await generateAudio(transcript)
      setAudioUrl(audio)
      setAudioError(false)
    } catch (error) {
      console.error("TTS重试失败:", error)
      setAudioError(true)
    } finally {
      setLoading(false)
      setLoadingMessage("")
    }
  }

  const handleStartQuestions = () => {
    setStep("questions")
  }

  const handleSubmitAnswers = async () => {
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
          <HistoryPanel onBack={() => setStep("setup")} />
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
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm border">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-mono text-sm font-medium">{invitationCode}</span>
                <Badge variant={usageInfo.remainingUsage > 2 ? "secondary" : usageInfo.remainingUsage > 0 ? "default" : "destructive"}>
                  {usageInfo.remainingUsage}/5
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="p-1 h-6 w-6 text-gray-500 hover:text-red-600"
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

        {/* Setup Step */}
        {step === "setup" && (
          <Card className="glass-effect p-8 max-w-2xl mx-auto">
            <div className="space-y-6">
              <div>
                <Label htmlFor="difficulty" className="text-base font-medium">
                  Select Difficulty Level
                </Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose your level" />
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

              <div>
                <Label htmlFor="duration" className="text-base font-medium">
                  Listening Duration
                </Label>
                <Select value={duration.toString()} onValueChange={(value) => setDuration(Number(value))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
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

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="topic" className="text-base font-medium">
                    Topic or Keywords
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTopics}
                    disabled={!difficulty || loading}
                    className="glass-effect bg-transparent"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Suggest Topics
                  </Button>
                </div>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a topic or keywords..."
                  className="mt-2"
                />

                {suggestedTopics.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Suggested topics:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTopics.map((suggestedTopic, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => setTopic(suggestedTopic)}
                        >
                          {suggestedTopic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleGenerateTranscript}
                disabled={!difficulty || !topic || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {loadingMessage}
                  </>
                ) : (
                  "Generate Listening Exercise"
                )}
              </Button>

              {transcript && (
                <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-start mb-3">
                                          <h3 className="font-medium text-blue-900 dark:text-blue-100">Generated Transcript</h3>
                    {canRegenerate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateTranscript}
                        disabled={loading}
                        className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 bg-transparent"
                      >
                        Regenerate
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-4 leading-relaxed">{transcript}</p>
                  <Button
                    onClick={handleAcceptTranscript}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      "Accept & Continue"
                    )}
                  </Button>
                </Card>
              )}
            </div>
          </Card>
        )}

        {/* Listening Step */}
        {step === "listening" && (
          <div className="max-w-4xl mx-auto">
            <AudioPlayer
              audioUrl={audioUrl}
              audioError={audioError}
              transcript={transcript}
              onStartQuestions={handleStartQuestions}
              onRetryAudio={handleRetryAudio}
              loading={loading}
              loadingMessage={loadingMessage}
            />
          </div>
        )}

        {/* Questions Step */}
        {step === "questions" && (
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
