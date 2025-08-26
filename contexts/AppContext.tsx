"use client"

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { 
  Exercise, 
  UserAssessment, 
  InvitationCodeState,
  AppError,
  LoadingState
} from '@/lib/types'

// AppState接口定义
interface AppState {
  // 邀请码状态
  invitationCode: string | null
  invitationCodeState: InvitationCodeState
  
  // 用户评估
  userAssessment: UserAssessment | null
  
  // 当前练习
  currentExercise: Exercise | null
  
  // 加载状态
  loading: LoadingState
  
  // 错误状态
  error: AppError | null
  
  // UI状态
  isHistoryOpen: boolean
  isMobileMenuOpen: boolean
}

// AppAction接口定义
type AppAction = 
  | { type: 'SET_INVITATION_CODE'; payload: string | null }
  | { type: 'SET_INVITATION_STATE'; payload: InvitationCodeState }
  | { type: 'SET_USER_ASSESSMENT'; payload: UserAssessment | null }
  | { type: 'SET_CURRENT_EXERCISE'; payload: Exercise | null }
  | { type: 'SET_LOADING'; payload: LoadingState }
  | { type: 'SET_ERROR'; payload: AppError | null }
  | { type: 'TOGGLE_HISTORY' }
  | { type: 'TOGGLE_MOBILE_MENU' }
  | { type: 'RESET_APP' }

// 初始状态
const initialState: AppState = {
  invitationCode: null,
  invitationCodeState: 'unverified',
  userAssessment: null,
  currentExercise: null,
  loading: {
    isLoading: false,
    loadingText: '',
    progress: 0
  },
  error: null,
  isHistoryOpen: false,
  isMobileMenuOpen: false
}

// Reducer函数
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INVITATION_CODE':
      return { ...state, invitationCode: action.payload }
    case 'SET_INVITATION_STATE':
      return { ...state, invitationCodeState: action.payload }
    case 'SET_USER_ASSESSMENT':
      return { ...state, userAssessment: action.payload }
    case 'SET_CURRENT_EXERCISE':
      return { ...state, currentExercise: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'TOGGLE_HISTORY':
      return { ...state, isHistoryOpen: !state.isHistoryOpen }
    case 'TOGGLE_MOBILE_MENU':
      return { ...state, isMobileMenuOpen: !state.isMobileMenuOpen }
    case 'RESET_APP':
      return initialState
    default:
      return state
  }
}

// Context接口
interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  
  // 便捷方法
  setInvitationCode: (code: string | null) => void
  setInvitationState: (state: InvitationCodeState) => void
  setUserAssessment: (assessment: UserAssessment | null) => void
  setCurrentExercise: (exercise: Exercise | null) => void
  setLoading: (loading: LoadingState) => void
  setError: (error: AppError | null) => void
  toggleHistory: () => void
  toggleMobileMenu: () => void
  resetApp: () => void
}

// 创建Context
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider组件
interface AppProviderProps {
  children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const { toast } = useToast()

  // 便捷方法
  const setInvitationCode = (code: string | null) => {
    dispatch({ type: 'SET_INVITATION_CODE', payload: code })
  }

  const setInvitationState = (invitationState: InvitationCodeState) => {
    dispatch({ type: 'SET_INVITATION_STATE', payload: invitationState })
  }

  const setUserAssessment = (assessment: UserAssessment | null) => {
    dispatch({ type: 'SET_USER_ASSESSMENT', payload: assessment })
  }

  const setCurrentExercise = (exercise: Exercise | null) => {
    dispatch({ type: 'SET_CURRENT_EXERCISE', payload: exercise })
  }

  const setLoading = (loading: LoadingState) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }

  const setError = (error: AppError | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
    
    // 自动显示错误toast
    if (error) {
      toast({
        title: "发生错误",
        description: error.message || "未知错误",
        variant: "destructive"
      })
    }
  }

  const toggleHistory = () => {
    dispatch({ type: 'TOGGLE_HISTORY' })
  }

  const toggleMobileMenu = () => {
    dispatch({ type: 'TOGGLE_MOBILE_MENU' })
  }

  const resetApp = () => {
    dispatch({ type: 'RESET_APP' })
  }

  // 从localStorage恢复邀请码
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCode = localStorage.getItem('invitationCode')
      if (savedCode) {
        setInvitationCode(savedCode)
        setInvitationState('verified')
      }
    }
  }, [])

  // 保存邀请码到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (state.invitationCode) {
        localStorage.setItem('invitationCode', state.invitationCode)
      } else {
        localStorage.removeItem('invitationCode')
      }
    }
  }, [state.invitationCode])

  const contextValue: AppContextType = {
    state,
    dispatch,
    setInvitationCode,
    setInvitationState,
    setUserAssessment,
    setCurrentExercise,
    setLoading,
    setError,
    toggleHistory,
    toggleMobileMenu,
    resetApp
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// Hook使用Context
export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

export type { AppState, AppAction, AppContextType }