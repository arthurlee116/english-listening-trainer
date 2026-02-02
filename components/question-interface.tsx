"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Pause, SkipBack, SkipForward } from "lucide-react"
import type { Question } from "@/lib/types"

import { useBilingualText } from "@/hooks/use-bilingual-text"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { PLAYBACK_SPEED_OPTIONS, PLAYBACK_RATE_STORAGE_KEY, DEFAULT_PLAYBACK_RATE, parsePlaybackRate } from "@/lib/constants"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useToast } from "@/hooks/use-toast"

// 简化的音频播放器Hook，专门用于问题界面
function useSimpleAudioPlayer(audioUrl: string, initialDuration?: number) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration ?? 0)
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE)
  const [activeUrl, setActiveUrl] = useState(audioUrl)
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasTriedFallbackRef = useRef(false)

  const fallbackUrl = useMemo(() => {
    if (!audioUrl) return ''
    if (audioUrl.startsWith('/api/audio/')) {
      return audioUrl.replace('/api/audio/', '/audio/')
    }
    if (audioUrl.startsWith('/audio/')) {
      return audioUrl.replace('/audio/', '/api/audio/')
    }
    return ''
  }, [audioUrl])

  useEffect(() => {
    setActiveUrl(audioUrl)
    hasTriedFallbackRef.current = false
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeUrl) return

    setCurrentTime(0)
    setDuration(initialDuration ?? 0)

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)
    const handleError = () => {
      if (!hasTriedFallbackRef.current && fallbackUrl && fallbackUrl !== activeUrl) {
        hasTriedFallbackRef.current = true
        setActiveUrl(fallbackUrl)
        try {
          audio.pause()
          audio.src = fallbackUrl
          audio.load()
        } catch {
          setIsPlaying(false)
        }
        return
      }
      setIsPlaying(false)
    }

    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("error", handleError)
    // 应用当前倍速
    try {
      audio.playbackRate = playbackRate
    } catch {
      audio.playbackRate = DEFAULT_PLAYBACK_RATE
    }

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("error", handleError)
    }
  }, [activeUrl, fallbackUrl, initialDuration, playbackRate])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(console.error)
      }
    }
  }, [isPlaying])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const newTime = (value[0] / 100) * duration
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration])

  const skipBackward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 10)
  }, [])

  const skipForward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(duration, audio.currentTime + 10)
  }, [duration])

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])

  useEffect(() => {
    if (typeof initialDuration === 'number' && initialDuration > 0) {
      setDuration(initialDuration)
    }
  }, [initialDuration])

  // 初始化读取倍速设置
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY) : null
      const rate = parsePlaybackRate(saved ?? DEFAULT_PLAYBACK_RATE)
      setPlaybackRate(rate)
      const audio = audioRef.current
      if (audio) {
        audio.playbackRate = rate
      }
    } catch {
      setPlaybackRate(DEFAULT_PLAYBACK_RATE)
    }
  }, [])

  // 倍速变化时应用到音频元素
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.playbackRate = playbackRate
    } catch {
      audio.playbackRate = DEFAULT_PLAYBACK_RATE
      setPlaybackRate(DEFAULT_PLAYBACK_RATE)
    }
  }, [playbackRate])

  return {
    isPlaying,
    currentTime,
    duration,
    audioRef,
    playbackRate,
    setPlaybackRate,
    togglePlayPause,
    handleSeek,
    skipBackward,
    skipForward,
    formatTime,
    activeUrl
  }
}

interface QuestionInterfaceProps {
  questions: Question[]
  answers: Record<number, string>
  onAnswerChange: (answers: Record<number, string>) => void
  onSubmit: () => void
  loading: boolean
  loadingMessage: string
  audioUrl: string
  transcript: string
  initialDuration?: number
}

const QuestionInterfaceComponent = ({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  loading,
  loadingMessage,
  audioUrl,
  transcript,
  initialDuration,
}: QuestionInterfaceProps) => {
  const { t } = useBilingualText()
  const { toast } = useToast()
  const {
    isPlaying,
    currentTime,
    duration,
    audioRef,
    playbackRate,
    setPlaybackRate,
    togglePlayPause,
    handleSeek,
    skipBackward,
    skipForward,
    formatTime,
    activeUrl
  } = useSimpleAudioPlayer(audioUrl, initialDuration)

  // storage 事件同步倍速
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLAYBACK_RATE_STORAGE_KEY) {
        const rate = parsePlaybackRate(e.newValue ?? DEFAULT_PLAYBACK_RATE)
        setPlaybackRate(rate)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setPlaybackRate])

  const handleRateChange = useCallback((value: string) => {
    const next = parsePlaybackRate(value)
    setPlaybackRate(next)
    try {
      window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(next))
    } catch {
      // Ignore localStorage errors
    }
    toast({
      title: t("components.audioPlayer.playbackRateChangedTitle"),
      description: t("components.audioPlayer.playbackRateChangedDesc", {
        values: { rate: next },
      }),
    })
  }, [setPlaybackRate, toast, t])

  // 答题逻辑 - 优化性能
  const handleSingleChoiceAnswer = useCallback((questionIndex: number, value: string) => {
    onAnswerChange({
      ...answers,
      [questionIndex]: value,
    })
  }, [answers, onAnswerChange])

  const handleShortAnswer = useCallback((questionIndex: number, value: string) => {
    onAnswerChange({
      ...answers,
      [questionIndex]: value,
    })
  }, [answers, onAnswerChange])

  // 记忆化计算
  const answeredCount = useMemo(() => Object.values(answers).filter(answer => answer?.trim()).length, [answers])
  const progress = useMemo(() => (answeredCount / questions.length) * 100, [answeredCount, questions.length])
  const canSubmit = useMemo(() => answeredCount >= questions.length && !loading, [answeredCount, questions.length, loading])

  return (
    <div className="space-y-6">
      {/* 音频播放器 */}
      {audioUrl && (
        <Card className="glass-effect p-6">
          <h3 className="text-lg font-medium mb-4 text-center">{t('components.questionInterface.audioPlayer')}</h3>
          
          <audio ref={audioRef} src={activeUrl} preload="auto" playsInline />

          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[duration ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={skipBackward}
              aria-label={t('components.audioPlayer.skipBackward')}
              title={t('components.audioPlayer.skipBackward')}
              className="glass-effect bg-transparent rounded-full"
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              size="lg"
              onClick={togglePlayPause}
              aria-label={isPlaying ? t('components.audioPlayer.pause') : t('components.audioPlayer.play')}
              title={isPlaying ? t('components.audioPlayer.pause') : t('components.audioPlayer.play')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-12 h-12 rounded-full"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={skipForward}
              aria-label={t('components.audioPlayer.skipForward')}
              title={t('components.audioPlayer.skipForward')}
              className="glass-effect bg-transparent rounded-full"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Playback Speed */}
          <div className="flex items-center gap-3 mb-2 justify-center">
            <span className="text-sm text-gray-600">
              <BilingualText translationKey="components.audioPlayer.playbackRateLabel" />
            </span>
            <Select value={String(playbackRate)} onValueChange={handleRateChange}>
              <SelectTrigger aria-label={t("components.audioPlayer.playbackRateAriaLabel")} className="w-28">
                <SelectValue placeholder={t("components.audioPlayer.playbackRatePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_SPEED_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    <BilingualText translationKey={opt.labelKey} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Volume control removed as per UX request */}
        </Card>
      )}

      {/* 答题进度 */}
      <Card className="glass-effect p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{t('components.questionInterface.questions')}</h2>
          <div className="text-sm text-gray-600">
            {answeredCount} / {questions.length} {t('components.questionInterface.answered')}
          </div>
        </div>
        <Progress value={progress} className="mb-6" />
      </Card>

      {/* 题目列表 */}
      {questions.map((question, index) => (
        <Card key={index} className="glass-effect p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                {t('components.questionInterface.questionNumber', {
                  values: { number: index + 1 },
                })}
              </span>
              {question.type === "short" && (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">{t('components.questionInterface.shortAnswer')}</span>
              )}
            </div>
            <h3 className="text-lg font-medium mb-4">{question.question}</h3>
            
            {/* Focus Areas Display */}
            {question.focus_areas && question.focus_areas.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600 font-medium">
                    {t('components.questionInterface.focusAreas')}:
                  </span>
                  {question.focus_areas.filter(area => area && typeof area === 'string').map((area) => (
                    <Badge
                      key={area}
                      variant="outline"
                      className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                    >
                      {t(`components.specializedPractice.focusAreas.${area}`)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {question.type === "single" && question.options ? (
            <RadioGroup value={answers[index] || ""} onValueChange={(value) => handleSingleChoiceAnswer(index, value)}>
              {question.options.map((option, optionIndex) => {
                const optionLabel = String.fromCharCode(65 + optionIndex); // A, B, C, D
                return (
                  <div
                    key={optionIndex}
                    className="flex items-center space-x-2 p-3 rounded-lg hover:translate-y-[-2px] hover:shadow-md transition"
                  >
                    <RadioGroupItem value={option} id={`q${index}-${optionIndex}`} />
                    <Label htmlFor={`q${index}-${optionIndex}`} className="flex-1 cursor-pointer">
                      <span className="font-semibold text-blue-600 mr-2">{optionLabel}.</span>
                      {option}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          ) : (
            <Textarea
              value={answers[index] || ""}
              onChange={(e) => handleShortAnswer(index, e.target.value)}
              placeholder={t('components.questionInterface.writeAnswerPlaceholder')}
              className="min-h-[120px]"
            />
          )}
        </Card>
      ))}

      {/* 提交按钮 */}
      <Card className="glass-effect p-6">
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {loadingMessage}
            </>
          ) : (
            t('components.questionInterface.submitAnswers')
          )}
        </Button>
      </Card>

      {/* 听力稿（隐藏，仅供紧急情况） */}
      <Card className="glass-effect p-4">
        <details>
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            {t('components.questionInterface.emergencyTranscriptHint')}
          </summary>
          <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700">
            {transcript}
          </div>
        </details>
      </Card>
    </div>
  )
}

QuestionInterfaceComponent.displayName = "QuestionInterface"

export const QuestionInterface = React.memo(QuestionInterfaceComponent)
