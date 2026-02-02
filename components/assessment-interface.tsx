"use client"

import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Volume2, CheckCircle } from "lucide-react"
import AssessmentAudioPlayer from "@/components/assessment-audio-player"
import { Slider } from "@/components/ui/slider"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { ASSESSMENT_AUDIOS, calculateDifficultyLevel, getDifficultyRange } from "@/lib/difficulty-service"
interface AssessmentQuestion {
  id: number
  topic: string
  difficulty: number
  description: string
  filename: string
}

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

interface AssessmentInterfaceProps {
  onBack: () => void
  onComplete: (result: AssessmentResultType) => void
}

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  ...ASSESSMENT_AUDIOS.map((audio) => ({
    id: audio.id,
    topic: audio.topic,
    difficulty: audio.difficulty,
    description: audio.description,
    filename: audio.filename,
  })),
]

export function AssessmentInterface({ onBack, onComplete }: AssessmentInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [audioPlayed, setAudioPlayed] = useState<Record<number, boolean>>({})
  const [isComplete, setIsComplete] = useState(false)
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({})
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  // not using the translator directly here but keep hook for potential side-effects
  const _bilingual = useBilingualText()

  const currentQuestion = ASSESSMENT_QUESTIONS[currentIndex]
  const progress = ((currentIndex + 1) / ASSESSMENT_QUESTIONS.length) * 100
  const currentAudioUrl = audioUrls[currentQuestion.id]

  const fetchAssessmentAudio = useCallback(async (questionId: number) => {
    const maxRetries = 2
    const baseDelayMs = 600
    let lastError: Error | null = null
    const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504])

    const isRetryableError = (error: unknown) =>
      error instanceof TypeError || (error instanceof Error && (error as Error & { retryable?: boolean }).retryable === true)

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const res = await fetch(`/api/assessment-audio/${questionId}`)
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          const message = payload?.error || `音频准备失败: ${res.status}`
          const retryable = retryableStatusCodes.has(res.status)
          if (retryable && attempt < maxRetries) {
            lastError = new Error(message)
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 4000)
            await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 200))
            continue
          }
          const error = new Error(message)
          ;(error as Error & { retryable?: boolean }).retryable = retryable
          throw error
        }
        const url = payload?.url as string | undefined
        if (!url) {
          throw new Error('音频准备失败：未返回 URL')
        }
        return url
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('音频生成失败')
        if (isRetryableError(error) && attempt < maxRetries) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 4000)
          await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 200))
          continue
        }
        break
      }
    }

    throw lastError ?? new Error('音频生成失败')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function ensureAssessmentAudio() {
      setAudioError(null)

      if (audioUrls[currentQuestion.id]) {
        return
      }

      setAudioLoading(true)
      try {
        const url = await fetchAssessmentAudio(currentQuestion.id)
        if (cancelled) return
        setAudioUrls((prev) => ({ ...prev, [currentQuestion.id]: url }))
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : '音频生成失败'
        setAudioError(message)
      } finally {
        if (!cancelled) setAudioLoading(false)
      }
    }

    ensureAssessmentAudio()

    return () => {
      cancelled = true
    }
  }, [audioUrls, currentQuestion.id, fetchAssessmentAudio])
  
  const handleScoreSelect = (score: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: score
    }))
  }

  const handleNext = () => {
    if (currentIndex < ASSESSMENT_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // 完成评估，计算结果
      const scores = ASSESSMENT_QUESTIONS.map(q => answers[q.id] || 0)
      const difficultyLevel = calculateDifficultyLevel(scores)
      const difficultyRange = getDifficultyRange(difficultyLevel)

      const result = {
        difficultyLevel,
        difficultyRange,
        scores,
        summary: `基于您在 ${ASSESSMENT_QUESTIONS.length} 段音频测试中的表现，系统评估您的英语听力水平为 ${difficultyRange.name}。`,
        details: ASSESSMENT_QUESTIONS.map((q, index) => ({
          audioId: q.id,
          topic: q.topic,
          userScore: scores[index],
          difficulty: q.difficulty,
          performance: scores[index] >= 8 ? "优秀" : scores[index] >= 6 ? "良好" : scores[index] >= 4 ? "一般" : "需改进"
        })),
        recommendation: difficultyLevel < 10 
          ? "建议从基础练习开始，多听简单的日常对话内容。"
          : difficultyLevel < 20 
          ? "您的基础不错，可以挑战更多样化的话题和场景。"
          : "您的听力水平很好，可以尝试更具挑战性的专业内容。"
      }

      setIsComplete(true)
      onComplete(result)
    }
  }

  const canNext = answers[currentQuestion.id] !== undefined && audioPlayed[currentQuestion.id]

  const handleAudioEnded = () => {
    setAudioPlayed(prev => ({
      ...prev,
      [currentQuestion.id]: true
    }))
  }

  if (isComplete) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">
          <BilingualText translationKey="components.assessmentInterface.assessmentComplete" />
        </h2>
        <p className="text-gray-600">
          <BilingualText translationKey="components.assessmentInterface.analyzingResults" />
        </p>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold">
              <BilingualText translationKey="components.assessmentInterface.title" />
            </h2>
          </div>
          <Badge variant="outline">
            <BilingualText
              translationKey="components.assessmentInterface.questionCounter"
              options={{
                values: {
                  current: currentIndex + 1,
                  total: ASSESSMENT_QUESTIONS.length,
                },
              }}
            />
          </Badge>
        </div>
        
        <Progress value={progress} className="w-full" />
        <p className="text-sm text-gray-600 mt-2">
          <BilingualText translationKey="components.assessmentInterface.instructionText" />
        </p>
      </Card>

      {/* Current Question */}
      <Card className="p-8">
        <div className="text-center space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">
              <BilingualText
                translationKey="components.assessmentInterface.segmentTitle"
                options={{
                  values: {
                    number: currentQuestion.id,
                    topic: currentQuestion.topic,
                  },
                }}
              />
            </h3>
            <p className="text-gray-600">{currentQuestion.description}</p>
            <Badge variant="outline" className="mt-2">
              <BilingualText
                translationKey="components.assessmentInterface.difficultyLevel"
                options={{
                  values: {
                    level: currentQuestion.difficulty,
                  },
                }}
              />
            </Badge>
          </div>

          {/* Audio Player */}
          <div className="max-w-md mx-auto">
            <AssessmentAudioPlayer
              src={currentAudioUrl || null}
              onEnded={handleAudioEnded}
              disabled={audioLoading || Boolean(audioError) || !currentAudioUrl}
              className="mb-6"
            />

            {audioError && (
              <div className="text-sm text-red-600 flex items-center justify-between gap-3">
                <span className="truncate">{audioError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAudioUrls((prev) => {
                      const next = { ...prev }
                      delete next[currentQuestion.id]
                      return next
                    })
                  }}
                >
                  重试
                </Button>
              </div>
            )}
          </div>

          {/* Rating */}
          {audioPlayed[currentQuestion.id] && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">
                  <BilingualText translationKey="components.assessmentInterface.ratingPrompt" />
                </h4>
                <div className="max-w-md mx-auto">
                  <Slider
                    value={[answers[currentQuestion.id] ?? 5]}
                    onValueChange={(val) => handleScoreSelect(Math.min(10, Math.max(1, Math.round(val[0]))))}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>
                      <BilingualText translationKey="components.assessmentInterface.ratingScaleMin" />
                    </span>
                    <span>
                      <BilingualText translationKey="components.assessmentInterface.ratingScaleMax" />
                    </span>
                  </div>
                </div>
              </div>

              {answers[currentQuestion.id] !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    <BilingualText
                      translationKey="components.assessmentInterface.yourRating"
                      options={{
                        values: {
                          score: answers[currentQuestion.id],
                        },
                      }}
                    />
                  </p>
                  <Button 
                    onClick={handleNext}
                    disabled={!canNext}
                    size="lg"
                  >
                    {currentIndex < ASSESSMENT_QUESTIONS.length - 1 ? (
                      <BilingualText translationKey="components.assessmentInterface.nextQuestion" />
                    ) : (
                      <BilingualText translationKey="components.assessmentInterface.completeTest" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Volume2 className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">
              <BilingualText translationKey="components.assessmentInterface.testInstructions" />：
            </p>
            <ul className="space-y-1">
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.playOnce" /></li>
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.rateUnderstanding" /></li>
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.oneIsMin" /></li>
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.recommendDifficulty" /></li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
