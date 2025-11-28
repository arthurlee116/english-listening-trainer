/**
 * 练习流程管理 Hook
 * 集中管理所有练习相关的状态与业务逻辑
 */

import { useCallback, useReducer, useMemo, useRef, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { generateTopics, generateTranscript, generateQuestions, gradeAnswers } from "@/lib/ai-service"
import { generateAudio } from "@/lib/tts-service"
import { saveToHistory, getHistory } from "@/lib/storage"
import { exportToTxt } from "@/lib/export"
import { handlePracticeCompleted, initializeAchievements, migrateFromHistory } from "@/lib/achievement-service"
import type { 
  Exercise, 
  Question, 
  DifficultyLevel, 
  GradingResult,
  ListeningLanguage,
  AchievementNotification
} from "@/lib/types"

export type ExerciseStep = 
  | 'setup' 
  | 'listening' 
  | 'questions' 
  | 'results' 
  | 'history' 
  | 'wrong-answers' 
  | 'assessment' 
  | 'assessment-result'

interface ExerciseState {
  currentStep: ExerciseStep
  difficulty: DifficultyLevel | ""
  duration: number
  language: ListeningLanguage
  topic: string
  suggestedTopics: string[]
  transcript: string
  audioUrl: string
  audioDuration: number | null
  audioError: boolean
  questions: Question[]
  answers: Record<number, string>
  currentExercise: Exercise | null
  loading: boolean
  loadingMessage: string
  canRegenerate: boolean
  assessmentResult: AssessmentResultType | null
  newAchievements: AchievementNotification[]
  error: string | null
}

export interface AssessmentResultType {
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

type ExerciseAction =
  | { type: 'SET_STEP'; payload: ExerciseStep }
  | { type: 'SET_DIFFICULTY'; payload: DifficultyLevel | "" }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_LANGUAGE'; payload: ListeningLanguage }
  | { type: 'SET_TOPIC'; payload: string }
  | { type: 'SET_SUGGESTED_TOPICS'; payload: string[] }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_AUDIO_URL'; payload: string }
  | { type: 'SET_AUDIO_DURATION'; payload: number | null }
  | { type: 'SET_AUDIO_ERROR'; payload: boolean }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'SET_ANSWERS'; payload: Record<number, string> }
  | { type: 'SET_CURRENT_EXERCISE'; payload: Exercise | null }
  | { type: 'SET_LOADING'; payload: { loading: boolean; message?: string } }
  | { type: 'SET_CAN_REGENERATE'; payload: boolean }
  | { type: 'SET_ASSESSMENT_RESULT'; payload: AssessmentResultType | null }
  | { type: 'SET_NEW_ACHIEVEMENTS'; payload: AchievementNotification[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' }

function createInitialState(): ExerciseState {
  return {
    currentStep: 'setup',
    difficulty: '',
    duration: 120,
    language: 'en-US',
    topic: '',
    suggestedTopics: [],
    transcript: '',
    audioUrl: '',
    audioDuration: null,
    audioError: false,
    questions: [],
    answers: {},
    currentExercise: null,
    loading: false,
    loadingMessage: '',
    canRegenerate: true,
    assessmentResult: null,
    newAchievements: [],
    error: null
  }
}

function exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }
    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.payload, error: null }
    case 'SET_DURATION':
      return { ...state, duration: action.payload }
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }
    case 'SET_TOPIC':
      return { ...state, topic: action.payload }
    case 'SET_SUGGESTED_TOPICS':
      return { ...state, suggestedTopics: action.payload }
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload }
    case 'SET_AUDIO_URL':
      return { ...state, audioUrl: action.payload }
    case 'SET_AUDIO_DURATION':
      return { ...state, audioDuration: action.payload }
    case 'SET_AUDIO_ERROR':
      return { ...state, audioError: action.payload }
    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload }
    case 'SET_ANSWERS':
      return { ...state, answers: action.payload }
    case 'SET_CURRENT_EXERCISE':
      return { ...state, currentExercise: action.payload }
    case 'SET_LOADING':
      return { 
        ...state, 
        loading: action.payload.loading,
        loadingMessage: action.payload.message || ''
      }
    case 'SET_CAN_REGENERATE':
      return { ...state, canRegenerate: action.payload }
    case 'SET_ASSESSMENT_RESULT':
      return { ...state, assessmentResult: action.payload }
    case 'SET_NEW_ACHIEVEMENTS':
      return { ...state, newAchievements: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'RESET':
      return createInitialState()
    default:
      return state
  }
}

// Type guard for Error objects
function isError(error: unknown): error is Error {
  return error instanceof Error
}

export function useExerciseWorkflow() {
  const [state, dispatch] = useReducer(exerciseReducer, createInitialState())
  const { toast } = useToast()
  const { t } = useBilingualText()
  const exerciseStartTimeRef = useRef<number | null>(null)
  const apiRequestCache = useMemo(() => new Map<string, Promise<unknown>>(), [])

  // Initialize achievement system
  useEffect(() => {
    try {
      initializeAchievements()
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
    state.newAchievements.forEach((notification) => {
      toast({
        title: t("achievements.notifications.achievementEarned.title"),
        description: t("achievements.notifications.achievementEarned.description", {
          values: { title: t(notification.achievement.titleKey) },
        }),
        duration: 5000,
      })
    })
    if (state.newAchievements.length > 0) {
      dispatch({ type: 'SET_NEW_ACHIEVEMENTS', payload: [] })
    }
  }, [state.newAchievements, toast, t])

  // Cached API call wrapper
  const cachedApiCall = useCallback(async (
    cacheKey: string,
    apiCall: () => Promise<unknown>,
    ttl: number = 30000
  ): Promise<unknown> => {
    if (apiRequestCache.has(cacheKey)) {
      return apiRequestCache.get(cacheKey) as Promise<unknown>
    }

    const promise = apiCall()
    apiRequestCache.set(cacheKey, promise)

    setTimeout(() => {
      apiRequestCache.delete(cacheKey)
    }, ttl)

    try {
      const result = await promise
      return result
    } catch (error) {
      apiRequestCache.delete(cacheKey)
      throw error
    }
  }, [apiRequestCache])

  // 计算字数
  const wordCount = useMemo(() => state.duration * 2, [state.duration])

  // 判断setup是否完成
  const isSetupComplete = useMemo(() => {
    return Boolean(state.difficulty && state.topic)
  }, [state.difficulty, state.topic])

  // Actions
  const actions = useMemo(() => ({
    setStep: (step: ExerciseStep) => dispatch({ type: 'SET_STEP', payload: step }),
    setDifficulty: (difficulty: DifficultyLevel | "") => dispatch({ type: 'SET_DIFFICULTY', payload: difficulty }),
    setDuration: (duration: number) => dispatch({ type: 'SET_DURATION', payload: duration }),
    setLanguage: (language: ListeningLanguage) => dispatch({ type: 'SET_LANGUAGE', payload: language }),
    setTopic: (topic: string) => dispatch({ type: 'SET_TOPIC', payload: topic }),
    setSuggestedTopics: (topics: string[]) => dispatch({ type: 'SET_SUGGESTED_TOPICS', payload: topics }),
    setAnswers: (answers: Record<number, string>) => dispatch({ type: 'SET_ANSWERS', payload: answers }),
    setAssessmentResult: (result: AssessmentResultType | null) => dispatch({ type: 'SET_ASSESSMENT_RESULT', payload: result }),
  }), [])

  // 生成话题建议
  const handleGenerateTopics = useCallback(async () => {
    if (!state.difficulty) return

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating topic suggestions...' } })

    try {
      const response = await cachedApiCall(
        `topics-${state.difficulty}-${wordCount}-${state.language}`,
        () => generateTopics(state.difficulty as DifficultyLevel, wordCount, state.language),
        60000
      ) as { topics: string[]; degradationReason?: string }
      
      dispatch({ type: 'SET_SUGGESTED_TOPICS', payload: response.topics })
      
      toast({
        title: t("messages.topicGenerationSuccess"),
        description: t("messages.topicGenerationSuccessDesc", { values: { count: response.topics.length } }),
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
      dispatch({ type: 'SET_LOADING', payload: { loading: false } })
    }
  }, [state.difficulty, wordCount, state.language, toast, cachedApiCall, t])

  // 刷新话题
  const handleRefreshTopics = useCallback(async () => {
    if (!state.difficulty || state.suggestedTopics.length === 0) return

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating new topic suggestions...' } })

    try {
      const response = await generateTopics(
        state.difficulty as DifficultyLevel, 
        wordCount, 
        state.language, 
        undefined, 
        undefined,
        state.suggestedTopics
      )
      
      dispatch({ type: 'SET_SUGGESTED_TOPICS', payload: response.topics })
      
      toast({
        title: t("messages.topicGenerationSuccess"),
        description: t("messages.topicGenerationSuccessDesc", { values: { count: response.topics.length } }),
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
      dispatch({ type: 'SET_LOADING', payload: { loading: false } })
    }
  }, [state.difficulty, wordCount, state.language, state.suggestedTopics, toast, t])

  // 生成听力文稿
  const handleGenerateTranscript = useCallback(async () => {
    if (!state.difficulty || !state.topic) return

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating listening transcript...' } })

    const attemptGeneration = async (attempt: number): Promise<void> => {
      try {
        const response = await cachedApiCall(
          `transcript-${state.difficulty}-${wordCount}-${state.topic}-${state.language}`,
          () => generateTranscript(
            state.difficulty as DifficultyLevel,
            wordCount,
            state.topic,
            state.language
          ),
          120000
        ) as { transcript: string; degradationReason?: string }
        
        dispatch({ type: 'SET_TRANSCRIPT', payload: response.transcript })
        dispatch({ type: 'SET_CAN_REGENERATE', payload: true })
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
      dispatch({ type: 'SET_STEP', payload: 'listening' })
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
      dispatch({ type: 'SET_LOADING', payload: { loading: false } })
    }
  }, [state.difficulty, state.topic, wordCount, state.language, toast, cachedApiCall, t])

  // 生成音频
  const handleGenerateAudio = useCallback(async () => {
    if (!state.transcript) return

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating audio...' } })
    dispatch({ type: 'SET_AUDIO_ERROR', payload: false })
    dispatch({ type: 'SET_AUDIO_DURATION', payload: null })

    try {
      console.log(`🎤 开始生成音频，文本长度: ${state.transcript.length}`)
      const audioResult = await generateAudio(state.transcript, { language: state.language })
      console.log(`✅ 音频生成完成，URL: ${audioResult.audioUrl}`)
      
      dispatch({ type: 'SET_AUDIO_URL', payload: audioResult.audioUrl })
      
      const duration = typeof audioResult.duration === 'number' && audioResult.duration > 0 
        ? audioResult.duration 
        : null
      dispatch({ type: 'SET_AUDIO_DURATION', payload: duration })
      
      if (!exerciseStartTimeRef.current) {
        exerciseStartTimeRef.current = Date.now()
      }
      
      toast({
        title: t("messages.audioGenerationSuccess"),
        description: t("messages.audioGenerationSuccessDesc", { 
          values: { 
            duration: duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '未知'
          }
        }),
      })
    } catch (error) {
      console.error("Failed to generate audio:", error)
      dispatch({ type: 'SET_AUDIO_ERROR', payload: true })
      dispatch({ type: 'SET_AUDIO_DURATION', payload: null })
      const errorMessage = isError(error) ? error.message : String(error)
      toast({
        title: t("messages.audioGenerationFailed"),
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { loading: false } })
    }
  }, [state.transcript, state.language, toast, t])

  // 开始答题
  const handleStartQuestions = useCallback(async () => {
    if (!state.transcript || !state.difficulty) return

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating questions...' } })

    try {
      const transcriptHash = state.transcript.slice(0, 50)
      const cacheKey = `questions-${state.difficulty}-${transcriptHash}-${state.language}-${state.duration}`
      
      const response = await cachedApiCall(
        cacheKey,
        () => generateQuestions(
          state.difficulty as DifficultyLevel, 
          state.transcript, 
          state.language, 
          state.duration
        ),
        180000
      ) as { questions: Question[]; degradationReason?: string }
      
      dispatch({ type: 'SET_QUESTIONS', payload: response.questions })
      dispatch({ type: 'SET_ANSWERS', payload: {} })
      dispatch({ type: 'SET_STEP', payload: 'questions' })
      
      toast({
        title: t("messages.questionsGenerationSuccess"),
        description: t("messages.questionsGenerationSuccessDesc", { values: { count: response.questions.length } }),
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
      dispatch({ type: 'SET_LOADING', payload: { loading: false } })
    }
  }, [state.transcript, state.difficulty, state.language, state.duration, toast, cachedApiCall, t])

  // 提交答案
  const handleSubmitAnswers = useCallback(async (user?: { id: string; name?: string; email: string }) => {
    if (state.questions.length === 0 || !user) return

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Grading your answers...' } })

    try {
      const gradingResponse = await gradeAnswers(state.transcript, state.questions, state.answers, state.language)
      const gradingResults = gradingResponse.results

      const now = Date.now()
      let practiceDurationSec: number

      if (state.audioDuration && state.audioDuration > 0) {
        practiceDurationSec = Math.round(state.audioDuration)
      } else if (state.duration && state.duration > 0) {
        practiceDurationSec = state.duration
      } else if (exerciseStartTimeRef.current) {
        const elapsedSeconds = Math.round((now - exerciseStartTimeRef.current) / 1000)
        practiceDurationSec = elapsedSeconds > 0 ? elapsedSeconds : 60
      } else {
        practiceDurationSec = 60
      }

      const exercise: Exercise = {
        id: Date.now().toString(),
        difficulty: state.difficulty as DifficultyLevel,
        language: state.language,
        topic: state.topic,
        transcript: state.transcript,
        questions: state.questions,
        answers: state.answers,
        results: gradingResults,
        createdAt: new Date(now).toISOString(),
        ...(practiceDurationSec > 0 ? { totalDurationSec: practiceDurationSec } : {})
      }

      dispatch({ type: 'SET_CURRENT_EXERCISE', payload: exercise })
      saveToHistory(exercise)
      
      // Achievement processing
      try {
        const achievementResult = handlePracticeCompleted(exercise)
        
        if (achievementResult.newAchievements.length > 0) {
          dispatch({ type: 'SET_NEW_ACHIEVEMENTS', payload: achievementResult.newAchievements })
        }
        
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
      }
      
      // Save to database
      try {
        const correctCount = gradingResults.filter(result => result.is_correct).length
        const accuracy = correctCount / gradingResults.length
        const score = Math.round(accuracy * 100)

        await fetch('/api/practice/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            exerciseData: exercise,
            difficulty: state.difficulty,
            language: state.language,
            topic: state.topic,
            accuracy: accuracy,
            score: score,
            duration: practiceDurationSec
          })
        })
      } catch (error) {
        console.error('Failed to save exercise to database:', error)
      }
      
      dispatch({ type: 'SET_STEP', payload: 'results' })
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
        description: t("messages.gradingFailedDesc", { values: { error: errorMessage } }),
        variant: "destructive",
      })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { loading: false } })
    }
  }, [state.questions, state.transcript, state.answers, state.difficulty, state.language, state.topic, state.audioDuration, state.duration, toast, t])

  // 重新开始
  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET' })
    exerciseStartTimeRef.current = null
  }, [])

  // 导出练习
  const handleExport = useCallback(() => {
    if (state.currentExercise) {
      exportToTxt(state.currentExercise)
      toast({
        title: t("messages.exportSuccess"),
        description: t("messages.exportSuccessDesc"),
      })
    }
  }, [state.currentExercise, toast, t])

  // 恢复历史练习
  const handleRestoreExercise = useCallback((exercise: Exercise) => {
    dispatch({ type: 'SET_DIFFICULTY', payload: exercise.difficulty })
    dispatch({ type: 'SET_TOPIC', payload: exercise.topic })
    dispatch({ type: 'SET_TRANSCRIPT', payload: exercise.transcript })
    dispatch({ type: 'SET_QUESTIONS', payload: exercise.questions })
    dispatch({ type: 'SET_CURRENT_EXERCISE', payload: exercise })
    
    const restoredAnswers: Record<number, string> = {}
    exercise.results.forEach((result, index) => {
      const key = result.question_id ?? index
      restoredAnswers[key] = result.user_answer || ""
    })
    dispatch({ type: 'SET_ANSWERS', payload: restoredAnswers })
    
    dispatch({ type: 'SET_AUDIO_URL', payload: '' })
    dispatch({ type: 'SET_AUDIO_DURATION', payload: null })
    dispatch({ type: 'SET_AUDIO_ERROR', payload: false })
    dispatch({ type: 'SET_STEP', payload: 'results' })
    exerciseStartTimeRef.current = null
  }, [])

  return {
    // State
    state,
    
    // Computed
    wordCount,
    isSetupComplete,
    
    // Actions
    ...actions,
    
    // Handlers
    handleGenerateTopics,
    handleRefreshTopics,
    handleGenerateTranscript,
    handleGenerateAudio,
    handleStartQuestions,
    handleSubmitAnswers,
    handleRestart,
    handleExport,
    handleRestoreExercise,
  }
}
