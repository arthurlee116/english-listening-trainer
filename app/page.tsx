"use client"

import React from "react"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { generateTopics, generateTranscript, generateQuestions, gradeAnswers } from "@/lib/ai-service"
import { generateAudio } from "@/lib/tts-service"
import { saveToHistory } from "@/lib/storage"
import { exportToTxt } from "@/lib/export"
import { HistoryPanel } from "@/components/history-panel"
import { WrongAnswersBook } from "@/components/wrong-answers-book"
import { AssessmentResult } from "@/components/assessment-result"
import { AssessmentInterface } from "@/components/assessment-interface"
import { AuthenticationGate } from "@/components/home/authentication-gate"
import { PracticeConfiguration } from "@/components/home/practice-configuration"
import { PracticeWorkspace } from "@/components/home/practice-workspace"
import { AppLayoutWithSidebar } from "@/components/app-layout-with-sidebar"
import { MobileSidebarWrapper } from "@/components/navigation/mobile-sidebar-wrapper"

import { AudioPlayerControls } from "@/components/audio-player"
import type { 
  Exercise, 
  Question, 
  DifficultyLevel, 
  AchievementNotification,
  NavigationAction,
} from "@/lib/types"
import { usePracticeSetup } from "@/hooks/use-practice-setup"
import { useAuthState, type AuthUserInfo } from "@/hooks/use-auth-state"
import { useLegacyMigration } from "@/hooks/use-legacy-migration"
import { 
  handlePracticeCompleted, 
  initializeAchievements, 
  migrateFromHistory 
} from "@/lib/achievement-service"
import { getHistory } from "@/lib/storage"

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
  
  // 使用状态来控制组件是否已在客户端挂载
  const [hasMounted, setHasMounted] = useState(false)
  
  // Legacy data migration hook - 在客户端挂载后安全执行
  const { migrationStatus } = useLegacyMigration()

  // Helper function to format bilingual toast messages with parameters
  const formatToastMessage = useCallback((key: string, params?: Record<string, string | number>): string => {
    if (!params) {
      return t(key)
    }

    return t(key, { values: params })
  }, [t])

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
  
  // Achievement 系统状态
  const [isGoalPanelOpen, setIsGoalPanelOpen] = useState<boolean>(false)
  const [newAchievements, setNewAchievements] = useState<AchievementNotification[]>([])

  const audioPlayerRef = useRef<AudioPlayerControls>(null)
  const exerciseStartTimeRef = useRef<number | null>(null)

  const {
    difficulty,
    setDifficulty,
    duration,
    setDuration,
    language,
    topic,
    setTopic,
    suggestedTopics,
    setSuggestedTopics,
    handleLanguageChange,
    wordCount,
    isSetupComplete,
  } = usePracticeSetup()
  




  // Network retry mechanism for API calls
  const _retryApiCall = useCallback(async (
    apiCall: () => Promise<unknown>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<unknown> => {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall()
      } catch (error) {
        lastError = error as Error
        console.warn(`API call attempt ${attempt} failed:`, error)
        
        if (attempt < maxRetries) {
          // Show retry notification on second attempt
          if (attempt === 2) {
            toast({
              title: t("messages.networkRetrying"),
              description: t("messages.networkRetryingDesc", { values: { attempt } }),
              variant: "default",
            })
          }
          
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
      }
    }
    
    // All retries failed
    toast({
      title: t("messages.networkError"),
      description: t("messages.networkErrorDesc"),
      variant: "destructive",
    })
    
    throw lastError!
  }, [toast, t])

  const topicInputRef = useRef<HTMLInputElement | null>(null)

  // Clean up legacy template storage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('english-listening-templates')
      }
    } catch (error) {
      console.error('Failed to clean up legacy template storage:', error)
    }
  }, [])



  // Initialize achievement system
  useEffect(() => {
    try {
      initializeAchievements()
      // Migrate historical data to achievement system if needed
      const history = getHistory()
      if (history.length > 0) {
        migrateFromHistory(history)
      }
    } catch (error) {
      console.error("Failed to initialize achievement system:", error)
    }
  }, [])

  // Display new achievement notifications
  useEffect(() => {
    newAchievements.forEach((notification) => {
      toast({
        title: t("achievements.notifications.achievementEarned.title"),
        description: t("achievements.notifications.achievementEarned.description", {
          values: { title: t(notification.achievement.titleKey) },
        }),
        duration: 5000,
      })
    })
    // Clear notifications after displaying
    if (newAchievements.length > 0) {
      setNewAchievements([])
    }
  }, [newAchievements, toast, t])

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





  // API request cache to avoid duplicate calls
  const apiRequestCache = useMemo(() => new Map<string, Promise<unknown>>(), [])



  // Cached API call wrapper to prevent duplicate requests
  const cachedApiCall = useCallback(async (
    cacheKey: string,
    apiCall: () => Promise<unknown>,
    ttl: number = 30000 // 30 seconds default TTL
  ): Promise<unknown> => {
    // Check if request is already in progress
    if (apiRequestCache.has(cacheKey)) {
      return apiRequestCache.get(cacheKey) as Promise<unknown>
    }

    // Create new request and cache it
    const promise = apiCall()
    apiRequestCache.set(cacheKey, promise)

    // Clear cache after TTL
    setTimeout(() => {
      apiRequestCache.delete(cacheKey)
    }, ttl)

    try {
      const result = await promise
      return result
    } catch (error) {
      // Remove failed request from cache immediately
      apiRequestCache.delete(cacheKey)
      throw error
    }
  }, [apiRequestCache])



  // 客户端挂载状态管理
  useEffect(() => {
    console.log('📱 页面组件挂载完成，设置 hasMounted = true')
    setHasMounted(true)
  }, [])

  // Enhanced memoized computations to avoid unnecessary re-renders
  // isSetupComplete is already provided by usePracticeSetup hook

  const handleApplySuggestion = useCallback((suggestion: {
    difficulty: string;
    topic: string;
    duration: number;
  }) => {
    setDifficulty(suggestion.difficulty as DifficultyLevel)
    setTopic(suggestion.topic)
    setDuration(suggestion.duration)
    toast({
      title: t("messages.recommendationApplied"),
      description: formatToastMessage("messages.recommendationAppliedDesc", {
        difficulty: suggestion.difficulty,
        topic: suggestion.topic,
      }),
    })
  }, [setDifficulty, setTopic, setDuration, toast, t, formatToastMessage])

  const _currentExerciseStats = useMemo(() => {
    if (!currentExercise) return null
    
    const correctCount = currentExercise.results.filter(result => result.is_correct).length
    const accuracy = correctCount / currentExercise.results.length
    
    return {
      totalQuestions: currentExercise.results.length,
      correctAnswers: correctCount,
      accuracy: Math.round(accuracy * 100),
      score: Math.round(accuracy * 100)
    }
  }, [currentExercise])

  const handleGenerateTopics = useCallback(async () => {
    if (!difficulty) return

    setLoading(true)
    setLoadingMessage("Generating topic suggestions...")

    try {
      const response = await cachedApiCall(
        `topics-${difficulty}-${wordCount}-${language}`,
        () => generateTopics(difficulty, wordCount, language),
        60000 // 1 minute cache for topics
      ) as { topics: string[]; degradationReason?: string }
      
      setSuggestedTopics(response.topics)
      
      toast({
        title: t("messages.topicGenerationSuccess"),
        description: formatToastMessage("messages.topicGenerationSuccessDesc", { count: response.topics.length }),
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
  }, [difficulty, wordCount, language, toast, cachedApiCall, t, formatToastMessage])

  const handleRefreshTopics = useCallback(async () => {
    if (!difficulty || suggestedTopics.length === 0) return

    setLoading(true)
    setLoadingMessage("Generating new topic suggestions...")

    try {
      // Pass current topics to avoid duplicates
      const response = await generateTopics(
        difficulty, 
        wordCount, 
        language, 
        undefined, 
        undefined,
        suggestedTopics
      )
      
      setSuggestedTopics(response.topics)
      
      toast({
        title: t("messages.topicGenerationSuccess"),
        description: formatToastMessage("messages.topicGenerationSuccessDesc", { count: response.topics.length }),
      })
    } catch (error) {
      console.error("Failed to refresh topics:", error)
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
  }, [difficulty, wordCount, language, suggestedTopics, toast, t, formatToastMessage])

  const handleGenerateTranscript = useCallback(async () => {
    if (!difficulty || !topic) return

    setLoading(true)
    setLoadingMessage("Generating listening transcript...")

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const response = await cachedApiCall(
          `transcript-${difficulty}-${wordCount}-${topic}-${language}`,
          () => generateTranscript(
            difficulty,
            wordCount,
            topic,
            language
          ),
          120000 // 2 minutes cache for transcripts
        ) as { transcript: string; degradationReason?: string }
        
        setTranscript(response.transcript)
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
      exerciseStartTimeRef.current = Date.now()
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
  }, [difficulty, topic, wordCount, language, toast, cachedApiCall, t])

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
      if (!exerciseStartTimeRef.current) {
        exerciseStartTimeRef.current = Date.now()
      }
      
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
      const transcriptHash = transcript.slice(0, 50)
      const cacheKey = `questions-${difficulty}-${transcriptHash}-${language}-${duration}`
      
      const response = await cachedApiCall(
        cacheKey,
        () => generateQuestions(
          difficulty, 
          transcript, 
          language, 
          duration
        ),
        180000 // 3 minutes cache for questions
      ) as { questions: Question[]; degradationReason?: string }
      
      setQuestions(response.questions)
      setAnswers({})
      setStep("questions")
      
      toast({
        title: t("messages.questionsGenerationSuccess"),
        description: formatToastMessage("messages.questionsGenerationSuccessDesc", { count: response.questions.length }),
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
  }, [transcript, difficulty, language, duration, toast, cachedApiCall, t, formatToastMessage])

  const handleSubmitAnswers = useCallback(async () => {
    if (questions.length === 0 || !user) return

    setLoading(true)
    setLoadingMessage("Grading your answers...")

    try {
      const gradingResponse = await gradeAnswers(transcript, questions, answers, language)
      const gradingResults = gradingResponse.results

      const now = Date.now()
      let practiceDurationSec: number

      if (audioDuration && audioDuration > 0) {
        practiceDurationSec = Math.round(audioDuration)
      } else if (duration && duration > 0) {
        practiceDurationSec = duration
      } else if (exerciseStartTimeRef.current) {
        const elapsedSeconds = Math.round((now - exerciseStartTimeRef.current) / 1000)
        practiceDurationSec = elapsedSeconds > 0 ? elapsedSeconds : 60
      } else {
        practiceDurationSec = 60
      }

      // Build Exercise object
      const exercise: Exercise = {
        id: Date.now().toString(),
        difficulty: difficulty as DifficultyLevel,
        language,
        topic,
        transcript,
        questions,
        answers,
        results: gradingResults,
        createdAt: new Date(now).toISOString(),
        ...(practiceDurationSec > 0 ? { totalDurationSec: practiceDurationSec } : {})
      }

      setCurrentExercise(exercise)
      saveToHistory(exercise)
      
      // Process achievement system updates
      try {
        const achievementResult = handlePracticeCompleted(exercise)
        
        // Set new achievements for notification display
        if (achievementResult.newAchievements.length > 0) {
          setNewAchievements(achievementResult.newAchievements)
        }
        
        // Display goal completion notifications
        if (achievementResult.goalProgress.daily.isCompleted) {
          toast({
            title: t("achievements.notifications.goalCompleted.title"),
            description: t("achievements.notifications.goalCompleted.dailyGoal", {
              values: { target: achievementResult.goalProgress.daily.target },
            }),
            duration: 5000,
          })
        }
        
        if (achievementResult.goalProgress.weekly.isCompleted) {
          toast({
            title: t("achievements.notifications.goalCompleted.title"),
            description: t("achievements.notifications.goalCompleted.weeklyGoal", {
              values: { target: achievementResult.goalProgress.weekly.target },
            }),
            duration: 5000,
          })
        }
      } catch (error) {
        console.error('Failed to process achievements:', error)
        // Don't block user flow, just log the error
      }
      
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
            duration: practiceDurationSec
          })
        })
      } catch (error) {
        console.error('Failed to save exercise to database:', error)
        // 不阻塞用户流程，只记录错误
      }
      
      setStep("results")
      exerciseStartTimeRef.current = null
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
  }, [questions, transcript, answers, difficulty, language, topic, user, toast, audioDuration, duration, t, formatToastMessage])

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
    exerciseStartTimeRef.current = null
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
    exerciseStartTimeRef.current = null
  }, [])



  // 如果正在加载认证状态或未完成客户端挂载，显示加载界面
  console.log(`🔄 渲染状态检查: isLoading=${isLoading}, hasMounted=${hasMounted}, isAuthenticated=${isAuthenticated}`)
  
  // Handle navigation actions from sidebar
  const handleNavigate = useCallback((action: NavigationAction) => {
    switch (action.type) {
      case 'setState':
        setStep(action.targetState as typeof step)
        break
      case 'callback':
        // Handle callback by name
        if (action.callbackName === 'handleLogout') {
          handleLogout()
        }
        // handleLanguageSwitch is handled in sidebar component directly
        break
      case 'external':
        window.open(action.href, action.openInNewTab ? '_blank' : '_self')
        break
    }
  }, [handleLogout])

  // 使用条件渲染代替提前返回，避免违反 Hooks 规则
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
    <AuthenticationGate
      isLoading={isLoading}
      hasMounted={hasMounted}
      isAuthenticated={isAuthenticated}
      showAuthDialog={showAuthDialog}
      onUserAuthenticated={handleUserAuthenticated}
    >
      {/* Mobile Sidebar Wrapper (visible only on mobile) */}
      <MobileSidebarWrapper
        currentStep={step}
        onNavigate={handleNavigate}
        assessmentResult={assessmentResult}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Desktop Layout with Sidebar */}
        <AppLayoutWithSidebar
          currentStep={step}
          onNavigate={handleNavigate}
          assessmentResult={assessmentResult}
        >
          <div className="container mx-auto px-4 py-8">
            {/* Main Header Panel - Reduced Title Size */}
            <div className="mb-8 flex justify-center">
              <div className="bg-slate-900/50 backdrop-blur rounded-3xl p-6 md:p-8 shadow-2xl max-w-5xl w-full">
                {/* Main Title Section */}
                <div className="text-center mb-6">
                  <div className="space-y-2 mb-4">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-sky-400 leading-tight" style={{maxWidth: '560px', margin: '0 auto', textWrap: 'balance'}}>
                      English Listening Trainer
                    </h1>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-sky-400 leading-tight" style={{maxWidth: '560px', margin: '0 auto', textWrap: 'balance'}}>
                      英语听力训练器
                    </h2>
                  </div>
                  <div className="text-base sm:text-lg text-slate-300 leading-relaxed">
                    <p className="mb-1">Make learning fun with bite-sized AI listening practice</p>
                    <p>轻松练听力，让 AI 帮你进步更有趣</p>
                  </div>
                </div>
                {/* Language Switcher Removed - Now in Sidebar */}
                <div />
              </div>
            </div>


        {step === "setup" && (
          <PracticeConfiguration
            practiceSetup={{
              difficulty,
              duration,
              language,
              topic,
              suggestedTopics,
              isSetupComplete,
              onDifficultyChange: setDifficulty,
              onDurationChange: setDuration,
              onLanguageChange: handleLanguageChange,
              onTopicChange: setTopic,
              topicInputRef,
            }}
            operations={{
              loading,
              loadingMessage,
              onGenerateTopics: handleGenerateTopics,
              onRefreshTopics: handleRefreshTopics,
              onGenerateExercise: handleGenerateTranscript,
            }}
            achievements={{
              isGoalPanelOpen,
              onToggleGoalPanel: () => setIsGoalPanelOpen((prev) => !prev),
              isAuthenticated,
            }}
            onApplySuggestion={handleApplySuggestion}
          />
        )}

            <PracticeWorkspace
              step={step}
              audioPlayerRef={audioPlayerRef}
              transcript={transcript}
              difficulty={difficulty}
              topic={topic}
              wordCount={wordCount}
              audioUrl={audioUrl}
              audioError={audioError}
              onGenerateAudio={handleGenerateAudio}
              onStartQuestions={handleStartQuestions}
              onRegenerate={handleGenerateTranscript}
              canRegenerate={canRegenerate}
              loading={loading}
              loadingMessage={loadingMessage}
              audioDuration={audioDuration}
              questions={questions}
              answers={answers}
              onAnswerChange={setAnswers}
              onSubmitAnswers={handleSubmitAnswers}
              currentExercise={currentExercise}
              onRestart={handleRestart}
              onExport={handleExport}
            />
          </div>
        </AppLayoutWithSidebar>

        <Toaster />
      </div>
    </AuthenticationGate>
  )
}

HomePage.displayName = "HomePage"

export default HomePage
