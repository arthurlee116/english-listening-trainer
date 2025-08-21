"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Loader2, Play, Pause, SkipBack, SkipForward } from "lucide-react"
import type { Question } from "@/lib/types"

// 简化的音频播放器Hook，专门用于问题界面
function useSimpleAudioPlayer(audioUrl: string) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [audioUrl])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(console.error)
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

  return {
    isPlaying,
    currentTime,
    duration,
    audioRef,
    togglePlayPause,
    handleSeek,
    skipBackward,
    skipForward,
    formatTime
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
}

export const QuestionInterface = React.memo(function QuestionInterface({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  loading,
  loadingMessage,
  audioUrl,
  transcript,
}: QuestionInterfaceProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    audioRef,
    togglePlayPause,
    handleSeek,
    skipBackward,
    skipForward,
    formatTime
  } = useSimpleAudioPlayer(audioUrl)

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
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const progress = useMemo(() => (answeredCount / questions.length) * 100, [answeredCount, questions.length])
  const canSubmit = useMemo(() => answeredCount === questions.length && !loading, [answeredCount, questions.length, loading])

  return (
    <div className="space-y-6">
      {/* 音频播放器 */}
      {audioUrl && (
        <Card className="glass-effect p-6">
          <h3 className="text-lg font-medium mb-4 text-center">音频播放器</h3>
          
          <audio ref={audioRef} src={audioUrl} preload="metadata" />

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
              className="glass-effect bg-transparent rounded-full"
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              size="lg"
              onClick={togglePlayPause}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-12 h-12 rounded-full"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={skipForward}
              className="glass-effect bg-transparent rounded-full"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Volume control removed as per UX request */}
        </Card>
      )}

      {/* 答题进度 */}
      <Card className="glass-effect p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Questions</h2>
          <div className="text-sm text-gray-600">
            {answeredCount} / {questions.length} answered
          </div>
        </div>
        <Progress value={progress} className="mb-6" />
      </Card>

      {/* 题目列表 */}
      {questions.map((question, index) => (
        <Card key={index} className="glass-effect p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">Q{index + 1}</span>
              {question.type === "short" && (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">Short Answer</span>
              )}
            </div>
            <h3 className="text-lg font-medium mb-4">{question.question}</h3>
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
              placeholder="Write your answer here..."
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
            "Submit Answers"
          )}
        </Button>
      </Card>

      {/* 听力稿（隐藏，仅供紧急情况） */}
      <Card className="glass-effect p-4">
        <details>
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            紧急情况：显示听力稿 (请尽量先听音频！)
          </summary>
          <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700">
            {transcript}
          </div>
        </details>
      </Card>
    </div>
  )
})
