"use client"

import React from "react"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import { Loader2, Sparkles, History, MessageSquare, User, Settings, LogOut, Book, Keyboard } from "lucide-react"
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
import { AchievementPanel } from "@/components/achievement-panel"
import { ShortcutHelpDialog, ShortcutOnboardingDialog } from "@/components/shortcut-help-dialog"
import { useHotkeys, useShortcutSettings, type ShortcutHandler } from "@/hooks/use-hotkeys"
import { AudioPlayerControls } from "@/components/audio-player"
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE, isLanguageSupported } from "@/lib/language-config"
import type { 
  Exercise, 
  Question, 
  DifficultyLevel, 
  ListeningLanguage, 
  PracticeTemplate, 
  AchievementNotification,
  FocusArea,
  FocusAreaStats,
  FocusCoverage,
  SpecializedPreset,
  GradingResult,
  WrongAnswerItem
} from "@/lib/types"
import { FOCUS_AREA_LIST } from "@/lib/types"
import { getTemplates, saveTemplate, deleteTemplate, renameTemplate } from "@/lib/template-storage"
import { useAuthState, type AuthUserInfo } from "@/hooks/use-auth-state"
import { useLegacyMigration } from "@/hooks/use-legacy-migration"
import { 
  handlePracticeCompleted, 
  initializeAchievements, 
  migrateFromHistory 
} from "@/lib/achievement-service"
import { getHistory } from "@/lib/storage"
import { 
  computeFocusStats, 
  selectRecommendedFocusAreas, 
  getDefaultStats, 
  getDefaultRecommendations,
  type PracticeSession 
} from "@/lib/focus-metrics"

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
  const formatToastMessage = useCallback((key: string, params?: Record<string, string | number>): string => {
    let message = t(key)
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        message = message.replace(`{${param}}`, String(value))
      })
    }
    return message
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
  const [templates, setTemplates] = useState<PracticeTemplate[]>([])
  const [templateOpLoadingId, setTemplateOpLoadingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState<string>("")
  const topicInputRef = useRef<HTMLInputElement>(null)
  
  // Achievement 系统状态
  const [isGoalPanelOpen, setIsGoalPanelOpen] = useState<boolean>(false)
  const [newAchievements, setNewAchievements] = useState<AchievementNotification[]>([])

  // 专项练习模式状态
  const [isSpecializedMode, setIsSpecializedMode] = useState<boolean>(false)
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<FocusArea[]>([])
  const [recommendedFocusAreas, setRecommendedFocusAreas] = useState<FocusArea[]>([])
  
  // 统计和分析状态
  const [focusAreaStats, setFocusAreaStats] = useState<FocusAreaStats>({})
  const [focusCoverage, setFocusCoverage] = useState<FocusCoverage | null>(null)
  
  // 快捷键相关状态
  const [showShortcutHelp, setShowShortcutHelp] = useState<boolean>(false)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)
  const audioPlayerRef = useRef<AudioPlayerControls>(null)
  const exerciseStartTimeRef = useRef<number | null>(null)
  
  // 快捷键设置
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled, onboarded, setOnboarded } = useShortcutSettings()
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false)
  
  // Enhanced loading states for better UX
  const [loadingStates, setLoadingStates] = useState({
    computingStats: false,
    generatingRecommendations: false,
    savingPreset: false,
    loadingPreset: false,
    clearingCache: false
  })
  
  // Progress tracking for large data operations
  const [progressInfo, setProgressInfo] = useState<{
    operation: string
    current: number
    total: number
    message: string
  } | null>(null)
  
  // 预设管理状态
  const [specializedPresets, setSpecializedPresets] = useState<SpecializedPreset[]>([])

  // Loading state management helpers
  const updateLoadingState = useCallback((key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateProgress = useCallback((
    operation: string,
    current: number,
    total: number,
    message: string = ''
  ) => {
    setProgressInfo({ operation, current, total, message })
  }, [])

  const clearProgress = useCallback(() => {
    setProgressInfo(null)
  }, [])

  // Cache management for focus area data
  const getCachedFocusData = useCallback(() => {
    try {
      const cacheKey = 'english-listening-focus-area-cache'
      const cached = localStorage.getItem(cacheKey)
      if (!cached) return null

      const data = JSON.parse(cached)
      const cacheAge = Date.now() - new Date(data.lastCalculated).getTime()
      const maxCacheAge = 10 * 60 * 1000 // 10 minutes

      if (cacheAge > maxCacheAge) {
        localStorage.removeItem(cacheKey)
        return null
      }

      return data
    } catch (error) {
      console.error('Failed to read focus area cache:', error)
      return null
    }
  }, [])

  const setCachedFocusData = useCallback((stats: FocusAreaStats, recommendations: FocusArea[]) => {
    try {
      const cacheKey = 'english-listening-focus-area-cache'
      const data = {
        stats,
        recommendations,
        lastCalculated: new Date().toISOString(),
        dataVersion: '1.0'
      }
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to cache focus area data:', error)
    }
  }, [])

  // 记录用户标签偏好用于后续推荐
  const recordUserIntent = useCallback((focusAreas: FocusArea[]) => {
    try {
      const storageKey = 'english-listening-user-intent'
      const existingData = localStorage.getItem(storageKey)
      let intentData: { 
        preferences: Record<string, number>
        lastUpdated: string 
      } = {
        preferences: {},
        lastUpdated: new Date().toISOString()
      }

      if (existingData) {
        try {
          intentData = JSON.parse(existingData)
        } catch (error) {
          console.warn('Failed to parse user intent data, using defaults', error)
        }
      }

      // Increment preference count for each selected focus area
      focusAreas.forEach(area => {
        intentData.preferences[area] = (intentData.preferences[area] || 0) + 1
      })

      intentData.lastUpdated = new Date().toISOString()
      localStorage.setItem(storageKey, JSON.stringify(intentData))
      
      console.log('Recorded user intent for focus areas:', focusAreas)
    } catch (error) {
      console.warn('Failed to record user intent:', error)
    }
  }, [])

  // Handle language change with specialized mode reset
  const handleLanguageChange = useCallback((newLanguage: ListeningLanguage) => {
    setLanguage(newLanguage)

    // Reset specialized mode selections when language changes
    if (isSpecializedMode) {
      setSelectedFocusAreas([])
      setFocusCoverage(null)

      // Recalculate recommendations for the new language context
      // This will trigger the useEffect that loads focus area data
      setIsLoadingRecommendations(true)

      toast({
        title: t("messages.languageChanged"),
        description: t("messages.languageChangedDesc"),
        variant: "default",
      })
    }
  }, [isSpecializedMode, toast, t])

  // Safe localStorage operations with error handling
  const safeLocalStorageGet = useCallback((key: string, defaultValue: unknown = null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage not available')
        return defaultValue
      }
      
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.warn(`Failed to read from localStorage key "${key}":`, error)
      return defaultValue
    }
  }, [])

  const safeLocalStorageSet = useCallback((key: string, value: unknown) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage not available, cannot save data')
        return false
      }
      
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.warn(`Failed to write to localStorage key "${key}":`, error)
      
      // Show user-friendly message for storage issues
      toast({
        title: t("messages.storageError"),
        description: t("messages.storageErrorDesc"),
        variant: "default",
      })
      return false
    }
  }, [toast, t])

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
              description: t("messages.networkRetryingDesc").replace('{attempt}', attempt.toString()),
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

  const wordCount = useMemo(() => duration * 2, [duration])

  useEffect(() => {
    const storageAvailable = typeof window !== 'undefined' && !!window.localStorage
    if (!storageAvailable) {
      toast({ title: t("pages.templates.unavailable"), description: "", variant: "destructive" })
      return
    }
    const list = getTemplates()
    setTemplates(list)
    
    // 加载专项练习预设
    try {
      const storageKey = 'english-listening-specialized-presets'
      const savedPresets = JSON.parse(localStorage.getItem(storageKey) || '[]') as SpecializedPreset[]
      setSpecializedPresets(savedPresets)
    } catch (error) {
      console.error('Failed to load specialized presets:', error)
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
        description: t("achievements.notifications.achievementEarned.description").replace(
          "{title}", 
          t(notification.achievement.titleKey)
        ),
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

  // Enhanced focus area data loading with progress tracking
  const loadFocusAreaData = useCallback(async () => {
    if (!isAuthenticated || !user) {
      // For unauthenticated users, use default stats
      setFocusAreaStats(getDefaultStats())
      setRecommendedFocusAreas(getDefaultRecommendations())
      return
    }

    setIsLoadingRecommendations(true)
    updateLoadingState('computingStats', true)
    updateProgress('loadingData', 0, 4, 'Checking cache...')
    
    // Try to load from cache first
    const cachedData = getCachedFocusData()
    if (cachedData) {
      setFocusAreaStats(cachedData.stats)
      setRecommendedFocusAreas(cachedData.recommendations)
      setIsLoadingRecommendations(false)
      updateLoadingState('computingStats', false)
      clearProgress()
      return
    }

    updateProgress('loadingData', 1, 4, 'Loading practice data...')
      
      try {
        // Load wrong answers and practice sessions from API
        const [wrongAnswersResponse, practiceHistoryResponse] = await Promise.all([
          fetch('/api/wrong-answers/list', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          }),
          fetch('/api/practice/history', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          })
        ])

        updateProgress('loadingData', 2, 4, 'Processing practice data...')

        let wrongAnswers: WrongAnswerItem[] = []
        let practiceHistory: PracticeSession[] = []

        if (wrongAnswersResponse.ok) {
          const wrongAnswersData = await wrongAnswersResponse.json()
          wrongAnswers = wrongAnswersData.wrongAnswers || []
        }

        if (practiceHistoryResponse.ok) {
          const practiceData = await practiceHistoryResponse.json()
          practiceHistory = practiceData.sessions || []
        }

        updateProgress('loadingData', 3, 4, `Computing statistics for ${wrongAnswers.length} wrong answers...`)

        // Compute focus area statistics with progress tracking
        const stats = computeFocusStats(wrongAnswers, practiceHistory)
        setFocusAreaStats(stats)

        updateLoadingState('generatingRecommendations', true)
        updateProgress('loadingData', 4, 4, 'Generating recommendations...')

        // Check if we have meaningful data for recommendations
        const hasWrongAnswers = wrongAnswers.length > 0
        const hasSpecializedSessions = practiceHistory.some(session => {
          try {
            const exerciseData = typeof session.exerciseData === 'string'
              ? JSON.parse(session.exerciseData)
              : session.exerciseData
            return exerciseData?.specializedMode === true
          } catch {
            return false
          }
        })

        // Generate recommendations based on statistics or use defaults
        let recommendations: FocusArea[]
        let showNoDataMessage = false

        if (hasWrongAnswers || hasSpecializedSessions) {
          recommendations = selectRecommendedFocusAreas(stats, 3)
          
          // If no recommendations from analysis, still show message about no weak areas
          if (recommendations.length === 0) {
            recommendations = getDefaultRecommendations()
            toast({
              title: t("messages.noWeakAreasFound"),
              description: t("messages.noWeakAreasFoundDesc"),
              variant: "default",
            })
          }
        } else {
          // No meaningful data available, use defaults and show guidance
          recommendations = getDefaultRecommendations()
          showNoDataMessage = true
        }

        setRecommendedFocusAreas(recommendations)

        // Show guidance message for new users
        if (showNoDataMessage) {
          toast({
            title: t("messages.welcomeToSpecializedMode"),
            description: t("messages.welcomeToSpecializedModeDesc"),
            variant: "default",
          })
        }

        // Cache the computed data
        setCachedFocusData(stats, recommendations)

        // Show completion message for large datasets
        if (wrongAnswers.length > 50 || practiceHistory.length > 20) {
          toast({
            title: t("messages.statisticsComputed"),
            description: formatToastMessage("messages.statisticsComputedDesc", { 
              wrongAnswers: wrongAnswers.length,
              sessions: practiceHistory.length
            }),
            variant: "default",
          })
        }

      } catch (error) {
        console.error('Failed to load focus area data:', error)
        
        // Fallback to default values on error
        setFocusAreaStats(getDefaultStats())
        setRecommendedFocusAreas(getDefaultRecommendations())
        
        toast({
          title: t("messages.focusDataLoadFailed"),
          description: t("messages.usingDefaultRecommendations"),
          variant: "destructive",
        })
    } finally {
      setIsLoadingRecommendations(false)
      updateLoadingState('computingStats', false)
      updateLoadingState('generatingRecommendations', false)
      clearProgress()
    }
  }, [isAuthenticated, user, toast, t, updateLoadingState, updateProgress, clearProgress, formatToastMessage, getCachedFocusData, setCachedFocusData])

  // Load and compute focus area statistics
  useEffect(() => {
    loadFocusAreaData()
  }, [loadFocusAreaData])



  // API request cache to avoid duplicate calls
  const apiRequestCache = useMemo(() => new Map<string, Promise<unknown>>(), [])

  // Debounced functions for performance optimization
  const debouncedFunctions = useMemo(() => {
    // Debounced recommendation update
    let recommendationTimeoutId: NodeJS.Timeout
    const updateRecommendations = (stats: FocusAreaStats) => {
      clearTimeout(recommendationTimeoutId)
      recommendationTimeoutId = setTimeout(() => {
        const recommendations = selectRecommendedFocusAreas(stats, 3)
        setRecommendedFocusAreas(recommendations)
      }, 300)
    }

    // Debounced focus area selection
    let focusAreaTimeoutId: NodeJS.Timeout
    const debouncedFocusAreaSelection = (areas: FocusArea[]) => {
      clearTimeout(focusAreaTimeoutId)
      focusAreaTimeoutId = setTimeout(() => {
        const limitedAreas = areas.slice(0, 5)
        setSelectedFocusAreas(limitedAreas)
        setFocusCoverage(null)
        
        // Reset related states
        if (limitedAreas.length > 0) {
          setQuestions([])
          setAnswers({})
          setTranscript("")
          setAudioUrl("")
          setAudioDuration(null)
          setAudioError(false)
        }
      }, 200)
    }

    // Debounced cache clearing with loading state
    let cacheTimeoutId: NodeJS.Timeout
    const debouncedCacheClear = () => {
      clearTimeout(cacheTimeoutId)
      updateLoadingState('clearingCache', true)
      
      cacheTimeoutId = setTimeout(() => {
        try {
          localStorage.removeItem('english-listening-focus-area-cache')
          
          // Show feedback for cache clearing
          toast({
            title: t("messages.cacheCleared"),
            description: t("messages.cacheClearedDesc"),
            variant: "default",
          })
        } catch (error) {
          console.error('Failed to clear focus area cache:', error)
          toast({
            title: t("messages.cacheClearFailed"),
            description: t("messages.storageUnavailable"),
            variant: "destructive",
          })
        } finally {
          updateLoadingState('clearingCache', false)
        }
      }, 1000)
    }

    return {
      updateRecommendations,
      debouncedFocusAreaSelection,
      debouncedCacheClear
    }
  }, [updateLoadingState, toast, t])

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

  // Update recommendations when focus area stats change (debounced)
  useEffect(() => {
    if (Object.keys(focusAreaStats).length > 0) {
      debouncedFunctions.updateRecommendations(focusAreaStats)
    }
  }, [focusAreaStats, debouncedFunctions])

  // 快捷键系统初始化和入门引导
  useEffect(() => {
    if (shortcutsEnabled && !onboarded && isAuthenticated) {
      // 延迟显示入门引导，避免与其他对话框冲突
      const timer = setTimeout(() => {
        setShowOnboarding(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [shortcutsEnabled, onboarded, isAuthenticated])

  // Enhanced memoized computations to avoid unnecessary re-renders
  const isSetupComplete = useMemo(() => {
    return Boolean(difficulty && topic)
  }, [difficulty, topic])

  const _canGenerateContent = useMemo(() => {
    return Boolean(difficulty && (!isSpecializedMode || selectedFocusAreas.length > 0))
  }, [difficulty, isSpecializedMode, selectedFocusAreas.length])

  const _specializedModeConfig = useMemo(() => {
    return {
      isEnabled: isSpecializedMode,
      selectedAreas: selectedFocusAreas,
      recommendedAreas: recommendedFocusAreas,
      hasRecommendations: recommendedFocusAreas.length > 0,
      isLoadingRecommendations
    }
  }, [isSpecializedMode, selectedFocusAreas, recommendedFocusAreas, isLoadingRecommendations])

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
      // Create cache key for this specific request
      // const cacheKey = `topics-${difficulty}-${wordCount}-${language}-${isSpecializedMode ? selectedFocusAreas.join(',') : 'normal'}`; // Removed unused cacheKey

      const response = await cachedApiCall(
        `topics-${difficulty}-${wordCount}-${language}-${JSON.stringify(selectedFocusAreas)}`,
        () => generateTopics(difficulty, wordCount, language, undefined, selectedFocusAreas),
        60000 // 1 minute cache for topics
      ) as { topics: string[]; focusCoverage?: FocusCoverage; degradationReason?: string }
      
      setSuggestedTopics(response.topics)
      
      // Handle focus coverage for specialized mode
      if (isSpecializedMode && response.focusCoverage) {
        setFocusCoverage(response.focusCoverage)
        
        // Check for zero coverage (AI doesn't support focus areas)
        if (response.focusCoverage.coverage === 0) {
          // Record user intent for future recommendations
          recordUserIntent(selectedFocusAreas)
          
          toast({
            title: t("messages.specializedModeUnavailable"),
            description: t("messages.specializedModeUnavailableDesc"),
            variant: "default",
          })
        } else if (response.focusCoverage.coverage < 0.8) {
          toast({
            title: t("messages.partialCoverageWarning"),
            description: t("messages.partialCoverageWarningDesc").replace('{coverage}', Math.round(response.focusCoverage.coverage * 100).toString()),
            variant: "default",
          })
        }
      }
      
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
  }, [difficulty, wordCount, language, isSpecializedMode, selectedFocusAreas, toast, cachedApiCall])

  const handleGenerateTranscript = useCallback(async () => {
    if (!difficulty || !topic) return

    setLoading(true)
    setLoadingMessage("Generating listening transcript...")

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        // Create cache key for transcript generation
        // const cacheKey = `transcript-${difficulty}-${wordCount}-${topic}-${language}-${isSpecializedMode ? selectedFocusAreas.join(',') : 'normal'}`; // Removed unused cacheKey

        const response = await cachedApiCall(
          `transcript-${difficulty}-${wordCount}-${topic}-${language}-${isSpecializedMode ? selectedFocusAreas.join(',') : 'normal'}`,
          () => generateTranscript(
            difficulty,
            wordCount,
            topic,
            language,
            undefined,
            isSpecializedMode ? selectedFocusAreas : undefined
          ),
          120000 // 2 minutes cache for transcripts
        ) as { transcript: string; focusCoverage?: FocusCoverage; degradationReason?: string }
        
        setTranscript(response.transcript)
        setCanRegenerate(true)
        
        // Handle focus coverage for specialized mode
        if (isSpecializedMode && response.focusCoverage) {
          setFocusCoverage(response.focusCoverage)
          
          // Check for zero coverage (AI doesn't support focus areas)
          if (response.focusCoverage.coverage === 0) {
            // Record user intent for future recommendations
            recordUserIntent(selectedFocusAreas)
            
            toast({
              title: t("messages.specializedModeUnavailable"),
              description: t("messages.specializedModeUnavailableDesc"),
              variant: "default",
            })
          } else if (response.focusCoverage.coverage < 0.8) {
            toast({
              title: t("messages.partialCoverageWarning"),
              description: t("messages.partialCoverageWarningDesc").replace('{coverage}', Math.round(response.focusCoverage.coverage * 100).toString()),
              variant: "default",
            })
          }
        }
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
  }, [difficulty, topic, wordCount, language, toast, cachedApiCall])

  const handleApplyTemplate = useCallback((tpl: PracticeTemplate) => {
    let appliedLanguage: ListeningLanguage = tpl.language
    if (!isLanguageSupported(appliedLanguage)) {
      appliedLanguage = DEFAULT_LANGUAGE
      toast({ title: t("pages.templates.languageFallback"), description: "" })
    }

    setDifficulty(tpl.difficulty as DifficultyLevel)
    setDuration(tpl.duration)
    setLanguage(appliedLanguage)
    setTopic(tpl.topic || "")
    setSuggestedTopics([])
    setQuestions([])
    setAnswers({})
    setAudioUrl("")
    setAudioDuration(null)
    setAudioError(false)
    setCanRegenerate(true)
    toast({ title: t("pages.templates.applySuccess"), description: "" })
  }, [t, toast])

  const handleSaveTemplate = useCallback(() => {
    try {
      const name = window.prompt(t("pages.templates.saveButton")) || ""
      const trimmed = name.trim()
      if (!trimmed) return

      const tpl: PracticeTemplate = {
        id: `${Date.now()}`,
        name: trimmed,
        createdAt: new Date().toISOString(),
        difficulty: (difficulty || "A1") as DifficultyLevel,
        language,
        duration,
        autoGenerateTopic: false,
        topic: topic || ""
      }

      const ok = saveTemplate(tpl)
      if (!ok) {
        toast({ title: t("pages.templates.nameDuplicate"), description: "", variant: "destructive" })
        return
      }
      setTemplates(getTemplates())
      toast({ title: t("pages.templates.saveSuccess"), description: "" })
      topicInputRef.current?.focus()
    } catch {
      toast({ title: t("pages.templates.unavailable"), description: "", variant: "destructive" })
    }
  }, [difficulty, duration, language, topic, t, toast])

  const handleStartRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameText(currentName)
  }, [])

  const handleConfirmRename = useCallback(() => {
    if (!renamingId) return
    const newName = renameText.trim()
    if (!newName) return
    setTemplateOpLoadingId(renamingId)
    const ok = renameTemplate(renamingId, newName)
    setTemplateOpLoadingId(null)
    if (!ok) {
      toast({ title: t("pages.templates.nameDuplicate"), description: "", variant: "destructive" })
      return
    }
    setRenamingId(null)
    setRenameText("")
    setTemplates(getTemplates())
    toast({ title: t("pages.templates.renameSuccess"), description: "" })
  }, [renameText, renamingId, t, toast])

  const handleDeleteTemplateById = useCallback((id: string) => {
    if (!window.confirm(t("pages.templates.deleteConfirm"))) return
    setTemplateOpLoadingId(id)
    deleteTemplate(id)
    setTemplateOpLoadingId(null)
    setTemplates(getTemplates())
    toast({ title: t("pages.templates.deleteSuccess"), description: "" })
  }, [t, toast])

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
      // Create cache key for questions generation
      const transcriptHash = transcript.slice(0, 50) // Use first 50 chars as hash
      const cacheKey = `questions-${difficulty}-${transcriptHash}-${language}-${duration}-${isSpecializedMode ? selectedFocusAreas.join(',') : 'normal'}`; // Removed unused cacheKey
      
      const response = await cachedApiCall(
        cacheKey,
        () => generateQuestions(
          difficulty, 
          transcript, 
          language, 
          duration, 
          undefined, 
          isSpecializedMode ? selectedFocusAreas : undefined
        ),
        180000 // 3 minutes cache for questions
      ) as { questions: Question[]; focusCoverage?: FocusCoverage; focusMatch?: Array<{questionIndex: number; matchedTags: FocusArea[]; confidence: 'high' | 'medium' | 'low'}>; degradationReason?: string }
      
      setQuestions(response.questions)
      setAnswers({})
      setStep("questions")
      
      // Handle focus coverage for specialized mode
      if (isSpecializedMode && response.focusCoverage) {
        setFocusCoverage(response.focusCoverage)
        
        // Check for zero coverage (AI doesn't support focus areas)
        if (response.focusCoverage.coverage === 0) {
          // Record user intent for future recommendations
          recordUserIntent(selectedFocusAreas)
          
          toast({
            title: t("messages.specializedModeUnavailable"),
            description: t("messages.specializedModeUnavailableDesc"),
            variant: "default",
          })
        } else if (response.focusCoverage.coverage < 0.8) {
          toast({
            title: t("messages.partialCoverageWarning"),
            description: t("messages.partialCoverageWarningDesc").replace('{coverage}', Math.round(response.focusCoverage.coverage * 100).toString()),
            variant: "default",
          })
        }
      }
      
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
  }, [transcript, difficulty, language, duration, isSpecializedMode, selectedFocusAreas, toast, cachedApiCall])

  const handleSubmitAnswers = useCallback(async () => {
    if (questions.length === 0 || !user) return

    setLoading(true)
    setLoadingMessage("Grading your answers...")

    try {
      const gradingResponse = await gradeAnswers(transcript, questions, answers, language, isSpecializedMode ? selectedFocusAreas : undefined)
      const gradingResults = gradingResponse.results
      
      // Handle focus coverage from grading if in specialized mode
      const latestFocusCoverage = isSpecializedMode
        ? gradingResponse.focusCoverage ?? focusCoverage
        : null

      if (isSpecializedMode && latestFocusCoverage) {
        setFocusCoverage(latestFocusCoverage)
      }

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

      // Build base Exercise object
      const baseExercise: Exercise = {
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

      // Calculate per-focus accuracy only once for specialized mode
      const memoizedPerFocusAccuracy = isSpecializedMode 
        ? calculatePerFocusAccuracy(gradingResults, questions)
        : undefined

      // Build specialized fields if in specialized mode
      const specializedFields = isSpecializedMode ? {
        focusAreas: [...selectedFocusAreas],
        ...(latestFocusCoverage ? { focusCoverage: latestFocusCoverage } : {}),
        specializedMode: true as const,
        ...(memoizedPerFocusAccuracy ? { perFocusAccuracy: memoizedPerFocusAccuracy } : {})
      } : {}

      // Merge base and specialized fields into final exercise object
      const exercise: Exercise = {
        ...baseExercise,
        ...specializedFields
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
            description: t("achievements.notifications.goalCompleted.dailyGoal").replace(
              "{target}", 
              achievementResult.goalProgress.daily.target.toString()
            ),
            duration: 5000,
          })
        }
        
        if (achievementResult.goalProgress.weekly.isCompleted) {
          toast({
            title: t("achievements.notifications.goalCompleted.title"),
            description: t("achievements.notifications.goalCompleted.weeklyGoal").replace(
              "{target}", 
              achievementResult.goalProgress.weekly.target.toString()
            ),
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
            duration: practiceDurationSec // Use calculated duration in seconds
          })
        })

        // 如果是专项模式，使用防抖清除缓存以便重新计算统计数据
        if (isSpecializedMode) {
          debouncedFunctions.debouncedCacheClear()
        }
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

  const handleFeedback = useCallback(() => {
    const subject = encodeURIComponent("English Listening Trainer Feedback")
    const body = encodeURIComponent(`Page URL: ${window.location.href}\n\nFeedback:\n`)
    window.open(`mailto:laoli3699@qq.com?subject=${subject}&body=${body}`)
  }, [])

  // 快捷键处理函数
  const handleShortcut: ShortcutHandler = useCallback((action) => {
    switch (action) {
      case 'play-pause':
        if (audioPlayerRef.current?.hasAudio) {
          audioPlayerRef.current.togglePlayPause()
        }
        break
      case 'open-history':
        setStep('history')
        break
      case 'open-wrong-answers':
        setStep('wrong-answers')
        break
      case 'toggle-specialized-mode':
        if (step === 'setup') {
          setIsSpecializedMode(!isSpecializedMode)
        }
        break
      case 'close-dialog':
        if (showShortcutHelp) {
          setShowShortcutHelp(false)
        } else if (showOnboarding) {
          setShowOnboarding(false)
        } else if (step !== 'setup') {
          setStep('setup')
        }
        break
      case 'show-help':
        setShowShortcutHelp(true)
        break
      case 'return-home':
        setStep('setup')
        break
      default:
        break
    }
  }, [step, isSpecializedMode, showShortcutHelp, showOnboarding])

  // 快捷键设置切换
  const handleToggleShortcuts = useCallback(() => {
    const newEnabled = !shortcutsEnabled
    setShortcutsEnabled(newEnabled)
    toast({
      title: newEnabled ? t("shortcuts.shortcutsEnabled") : t("shortcuts.shortcutsDisabled"),
      description: newEnabled ? t("shortcuts.onboardingDescription") : "",
    })
  }, [shortcutsEnabled, setShortcutsEnabled, toast, t])

  // 完成入门引导
  const handleCompleteOnboarding = useCallback(() => {
    setOnboarded(true)
    setShowOnboarding(false)
  }, [setOnboarded])

  // 快捷键监听
  useHotkeys({
    enabled: shortcutsEnabled,
    currentStep: step,
    hasAudio: Boolean(audioUrl && !audioError),
    onShortcut: handleShortcut
  })

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

  // 专项模式核心逻辑函数
  const handleSpecializedModeToggle = useCallback((enabled: boolean) => {
    setIsSpecializedMode(enabled)
    if (!enabled) {
      // 关闭专项模式时清空相关状态
      setSelectedFocusAreas([])
      setFocusCoverage(null)
      // 重置练习相关状态以避免数据不一致
      setQuestions([])
      setAnswers({})
      setTranscript("")
      setAudioUrl("")
      setAudioDuration(null)
      setAudioError(false)
      exerciseStartTimeRef.current = null
    }
  }, [])

  const handleFocusAreaSelection = useCallback((areas: FocusArea[]) => {
    // Use debounced selection to prevent rapid state updates
    debouncedFunctions.debouncedFocusAreaSelection(areas)
  }, [debouncedFunctions])

  const handleApplyRecommendations = useCallback(() => {
    const uniqueAreas = Array.from(new Set([...selectedFocusAreas, ...recommendedFocusAreas]))
    const limitedAreas = uniqueAreas.slice(0, 5) // 限制最多5个标签
    setSelectedFocusAreas(limitedAreas)
    
    // 重置相关状态
    setFocusCoverage(null)
    setQuestions([])
    setAnswers({})
    setTranscript("")
    setAudioUrl("")
    setAudioDuration(null)
    setAudioError(false)
    exerciseStartTimeRef.current = null
  }, [selectedFocusAreas, recommendedFocusAreas])

  const handleSaveSpecializedPreset = useCallback(async (name: string) => {
    if (!name.trim() || selectedFocusAreas.length === 0) return false
    
    updateLoadingState('savingPreset', true)
    
    try {
      // Simulate processing time for better UX feedback
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const preset: SpecializedPreset = {
        id: `specialized-${Date.now()}`,
        name: name.trim(),
        focusAreas: [...selectedFocusAreas],
        difficulty: (difficulty || "A1") as DifficultyLevel,
        language,
        duration,
        createdAt: new Date().toISOString()
      }
      
      const storageKey = 'english-listening-specialized-presets'
      const existingPresets = safeLocalStorageGet(storageKey, []) as SpecializedPreset[]
      
      // 检查名称是否重复
      if (existingPresets.some(p => p.name === preset.name)) {
        return false
      }
      
      const updatedPresets = [...existingPresets, preset]
      const saved = safeLocalStorageSet(storageKey, updatedPresets)
      
      if (saved) {
        setSpecializedPresets(updatedPresets)
      } else {
        return false
      }
      
      toast({
        title: t("messages.presetSaveSuccess"),
        description: formatToastMessage("messages.presetSaveSuccessDesc", { name: preset.name }),
      })
      
      return true
    } catch (error) {
      console.error('Failed to save specialized preset:', error)
      toast({
        title: t("messages.presetSaveFailed"),
        description: t("messages.storageUnavailable"),
        variant: "destructive",
      })
      return false
    } finally {
      updateLoadingState('savingPreset', false)
    }
  }, [selectedFocusAreas, difficulty, language, duration, toast, t, formatToastMessage, updateLoadingState, safeLocalStorageGet, safeLocalStorageSet])

  const handleLoadSpecializedPreset = useCallback(async (preset: SpecializedPreset) => {
    updateLoadingState('loadingPreset', true)
    
    try {
      // Simulate processing time for better UX feedback
      await new Promise(resolve => setTimeout(resolve, 200))
      
      setSelectedFocusAreas([...preset.focusAreas])
      setDifficulty(preset.difficulty)
      setLanguage(preset.language)
      setDuration(preset.duration)
      
      // 重置相关状态
      setFocusCoverage(null)
      setQuestions([])
      setAnswers({})
      setTranscript("")
      setAudioUrl("")
      setAudioDuration(null)
      setAudioError(false)
      
      toast({
        title: t("messages.presetLoadSuccess"),
        description: formatToastMessage("messages.presetLoadSuccessDesc", { name: preset.name }),
      })
    } finally {
      updateLoadingState('loadingPreset', false)
    }
  }, [toast, t, formatToastMessage, updateLoadingState])

  const handleDeleteSpecializedPreset = useCallback((presetId: string) => {
    try {
      const storageKey = 'english-listening-specialized-presets'
      const existingPresets = safeLocalStorageGet(storageKey, []) as SpecializedPreset[]
      const updatedPresets = existingPresets.filter(p => p.id !== presetId)
      
      const saved = safeLocalStorageSet(storageKey, updatedPresets)
      
      if (saved) {
        setSpecializedPresets(updatedPresets)
      }
      
      toast({
        title: t("messages.presetDeleteSuccess"),
        description: t("messages.presetDeleteSuccessDesc"),
      })
    } catch (error) {
      console.error('Failed to delete specialized preset:', error)
      toast({
        title: t("messages.presetDeleteFailed"),
        description: t("messages.storageUnavailable"),
        variant: "destructive",
      })
    }
  }, [toast, t])

  // Helper function to calculate accuracy per focus area
  const calculatePerFocusAccuracy = useCallback((results: GradingResult[], questions: Question[]) => {
    const perFocusAccuracy: Record<string, number> = {}

    selectedFocusAreas.forEach(area => {
      let relevantCount = 0
      let correctCount = 0

      questions.forEach((question, index) => {
        if (!question.focus_areas?.includes(area)) {
          return
        }

        relevantCount += 1
        if (results[index]?.is_correct) {
          correctCount += 1
        }
      })

      perFocusAccuracy[area] = relevantCount > 0
        ? Math.round((correctCount / relevantCount) * 100)
        : 0
    })

    return perFocusAccuracy
  }, [selectedFocusAreas])

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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <BilingualText translationKey="pages.home.title" />
              </h1>
              {/* Specialized Mode Badge */}
              {isSpecializedMode && (
                <Badge variant="default" className="bg-blue-600 text-white">
                  <BilingualText translationKey="components.specializedPractice.title" />
                  {selectedFocusAreas.length > 0 && (
                    <span className="ml-1">({selectedFocusAreas.length})</span>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              <BilingualText translationKey="pages.home.subtitle" />
            </p>
            
            {/* Coverage Warning */}
            {isSpecializedMode && focusCoverage && focusCoverage.coverage < 1 && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      <BilingualText translationKey="components.specializedPractice.coverage.warning" />
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      <BilingualText 
                        translationKey="components.specializedPractice.coverage.warningDescription"
                      />
                      {` (${Math.round(focusCoverage.coverage * 100)}%)`}
                    </p>
                    {focusCoverage.unmatchedTags.length > 0 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        <BilingualText translationKey="components.specializedPractice.coverage.unmatchedTags" />
                        {`: ${focusCoverage.unmatchedTags.map(tag => 
                          t(`components.specializedPractice.focusAreas.${tag.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`)
                        ).join(', ')}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowShortcutHelp(true)} 
                className="glass-effect bg-transparent"
                title={t("shortcuts.title")}
              >
                <Keyboard className="w-4 h-4 mr-2" />
                <BilingualText translationKey="shortcuts.title" />
              </Button>
              <Button 
                variant={shortcutsEnabled ? "default" : "outline"} 
                size="sm" 
                onClick={handleToggleShortcuts}
                className={`glass-effect ${shortcutsEnabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-transparent'}`}
                title={shortcutsEnabled ? t("shortcuts.disableShortcuts") : t("shortcuts.enableShortcuts")}
              >
                <Keyboard className={`w-4 h-4 mr-2 ${shortcutsEnabled ? 'text-white' : ''}`} />
                <BilingualText translationKey={shortcutsEnabled ? "shortcuts.shortcutsEnabled" : "shortcuts.shortcutsDisabled"} />
              </Button>
            </nav>
          </div>
        </header>

        {/* Setup Step */}
        {step === "setup" && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Specialized Mode Status - Mobile Optimized */}
            {isSpecializedMode && selectedFocusAreas.length > 0 && (
              <Card className="glass-effect p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200 text-sm sm:text-base">
                    <BilingualText translationKey="components.specializedPractice.selectedAreas" />
                    {` (${selectedFocusAreas.length}/5)`}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSpecializedModeToggle(false)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200 self-start sm:self-auto text-xs sm:text-sm"
                  >
                    <BilingualText translationKey="components.specializedPractice.disableMode" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {selectedFocusAreas.map((area) => {
                    const stats = focusAreaStats[area]
                    return (
                      <Badge
                        key={area}
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 text-xs sm:text-sm px-2 py-1"
                      >
                        <BilingualText translationKey={`components.specializedPractice.focusAreas.${area.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`} />
                        {stats && stats.attempts > 0 && (
                          <span className="ml-1 text-xs opacity-75">
                            ({stats.accuracy.toFixed(0)}%)
                          </span>
                        )}
                      </Badge>
                    )
                  })}
                </div>
                {focusCoverage && focusCoverage.coverage < 1 && (
                  <div className="mt-3 p-2 sm:p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-xs sm:text-sm">
                    <BilingualText translationKey="components.specializedPractice.coverage.warning" />
                    {`: ${Math.round(focusCoverage.coverage * 100)}%`}
                  </div>
                )}
              </Card>
            )}
            {/* Templates List */}
            <Card className="glass-effect p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">
                  <BilingualText translationKey="pages.templates.title" />
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  <BilingualText translationKey="pages.templates.deviceNotice" />
                </span>
              </div>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="pages.templates.emptyPlaceholder" />
                </p>
              ) : (
                <ul className="space-y-2">
                  {templates.map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        {renamingId === tpl.id ? (
                          <Input
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            placeholder={t("pages.templates.renamePlaceholder")}
                            className="w-64"
                          />
                        ) : (
                          <div className="font-medium">{tpl.name}</div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("pages.templates.createdAt")}：{new Date(tpl.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {renamingId === tpl.id ? (
                          <>
                            <Button onClick={handleConfirmRename} disabled={!renameText.trim() || templateOpLoadingId === tpl.id}>
                              <BilingualText translationKey="pages.templates.confirmRename" />
                            </Button>
                            <Button variant="outline" onClick={() => { setRenamingId(null); setRenameText(""); }}>
                              {t("buttons.cancel")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="secondary" onClick={() => handleApplyTemplate(tpl)} disabled={loading || templateOpLoadingId === tpl.id}>
                              <BilingualText translationKey="pages.templates.applyButton" />
                            </Button>
                            <Button variant="outline" onClick={() => handleStartRename(tpl.id, tpl.name)}>
                              <BilingualText translationKey="pages.templates.rename" />
                            </Button>
                            <Button variant="destructive" onClick={() => handleDeleteTemplateById(tpl.id)} disabled={templateOpLoadingId === tpl.id}>
                              <BilingualText translationKey="pages.templates.delete" />
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

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
  <SelectTrigger aria-label={t("labels.difficulty")} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
                  <Select value={language} onValueChange={(value) => handleLanguageChange(value as ListeningLanguage)}>
<SelectTrigger aria-label={t("labels.listeningLanguage")} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
<SelectTrigger aria-label={t("labels.duration")} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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

                {/* Specialized Practice Mode - Mobile Optimized */}
                <Card className="glass-effect p-3 sm:p-4 border-blue-200 dark:border-blue-800">
                  <div className="space-y-3 sm:space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-blue-700 dark:text-blue-300">
                          <BilingualText translationKey="components.specializedPractice.title" />
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <BilingualText translationKey="components.specializedPractice.description" />
                        </p>
                      </div>
                      <Button
                        variant={isSpecializedMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSpecializedModeToggle(!isSpecializedMode)}
                        className={`
                          ${isSpecializedMode ? "bg-blue-600 hover:bg-blue-700" : ""} 
                          text-xs sm:text-sm px-3 py-2 touch-manipulation
                          self-start sm:self-auto min-w-[120px] sm:min-w-[140px]
                        `}
                      >
                        <BilingualText 
                          translationKey={isSpecializedMode ? "components.specializedPractice.disableMode" : "components.specializedPractice.enableMode"} 
                        />
                      </Button>
                    </div>

                    {/* Specialized Mode Configuration */}
                    {isSpecializedMode && (
                      <div className="space-y-4 border-t border-blue-200 dark:border-blue-800 pt-4">
                        {/* Recommendations Section - Mobile Optimized */}
                        {recommendedFocusAreas.length > 0 && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                              <h4 className="font-medium text-blue-800 dark:text-blue-200 text-sm sm:text-base">
                                <BilingualText translationKey="components.specializedPractice.recommendedAreas" />
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleApplyRecommendations}
                                className="text-blue-600 border-blue-300 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900/30 text-xs sm:text-sm self-start sm:self-auto"
                              >
                                <BilingualText translationKey="components.specializedPractice.applyRecommendations" />
                              </Button>
                            </div>
                            <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 mb-3">
                              <BilingualText translationKey="components.specializedPractice.recommendedAreasDescription" />
                            </p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {recommendedFocusAreas.map((area) => {
                                const stats = focusAreaStats[area]
                                const canAdd = !selectedFocusAreas.includes(area) && selectedFocusAreas.length < 5
                                return (
                                  <Badge
                                    key={area}
                                    variant="secondary"
                                    className={`
                                      bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 
                                      text-xs sm:text-sm px-2 py-1 touch-manipulation
                                      ${canAdd 
                                        ? 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-700 active:scale-95' 
                                        : 'opacity-50 cursor-not-allowed'
                                      }
                                    `}
                                    onClick={() => {
                                      if (canAdd) {
                                        handleFocusAreaSelection([...selectedFocusAreas, area])
                                      }
                                    }}
                                    role="button"
                                    tabIndex={canAdd ? 0 : -1}
                                    aria-pressed={canAdd}
                                    aria-label={`${t(`components.specializedPractice.focusAreas.${area.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`)} - ${canAdd ? t("messages.tapToToggle") : t("messages.selectionLimit")}`}
                                  >
                                    <BilingualText translationKey={`components.specializedPractice.focusAreas.${area.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`} />
                                    {stats && (
                                      <span className="ml-1 text-xs opacity-75">
                                        ({stats.accuracy.toFixed(0)}%)
                                      </span>
                                    )}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Enhanced Loading States with Progress */}
                        {(isLoadingRecommendations || loadingStates.computingStats || loadingStates.generatingRecommendations) && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
                            <div className="flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-600" />
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                {loadingStates.computingStats && (
                                  <BilingualText translationKey="components.specializedPractice.computingStats" />
                                )}
                                {loadingStates.generatingRecommendations && (
                                  <BilingualText translationKey="components.specializedPractice.generatingRecommendations" />
                                )}
                                {isLoadingRecommendations && !loadingStates.computingStats && !loadingStates.generatingRecommendations && (
                                  <BilingualText translationKey="components.specializedPractice.loadingRecommendations" />
                                )}
                              </span>
                            </div>
                            
                            {/* Progress Bar */}
                            {progressInfo && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300">
                                  <span>{progressInfo.message}</span>
                                  <span>{progressInfo.current}/{progressInfo.total}</span>
                                </div>
                                <Progress 
                                  value={(progressInfo.current / progressInfo.total) * 100} 
                                  className="h-2"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Loading States */}
                        {(loadingStates.savingPreset || loadingStates.loadingPreset || loadingStates.clearingCache) && (
                          <div className="flex items-center justify-center py-2 text-sm text-gray-600 dark:text-gray-400">
                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                            {loadingStates.savingPreset && (
                              <BilingualText translationKey="components.specializedPractice.savingPreset" />
                            )}
                            {loadingStates.loadingPreset && (
                              <BilingualText translationKey="components.specializedPractice.loadingPreset" />
                            )}
                            {loadingStates.clearingCache && (
                              <BilingualText translationKey="components.specializedPractice.clearingCache" />
                            )}
                          </div>
                        )}

                        {/* No Recommendations */}
                        {!isLoadingRecommendations && recommendedFocusAreas.length === 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <BilingualText translationKey="components.specializedPractice.noRecommendations" />
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              <BilingualText translationKey="components.specializedPractice.noRecommendationsDescription" />
                            </p>
                          </div>
                        )}

                        {/* Focus Area Selection - Mobile Optimized */}
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                            <Label className="text-sm sm:text-base font-medium">
                              <BilingualText translationKey="components.specializedPractice.selectFocusAreas" />
                            </Label>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <span className="text-xs sm:text-sm text-gray-500">
                                <BilingualText 
                                  translationKey="components.specializedPractice.selectedAreas" 
                                />
                                {` (${selectedFocusAreas.length}/5)`}
                              </span>
                              {selectedFocusAreas.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleFocusAreaSelection([])}
                                  className="text-xs h-6 px-2 touch-manipulation"
                                >
                                  <BilingualText translationKey="components.specializedPractice.clearSelection" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
                            <BilingualText translationKey="components.specializedPractice.selectFocusAreasDescription" />
                          </p>
                          
                          {/* Focus Area Grid - Mobile Optimized */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                            {FOCUS_AREA_LIST.map((area) => {
                              const isSelected = selectedFocusAreas.includes(area)
                              const stats = focusAreaStats[area]
                              const canSelect = !isSelected && selectedFocusAreas.length < 5
                              
                              return (
                                <div
                                  key={area}
                                  className={`
                                    p-3 sm:p-4 rounded-lg border cursor-pointer transition-all touch-manipulation
                                    min-h-[80px] sm:min-h-[90px] flex flex-col justify-between
                                    ${isSelected 
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400 shadow-md' 
                                      : canSelect
                                        ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 active:scale-95'
                                        : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                    }
                                  `}
                                  onClick={() => {
                                    if (isSelected) {
                                      handleFocusAreaSelection(selectedFocusAreas.filter(a => a !== area))
                                    } else if (canSelect) {
                                      handleFocusAreaSelection([...selectedFocusAreas, area])
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={isSelected}
                                  aria-label={`${t(`components.specializedPractice.focusAreas.${area.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`)} - ${isSelected ? t("messages.focusAreaSelected") : canSelect ? t("messages.tapToToggle") : t("messages.selectionLimit")}`}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      if (isSelected) {
                                        handleFocusAreaSelection(selectedFocusAreas.filter(a => a !== area))
                                      } else if (canSelect) {
                                        handleFocusAreaSelection([...selectedFocusAreas, area])
                                      }
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className={`text-sm sm:text-base font-medium leading-tight ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                      <BilingualText translationKey={`components.specializedPractice.focusAreas.${area.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toLowerCase())}`} />
                                    </h5>
                                    <div className="flex-shrink-0 ml-2">
                                      {isSelected ? (
                                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                          <div className="w-2 h-2 bg-white rounded-full"></div>
                                        </div>
                                      ) : canSelect ? (
                                        <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full"></div>
                                      ) : (
                                        <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-700 rounded-full opacity-50"></div>
                                      )}
                                    </div>
                                  </div>
                                  {stats && stats.attempts > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="truncate">
                                          <BilingualText translationKey="components.specializedPractice.accuracy" />: {stats.accuracy.toFixed(0)}%
                                        </span>
                                        <span className="text-right ml-2">
                                          {stats.attempts} <BilingualText translationKey="components.specializedPractice.attempts" />
                                        </span>
                                      </div>
                                      {stats.incorrect > 0 && (
                                        <div className="text-red-500 dark:text-red-400">
                                          <BilingualText translationKey="components.specializedPractice.errors" />: {stats.incorrect}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Preset Management */}
                        {selectedFocusAreas.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium">
                                <BilingualText translationKey="components.specializedPractice.presets.title" />
                              </Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const name = window.prompt(t("components.specializedPractice.presets.namePrompt"))
                                  if (name) {
                                    handleSaveSpecializedPreset(name)
                                  }
                                }}
                                className="text-xs h-7 px-2"
                              >
                                <BilingualText translationKey="components.specializedPractice.presets.save" />
                              </Button>
                            </div>
                            
                            {specializedPresets.length > 0 ? (
                              <div className="space-y-2">
                                {specializedPresets.map((preset) => (
                                  <div
                                    key={preset.id}
                                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                                  >
                                    <div className="flex-1">
                                      <div className="text-sm font-medium">{preset.name}</div>
                                      <div className="text-xs text-gray-500">
                                        {preset.focusAreas.length} areas • {preset.difficulty} • {new Date(preset.createdAt).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleLoadSpecializedPreset(preset)}
                                        className="text-xs h-6 px-2"
                                      >
                                        <BilingualText translationKey="components.specializedPractice.presets.load" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          if (window.confirm(t("components.specializedPractice.presets.confirmDelete"))) {
                                            handleDeleteSpecializedPreset(preset.id)
                                          }
                                        }}
                                        className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                                      >
                                        <BilingualText translationKey="components.specializedPractice.presets.delete" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                                <BilingualText translationKey="components.specializedPractice.presets.noPresets" />
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Generate Topics Button */}
                {difficulty && (
                  <Button
                    onClick={handleGenerateTopics}
                    disabled={loading}
                    className="w-full glass-effect"
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
                    ref={topicInputRef}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t("placeholders.enterTopic")}
                    className="glass-effect"
                  />
                </div>

                {/* Save Template Button */}
                <Button
                  onClick={handleSaveTemplate}
                  disabled={!difficulty || !duration || loading}
                  className="w-full glass-effect"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  <BilingualText translationKey="pages.templates.saveButton" />
                </Button>

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
            
            {/* Achievement Panel */}
            <AchievementPanel 
              isOpen={isGoalPanelOpen}
              onToggle={() => setIsGoalPanelOpen(!isGoalPanelOpen)}
              userAuthenticated={isAuthenticated}
            />
          </div>
        )}

        {/* Listening Step */}
        {step === "listening" && (
          <div className="max-w-4xl mx-auto">
            <AudioPlayer
              ref={audioPlayerRef}
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

      {/* 快捷键帮助对话框 */}
      <ShortcutHelpDialog
        open={showShortcutHelp}
        onOpenChange={setShowShortcutHelp}
        currentStep={step}
        hasAudio={Boolean(audioUrl && !audioError)}
      />

      {/* 快捷键入门引导对话框 */}
      <ShortcutOnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={handleCompleteOnboarding}
      />

      <Toaster />
    </div>
  )
}

HomePage.displayName = "HomePage"

export default HomePage
