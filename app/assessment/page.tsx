"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, Pause, RotateCcw, CheckCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useRouter } from "next/navigation"

interface AssessmentAudio {
  id: number
  filename: string
  difficulty: number
  weight: number
  topic: string
  description: string
  audioUrl: string
}

interface AssessmentResult {
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

export default function AssessmentPage() {
  const [audios, setAudios] = useState<AssessmentAudio[]>([])
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([5, 5, 5, 5, 5])
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [playbackStates, setPlaybackStates] = useState<boolean[]>([false, false, false, false, false])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [invitationCode, setInvitationCode] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const code = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
    if (!code) {
      router.push('/')
      return
    }
    setInvitationCode(code)
    loadAudioData()
  }, [router])

  const loadAudioData = async () => {
    try {
      const response = await fetch('/api/assessment/audio')
      const data = await response.json()
      
      if (data.success) {
        setAudios(data.data.audios)
      } else {
        throw new Error(data.error || '加载音频数据失败')
      }
    } catch (error) {
      console.error('加载音频数据失败:', error)
      toast({
        title: "加载失败",
        description: "无法加载评估音频，请刷新页面重试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlay = () => {
    if (!audioRef.current || !audios[currentAudioIndex]) return
    
    if (!hasStarted) {
      setHasStarted(true)
    }
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    const newPlaybackStates = [...playbackStates]
    newPlaybackStates[currentAudioIndex] = true
    setPlaybackStates(newPlaybackStates)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleScoreChange = (audioIndex: number, value: number[]) => {
    const newScores = [...scores]
    newScores[audioIndex] = value[0]
    setScores(newScores)
  }

  const handleNextAudio = () => {
    if (currentAudioIndex < audios.length - 1) {
      setCurrentAudioIndex(currentAudioIndex + 1)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }
  }

  const handlePrevAudio = () => {
    if (currentAudioIndex > 0) {
      setCurrentAudioIndex(currentAudioIndex - 1)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }
  }

  const handleSubmit = async () => {
    if (!invitationCode) {
      toast({
        title: "错误",
        description: "邀请码无效，请重新登录",
        variant: "destructive",
      })
      return
    }

    // 检查是否所有音频都已播放
    const unplayedAudios = playbackStates.map((played, index) => played ? null : index + 1).filter(x => x !== null)
    if (unplayedAudios.length > 0) {
      toast({
        title: "请完成所有音频",
        description: `您还没有播放第 ${unplayedAudios.join(', ')} 段音频`,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationCode,
          scores
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        toast({
          title: "评估完成",
          description: `您的听力难度等级为 ${data.data.difficultyLevel} 级`,
        })
      } else {
        throw new Error(data.error || '提交评估失败')
      }
    } catch (error) {
      console.error('提交评估失败:', error)
      toast({
        title: "提交失败",
        description: error instanceof Error ? error.message : '未知错误',
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReturnHome = () => {
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
          <p className="text-gray-600">正在加载评估系统...</p>
        </Card>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8">
            <div className="text-center mb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">评估完成</h1>
              <Badge variant="outline" className="text-lg px-4 py-2">
                难度等级: {result.difficultyLevel}/30 - {result.difficultyRange.name}
              </Badge>
            </div>

            <div className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-base">
                  {result.summary}
                </AlertDescription>
              </Alert>

              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">详细表现</h3>
                <div className="space-y-4">
                  {result.details.map((detail, index) => (
                    <div key={detail.audioId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">第{detail.audioId}段 - {detail.topic}</h4>
                        <p className="text-sm text-gray-600">难度 {detail.difficulty}/30</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Badge variant={detail.performance === '优秀' ? 'default' : 
                                     detail.performance === '良好' ? 'secondary' : 
                                     detail.performance === '一般' ? 'outline' : 'destructive'}>
                          {detail.performance}
                        </Badge>
                        <span className="text-lg font-semibold">{detail.userScore}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Alert>
                <AlertDescription className="text-base">
                  <strong>学习建议:</strong> {result.recommendation}
                </AlertDescription>
              </Alert>

              <div className="text-center">
                <Button onClick={handleReturnHome} size="lg" className="px-8">
                  开始练习
                </Button>
              </div>
            </div>
          </Card>
        </div>
        <Toaster />
      </div>
    )
  }

  if (audios.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">无法加载评估音频数据</p>
          <Button onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </Card>
      </div>
    )
  }

  const currentAudio = audios[currentAudioIndex]
  const progress = ((currentAudioIndex + 1) / audios.length) * 100
  const allAudiosPlayed = playbackStates.every(played => played)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">英语听力难度评估</h1>
            <p className="text-gray-600">
              请仔细聆听以下5段音频，根据您的理解程度对每段进行评分。每段音频只能播放一次，请集中注意力。
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">进度</span>
              <span className="text-sm text-gray-500">{currentAudioIndex + 1} / {audios.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {currentAudio && (
            <Card className="p-6 mb-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">第 {currentAudio.id} 段</h3>
                  <Badge variant="outline">难度 {currentAudio.difficulty}/30</Badge>
                </div>
                <p className="text-gray-600 mb-2">{currentAudio.topic}</p>
                <p className="text-sm text-gray-500">{currentAudio.description}</p>
              </div>

              <audio
                ref={audioRef}
                src={currentAudio.audioUrl}
                onEnded={handleAudioEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="hidden"
              />

              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-4">
                  <Button
                    onClick={handlePlay}
                    variant={isPlaying ? "destructive" : "default"}
                    size="lg"
                    disabled={playbackStates[currentAudioIndex]}
                  >
                    {isPlaying ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                    {playbackStates[currentAudioIndex] ? '已播放' : isPlaying ? '暂停' : '播放'}
                  </Button>
                </div>

                {hasStarted && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
                      <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
                    </div>
                    <Progress value={duration > 0 ? (currentTime / duration) * 100 : 0} className="h-1" />
                  </div>
                )}
              </div>

              {playbackStates[currentAudioIndex] && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-3">请对这段音频的理解程度评分 (1-10分)</h4>
                  <div className="space-y-3">
                    <Slider
                      value={[scores[currentAudioIndex]]}
                      onValueChange={(value) => handleScoreChange(currentAudioIndex, value)}
                      max={10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>完全不理解</span>
                      <span className="font-semibold text-lg text-blue-600">{scores[currentAudioIndex]} 分</span>
                      <span>完全理解</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          <div className="flex justify-between items-center mb-6">
            <Button
              onClick={handlePrevAudio}
              variant="outline"
              disabled={currentAudioIndex === 0}
            >
              上一段
            </Button>
            
            <div className="flex space-x-2">
              {audios.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full ${
                    index === currentAudioIndex
                      ? 'bg-blue-500'
                      : playbackStates[index]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNextAudio}
              variant="outline"
              disabled={currentAudioIndex === audios.length - 1}
            >
              下一段
            </Button>
          </div>

          <div className="text-center">
            <Button
              onClick={handleSubmit}
              size="lg"
              disabled={!allAudiosPlayed || isSubmitting}
              className="px-8"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  正在提交...
                </>
              ) : allAudiosPlayed ? (
                '完成评估'
              ) : (
                `还需播放 ${playbackStates.filter(played => !played).length} 段音频`
              )}
            </Button>
          </div>

          {!allAudiosPlayed && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                请播放并评分所有音频段落后再提交评估。每段音频只能播放一次，请仔细聆听。
              </AlertDescription>
            </Alert>
          )}
        </Card>
      </div>
      <Toaster />
    </div>
  )
}