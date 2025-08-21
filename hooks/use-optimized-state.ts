import { useReducer, useCallback, useMemo } from 'react'
import type { Exercise, Question, DifficultyLevel } from '@/lib/types'

// 应用状态类型定义
interface AppState {
  // 步骤状态
  step: "setup" | "listening" | "questions" | "results" | "history" | "wrong-answers"
  
  // 设置相关
  difficulty: string
  duration: number
  topic: string
  suggestedTopics: string[]
  
  // 内容相关
  transcript: string
  audioUrl: string
  audioError: boolean
  questions: Question[]
  answers: Record<number, string>
  currentExercise: Exercise | null
  
  // UI状态
  loading: boolean
  loadingMessage: string
  canRegenerate: boolean
  
  // 缓存和优化
  lastGeneratedTopics: { difficulty: string; topics: string[]; timestamp: number } | null
  lastGeneratedTranscript: { key: string; transcript: string; timestamp: number } | null
}

// 状态操作类型
type AppAction = 
  | { type: 'SET_STEP'; payload: AppState['step'] }
  | { type: 'SET_DIFFICULTY'; payload: string }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_TOPIC'; payload: string }
  | { type: 'SET_SUGGESTED_TOPICS'; payload: string[] }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_AUDIO_URL'; payload: string }
  | { type: 'SET_AUDIO_ERROR'; payload: boolean }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'SET_ANSWERS'; payload: Record<number, string> }
  | { type: 'UPDATE_ANSWER'; payload: { index: number; value: string } }
  | { type: 'SET_CURRENT_EXERCISE'; payload: Exercise | null }
  | { type: 'SET_LOADING'; payload: { loading: boolean; message?: string } }
  | { type: 'SET_CAN_REGENERATE'; payload: boolean }
  | { type: 'CACHE_TOPICS'; payload: { difficulty: string; topics: string[] } }
  | { type: 'CACHE_TRANSCRIPT'; payload: { key: string; transcript: string } }
  | { type: 'RESET_EXERCISE' }
  | { type: 'RESTORE_EXERCISE'; payload: Exercise }

// 初始状态
const initialState: AppState = {
  step: "setup",
  difficulty: "",
  duration: 120,
  topic: "",
  suggestedTopics: [],
  transcript: "",
  audioUrl: "",
  audioError: false,
  questions: [],
  answers: {},
  currentExercise: null,
  loading: false,
  loadingMessage: "",
  canRegenerate: true,
  lastGeneratedTopics: null,
  lastGeneratedTranscript: null
}

// 状态缩减器
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload }
      
    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.payload }
      
    case 'SET_DURATION':
      return { ...state, duration: action.payload }
      
    case 'SET_TOPIC':
      return { ...state, topic: action.payload }
      
    case 'SET_SUGGESTED_TOPICS':
      return { ...state, suggestedTopics: action.payload }
      
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload }
      
    case 'SET_AUDIO_URL':
      return { ...state, audioUrl: action.payload, audioError: false }
      
    case 'SET_AUDIO_ERROR':
      return { ...state, audioError: action.payload }
      
    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload, answers: {} }
      
    case 'SET_ANSWERS':
      return { ...state, answers: action.payload }
      
    case 'UPDATE_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.index]: action.payload.value
        }
      }
      
    case 'SET_CURRENT_EXERCISE':
      return { ...state, currentExercise: action.payload }
      
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload.loading,
        loadingMessage: action.payload.message || ""
      }
      
    case 'SET_CAN_REGENERATE':
      return { ...state, canRegenerate: action.payload }
      
    case 'CACHE_TOPICS':
      return {
        ...state,
        lastGeneratedTopics: {
          difficulty: action.payload.difficulty,
          topics: action.payload.topics,
          timestamp: Date.now()
        }
      }
      
    case 'CACHE_TRANSCRIPT':
      return {
        ...state,
        lastGeneratedTranscript: {
          key: action.payload.key,
          transcript: action.payload.transcript,
          timestamp: Date.now()
        }
      }
      
    case 'RESET_EXERCISE':
      return {
        ...initialState,
        difficulty: state.difficulty, // 保留已选择的难度
        duration: state.duration,     // 保留已选择的时长
        lastGeneratedTopics: state.lastGeneratedTopics, // 保留缓存
        lastGeneratedTranscript: state.lastGeneratedTranscript
      }
      
    case 'RESTORE_EXERCISE':
      const exercise = action.payload
      const restoredAnswers: Record<number, string> = {}
      
      exercise.results.forEach((result, index) => {
        const key = result.question_id ?? index
        restoredAnswers[key] = result.user_answer || ""
      })
      
      return {
        ...state,
        difficulty: exercise.difficulty,
        topic: exercise.topic,
        transcript: exercise.transcript,
        questions: exercise.questions,
        answers: restoredAnswers,
        currentExercise: exercise,
        audioUrl: "", // 清除音频状态
        audioError: false,
        step: "results"
      }
      
    default:
      return state
  }
}

// 优化的状态管理Hook
export function useOptimizedAppState() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  
  // 记忆化的派发函数
  const actions = useMemo(() => ({
    setStep: (step: AppState['step']) => dispatch({ type: 'SET_STEP', payload: step }),
    setDifficulty: (difficulty: string) => dispatch({ type: 'SET_DIFFICULTY', payload: difficulty }),
    setDuration: (duration: number) => dispatch({ type: 'SET_DURATION', payload: duration }),
    setTopic: (topic: string) => dispatch({ type: 'SET_TOPIC', payload: topic }),
    setSuggestedTopics: (topics: string[]) => dispatch({ type: 'SET_SUGGESTED_TOPICS', payload: topics }),
    setTranscript: (transcript: string) => dispatch({ type: 'SET_TRANSCRIPT', payload: transcript }),
    setAudioUrl: (url: string) => dispatch({ type: 'SET_AUDIO_URL', payload: url }),
    setAudioError: (error: boolean) => dispatch({ type: 'SET_AUDIO_ERROR', payload: error }),
    setQuestions: (questions: Question[]) => dispatch({ type: 'SET_QUESTIONS', payload: questions }),
    setAnswers: (answers: Record<number, string>) => dispatch({ type: 'SET_ANSWERS', payload: answers }),
    updateAnswer: (index: number, value: string) => dispatch({ type: 'UPDATE_ANSWER', payload: { index, value } }),
    setCurrentExercise: (exercise: Exercise | null) => dispatch({ type: 'SET_CURRENT_EXERCISE', payload: exercise }),
    setLoading: (loading: boolean, message?: string) => dispatch({ type: 'SET_LOADING', payload: { loading, message } }),
    setCanRegenerate: (canRegenerate: boolean) => dispatch({ type: 'SET_CAN_REGENERATE', payload: canRegenerate }),
    cacheTopics: (difficulty: string, topics: string[]) => dispatch({ type: 'CACHE_TOPICS', payload: { difficulty, topics } }),
    cacheTranscript: (key: string, transcript: string) => dispatch({ type: 'CACHE_TRANSCRIPT', payload: { key, transcript } }),
    resetExercise: () => dispatch({ type: 'RESET_EXERCISE' }),
    restoreExercise: (exercise: Exercise) => dispatch({ type: 'RESTORE_EXERCISE', payload: exercise })
  }), [])
  
  // 记忆化的计算属性
  const computed = useMemo(() => ({
    wordCount: state.duration * 2, // 120 words per minute / 60 seconds = 2 words per second
    isSetupComplete: Boolean(state.difficulty && state.topic),
    canGenerateQuestions: Boolean(state.transcript),
    canSubmitAnswers: state.questions.length > 0 && Object.keys(state.answers).length === state.questions.length,
    
    // 缓存相关计算
    canUseCachedTopics: state.lastGeneratedTopics && 
      state.lastGeneratedTopics.difficulty === state.difficulty &&
      Date.now() - state.lastGeneratedTopics.timestamp < 10 * 60 * 1000, // 10分钟内有效
      
    transcriptCacheKey: `${state.difficulty}:${state.topic}:${state.duration * 2}`,
    canUseCachedTranscript: state.lastGeneratedTranscript &&
      state.lastGeneratedTranscript.key === `${state.difficulty}:${state.topic}:${state.duration * 2}` &&
      Date.now() - state.lastGeneratedTranscript.timestamp < 20 * 60 * 1000 // 20分钟内有效
  }), [state.difficulty, state.topic, state.duration, state.transcript, state.questions, state.answers, state.lastGeneratedTopics, state.lastGeneratedTranscript])
  
  // 优化的缓存检查函数
  const getCachedTopics = useCallback((): string[] | null => {
    if (computed.canUseCachedTopics && state.lastGeneratedTopics) {
      return state.lastGeneratedTopics.topics
    }
    return null
  }, [computed.canUseCachedTopics, state.lastGeneratedTopics])
  
  const getCachedTranscript = useCallback((): string | null => {
    if (computed.canUseCachedTranscript && state.lastGeneratedTranscript) {
      return state.lastGeneratedTranscript.transcript
    }
    return null
  }, [computed.canUseCachedTranscript, state.lastGeneratedTranscript])
  
  return useMemo(() => ({
    state,
    actions,
    computed,
    getCachedTopics,
    getCachedTranscript
  }), [state, actions, computed, getCachedTopics, getCachedTranscript])
}

// 邀请码状态管理
interface InvitationState {
  code: string
  isVerified: boolean
  usageInfo: { todayUsage: number; remainingUsage: number }
  showDialog: boolean
}

type InvitationAction =
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_VERIFIED'; payload: boolean }
  | { type: 'SET_USAGE_INFO'; payload: { todayUsage: number; remainingUsage: number } }
  | { type: 'SET_SHOW_DIALOG'; payload: boolean }
  | { type: 'LOGOUT' }

const invitationInitialState: InvitationState = {
  code: "",
  isVerified: false,
  usageInfo: { todayUsage: 0, remainingUsage: 5 },
  showDialog: false
}

function invitationReducer(state: InvitationState, action: InvitationAction): InvitationState {
  switch (action.type) {
    case 'SET_CODE':
      return { ...state, code: action.payload }
    case 'SET_VERIFIED':
      return { ...state, isVerified: action.payload }
    case 'SET_USAGE_INFO':
      return { ...state, usageInfo: action.payload }
    case 'SET_SHOW_DIALOG':
      return { ...state, showDialog: action.payload }
    case 'LOGOUT':
      return invitationInitialState
    default:
      return state
  }
}

export function useOptimizedInvitationState() {
  const [state, dispatch] = useReducer(invitationReducer, invitationInitialState)
  
  const actions = useMemo(() => ({
    setCode: (code: string) => dispatch({ type: 'SET_CODE', payload: code }),
    setVerified: (verified: boolean) => dispatch({ type: 'SET_VERIFIED', payload: verified }),
    setUsageInfo: (info: { todayUsage: number; remainingUsage: number }) => 
      dispatch({ type: 'SET_USAGE_INFO', payload: info }),
    setShowDialog: (show: boolean) => dispatch({ type: 'SET_SHOW_DIALOG', payload: show }),
    logout: () => dispatch({ type: 'LOGOUT' })
  }), [])
  
  return useMemo(() => ({ state, actions }), [state, actions])
}