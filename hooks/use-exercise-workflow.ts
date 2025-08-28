/**
 * 练习流程管理 Hook
 * 从主页面组件中提取的练习流程状态管理逻辑
 */

import { useState, useCallback, useReducer, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { generateTopics, generateTranscript, generateQuestions, gradeAnswers } from "@/lib/ai-service"
import { generateAudio } from "@/lib/tts-service"
import { saveToHistory } from "@/lib/storage"
import { mapDifficultyToCEFR } from "@/lib/difficulty-service"
import type { Exercise, Question, DifficultyLevel } from "@/lib/types"
import type { AssessmentInfo } from "./use-invitation-code"

export type ExerciseStep = 'setup' | 'listening' | 'questions' | 'results'

export interface ExerciseFormData {
  topic: string
  customTopic: string
  difficulty: DifficultyLevel
  duration: number
  focus: string
}

interface ExerciseState {
  currentStep: ExerciseStep
  formData: ExerciseFormData
  isGenerating: boolean
  generationProgress: string
  transcript: string
  audioUrl: string
  questions: Question[]
  userAnswers: string[]
  results: any | null
  exercise: Exercise | null
  suggestedTopics: string[]
  error: string | null
}

type ExerciseAction =
  | { type: 'SET_STEP'; payload: ExerciseStep }
  | { type: 'SET_FORM_DATA'; payload: Partial<ExerciseFormData> }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_PROGRESS'; payload: string }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_AUDIO_URL'; payload: string }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'SET_USER_ANSWERS'; payload: string[] }
  | { type: 'SET_RESULTS'; payload: any }
  | { type: 'SET_EXERCISE'; payload: Exercise }
  | { type: 'SET_SUGGESTED_TOPICS'; payload: string[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' }

function createInitialState(assessmentInfo?: AssessmentInfo): ExerciseState {
  // 根据用户评估结果设置推荐难度，如果没有评估则使用默认的B1
  let recommendedDifficulty: DifficultyLevel = 'B1'
  
  if (assessmentInfo?.hasAssessment && assessmentInfo.difficultyLevel) {
    recommendedDifficulty = mapDifficultyToCEFR(assessmentInfo.difficultyLevel) as DifficultyLevel
  }

  return {
    currentStep: 'setup',
    formData: {
      topic: '',
      customTopic: '',
      difficulty: recommendedDifficulty,
      duration: 120,
      focus: ''
    },
    isGenerating: false,
    generationProgress: '',
    transcript: '',
    audioUrl: '',
    questions: [],
    userAnswers: [],
    results: null,
    exercise: null,
    suggestedTopics: [],
    error: null
  }
}

function exerciseReducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }
    case 'SET_FORM_DATA':
      return { 
        ...state, 
        formData: { ...state.formData, ...action.payload },
        error: null
      }
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload }
    case 'SET_PROGRESS':
      return { ...state, generationProgress: action.payload }
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload }
    case 'SET_AUDIO_URL':
      return { ...state, audioUrl: action.payload }
    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload }
    case 'SET_USER_ANSWERS':
      return { ...state, userAnswers: action.payload }
    case 'SET_RESULTS':
      return { ...state, results: action.payload }
    case 'SET_EXERCISE':
      return { ...state, exercise: action.payload }
    case 'SET_SUGGESTED_TOPICS':
      return { ...state, suggestedTopics: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isGenerating: false }
    case 'RESET':
      return { ...createInitialState(), formData: state.formData }
    default:
      return state
  }
}

export function useExerciseWorkflow(assessmentInfo?: AssessmentInfo) {
  const [state, dispatch] = useReducer(exerciseReducer, createInitialState(assessmentInfo))
  const { toast } = useToast()

  // 生成话题建议
  const generateTopicSuggestions = useCallback(async () => {
    try {
      dispatch({ type: 'SET_GENERATING', payload: true })
      dispatch({ type: 'SET_PROGRESS', payload: '正在生成话题建议...' })
      
      const topics = await generateTopics(state.formData.difficulty, state.formData.duration)
      dispatch({ type: 'SET_SUGGESTED_TOPICS', payload: topics })
      
      toast({
        title: "话题生成成功",
        description: "已为您生成了话题建议，请选择一个开始练习",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成话题失败'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      
      toast({
        title: "生成失败",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      dispatch({ type: 'SET_GENERATING', payload: false })
    }
  }, [state.formData.difficulty, state.formData.duration, toast])

  // 开始练习
  const startExercise = useCallback(async (invitationCode: string) => {
    const selectedTopic = state.formData.topic === 'custom' ? state.formData.customTopic : state.formData.topic
    
    if (!selectedTopic.trim()) {
      toast({
        title: "请选择话题",
        description: "请选择一个话题或输入自定义话题",
        variant: "destructive",
      })
      return false
    }

    try {
      dispatch({ type: 'SET_GENERATING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      // 生成文稿
      dispatch({ type: 'SET_PROGRESS', payload: '正在生成听力文稿...' })
      const transcript = await generateTranscript(
        state.formData.difficulty,
        state.formData.duration * 50, // 估算字数，50字/分钟
        selectedTopic,
        'en-US',
        20 // 默认难度等级
      )
      dispatch({ type: 'SET_TRANSCRIPT', payload: transcript })

      // 生成音频
      dispatch({ type: 'SET_PROGRESS', payload: '正在生成音频...' })
      const audioUrl = await generateAudio(transcript)
      dispatch({ type: 'SET_AUDIO_URL', payload: audioUrl })

      // 生成问题  
      dispatch({ type: 'SET_PROGRESS', payload: '正在生成问题...' })
      const questions = await generateQuestions(
        state.formData.difficulty,
        transcript,
        'en-US',
        state.formData.duration,
        20 // 默认难度等级
      )
      dispatch({ type: 'SET_QUESTIONS', payload: questions })

      // 创建练习对象
      const exercise: Exercise = {
        id: Date.now().toString(),
        difficulty: state.formData.difficulty,
        language: 'en-US',
        topic: selectedTopic,
        transcript,
        questions,
        answers: {},
        results: [],
        createdAt: new Date().toISOString()
      }
      dispatch({ type: 'SET_EXERCISE', payload: exercise })

      // 保存到历史记录
      saveToHistory(exercise)

      dispatch({ type: 'SET_STEP', payload: 'listening' })
      
      toast({
        title: "练习准备完成",
        description: "听力材料已生成，请开始听音频",
      })
      
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成练习失败'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      
      toast({
        title: "生成失败",
        description: errorMessage,
        variant: "destructive",
      })
      
      return false
    } finally {
      dispatch({ type: 'SET_GENERATING', payload: false })
    }
  }, [state.formData, toast])

  // 开始答题
  const startQuestions = useCallback(() => {
    dispatch({ type: 'SET_STEP', payload: 'questions' })
    dispatch({ type: 'SET_USER_ANSWERS', payload: new Array(state.questions.length).fill('') })
  }, [state.questions.length])

  // 提交答案
  const submitAnswers = useCallback(async (invitationCode: string) => {
    if (!state.exercise) {
      toast({
        title: "错误",
        description: "练习数据丢失，请重新开始",
        variant: "destructive",
      })
      return false
    }

    try {
      dispatch({ type: 'SET_GENERATING', payload: true })
      dispatch({ type: 'SET_PROGRESS', payload: '正在评分...' })

      const results = await gradeAnswers(
        state.exercise.transcript,
        state.exercise.questions,
        state.userAnswers.reduce((acc, answer, index) => ({ ...acc, [index]: answer }), {}),
        'en-US'
      )

      dispatch({ type: 'SET_RESULTS', payload: results })
      dispatch({ type: 'SET_STEP', payload: 'results' })

      const correctCount = results.filter(r => r.is_correct).length
      
      toast({
        title: "评分完成",
        description: `您的得分：${correctCount}/${results.length}`,
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '评分失败'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      
      toast({
        title: "评分失败",
        description: errorMessage,
        variant: "destructive",
      })
      
      return false
    } finally {
      dispatch({ type: 'SET_GENERATING', payload: false })
    }
  }, [state.exercise, state.userAnswers, toast])

  // 重新开始
  const resetExercise = useCallback(() => {
    dispatch({ type: 'RESET' })
    toast({
      title: "已重置",
      description: "练习已重置，可以开始新的练习",
    })
  }, [toast])

  // 更新表单数据
  const updateFormData = useCallback((data: Partial<ExerciseFormData>) => {
    dispatch({ type: 'SET_FORM_DATA', payload: data })
  }, [])

  // 更新用户答案
  const updateUserAnswer = useCallback((index: number, answer: string) => {
    const newAnswers = [...state.userAnswers]
    newAnswers[index] = answer
    dispatch({ type: 'SET_USER_ANSWERS', payload: newAnswers })
  }, [state.userAnswers])

  // 计算进度
  const progress = useMemo(() => {
    switch (state.currentStep) {
      case 'setup': return 0
      case 'listening': return 33
      case 'questions': return 66
      case 'results': return 100
      default: return 0
    }
  }, [state.currentStep])

  // 检查是否可以继续下一步
  const canProceed = useMemo(() => {
    switch (state.currentStep) {
      case 'setup':
        return !state.isGenerating && (state.formData.topic !== '' || state.formData.customTopic.trim() !== '')
      case 'listening':
        return !state.isGenerating && state.audioUrl !== ''
      case 'questions':
        return state.userAnswers.every(answer => answer.trim() !== '')
      case 'results':
        return true
      default:
        return false
    }
  }, [state.currentStep, state.isGenerating, state.formData, state.audioUrl, state.userAnswers])

  return {
    state,
    progress,
    canProceed,
    generateTopicSuggestions,
    startExercise,
    startQuestions,
    submitAnswers,
    resetExercise,
    updateFormData,
    updateUserAnswer
  }
}