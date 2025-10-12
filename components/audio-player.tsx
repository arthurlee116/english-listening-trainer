"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, Volume2, AlertCircle, RefreshCw, Loader2 } from "lucide-react"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { PLAYBACK_SPEED_OPTIONS, PLAYBACK_RATE_STORAGE_KEY, DEFAULT_PLAYBACK_RATE, parsePlaybackRate } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"

// 音频播放器控制接口
export interface AudioPlayerControls {
  togglePlayPause: () => void
  play: () => void
  pause: () => void
  isPlaying: boolean
  hasAudio: boolean
}

interface AudioPlayerProps {
  audioUrl: string
  audioError: boolean
  transcript: string
  difficulty: string
  topic: string
  wordCount: number
  onGenerateAudio: () => void
  onStartQuestions: () => void
  onRegenerate?: () => void
  loading?: boolean
  loadingMessage?: string
  initialDuration?: number
}

// 自定义Hook用于音频控制
function useAudioPlayer(initialDuration?: number) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration ?? 0)
  const [volume, setVolume] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE)
  const [_isLoading, setIsLoading] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const rafRef = useRef<number | null>(null)
  const isScrubbingRef = useRef(false)
  const scrubRafRef = useRef<number | null>(null)
  const pendingTimeRef = useRef<number | null>(null)
  const wasPausedBeforeScrubRef = useRef(false)
  const durationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 清理函数
  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (scrubRafRef.current) {
      cancelAnimationFrame(scrubRafRef.current)
      scrubRafRef.current = null
    }
    if (durationCheckIntervalRef.current) {
      clearInterval(durationCheckIntervalRef.current)
      durationCheckIntervalRef.current = null
    }
  }, [])

  // 启动进度更新循环
  const startProgressLoop = useCallback(() => {
    cleanup()
    const tick = () => {
      const audio = audioRef.current
      if (audio && !isScrubbingRef.current) {
        setCurrentTime(audio.currentTime)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [cleanup])

  // 停止进度更新循环
  const stopProgressLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof initialDuration === 'number' && initialDuration > 0) {
      setDuration(initialDuration)
    }
  }, [initialDuration])

  // 初始化读取本地存储的倍速设置
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY) : null
      const rate = parsePlaybackRate(saved ?? DEFAULT_PLAYBACK_RATE)
      setPlaybackRate(rate)
      const audio = audioRef.current
      if (audio) {
        audio.playbackRate = rate
      }
    } catch (err) {
      console.warn('Failed to read playback rate from storage', err)
      setPlaybackRate(DEFAULT_PLAYBACK_RATE)
    }
  }, [])

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    setIsLoading,
    audioRef,
    isScrubbingRef,
    scrubRafRef,
    pendingTimeRef,
    wasPausedBeforeScrubRef,
    startProgressLoop,
    stopProgressLoop,
    cleanup
  }
}

const AudioPlayerComponent = forwardRef<AudioPlayerControls, AudioPlayerProps>(({ 
  audioUrl, 
  audioError, 
  transcript,
  // difficulty, // unused
  // topic, // unused
  // wordCount, // unused
  onGenerateAudio,
  onStartQuestions, 
  onRegenerate, 
  loading = false, 
  loadingMessage = "",
  initialDuration
}, ref) => {
  const { t } = useBilingualText()
  const [internalAudioError, setInternalAudioError] = useState(false)
  const { toast } = useToast()
  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    setIsLoading,
    audioRef,
    isScrubbingRef,
    scrubRafRef,
    pendingTimeRef,
    wasPausedBeforeScrubRef,
    startProgressLoop,
    stopProgressLoop,
    cleanup
  } = useAudioPlayer(initialDuration)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    setIsLoading(true)

    // 当 audioUrl 变化时，重置播放状态和时间
  setIsPlaying(false)
  const savedPosition = localStorage.getItem('audio-position')
  const initialTime = savedPosition ? parseFloat(savedPosition) : 0
  if (!isNaN(initialTime) && audio) {
    audio.currentTime = initialTime
  }
  setCurrentTime(initialTime)
  setDuration(initialDuration ?? 0)

    // 简化的事件处理函数
    const updateTime = () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(audio.currentTime)
      }
    }

    const updateDuration = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
        setIsLoading(false)
      }
    }

  const handleError = () => {
    console.error('Audio loading error')
    setInternalAudioError(true)
    setIsLoading(false)
  }

    const handlePlay = () => {
      setIsPlaying(true)
      startProgressLoop()
    }

  const handlePause = () => {
    setIsPlaying(false)
    stopProgressLoop()
    localStorage.setItem('audio-position', Math.floor(currentTime).toString())
  }

    const handleEnded = () => {
      setIsPlaying(false)
      stopProgressLoop()
    }

    // 添加事件监听器
    audio.addEventListener("timeupdate", updateTime)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("durationchange", updateDuration)
    audio.addEventListener("canplay", updateDuration)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("error", handleError)

    // 确保在音频可播放时应用当前倍速
    const applyRate = () => {
      try {
        audio.playbackRate = playbackRate
    } catch {
        console.warn('Unsupported playbackRate, reverting to 1.0x')
        audio.playbackRate = DEFAULT_PLAYBACK_RATE
      }
    }
    audio.addEventListener("canplay", applyRate)
    audio.addEventListener("loadedmetadata", applyRate)

    // 清理函数
    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("durationchange", updateDuration)
      audio.removeEventListener("canplay", updateDuration)
      audio.removeEventListener("canplay", applyRate)
      audio.removeEventListener("loadedmetadata", applyRate)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("error", handleError)
      cleanup()
    }
  }, [audioUrl, startProgressLoop, stopProgressLoop, cleanup, setIsLoading, setIsPlaying, setCurrentTime, setDuration, initialDuration, playbackRate])

  // 监听 initialDuration 变化，立即更新显示
  useEffect(() => {
    if (typeof initialDuration === 'number' && initialDuration > 0) {
      setDuration(initialDuration)
    }
  }, [initialDuration])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
    } else {
      audio.play().catch((err) => {
        console.error("Failed to play audio:", err)
        setIsPlaying(false)
      })
    }
  }, [audioRef, setIsPlaying])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.paused) return
    
    audio.play().catch((err) => {
      console.error("Failed to play audio:", err)
      setIsPlaying(false)
    })
  }, [audioRef, setIsPlaying])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audio.paused) return
    
    audio.pause()
  }, [audioRef])

  // 暴露控制接口给父组件
  useImperativeHandle(ref, () => ({
    togglePlayPause,
    play,
    pause,
    isPlaying,
    hasAudio: Boolean(audioUrl && !audioError)
  }), [togglePlayPause, play, pause, isPlaying, audioUrl, audioError])

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const target = value[0]
    const maxDuration = isFinite(duration) && duration > 0 ? duration : audio.duration || 100
    const newTime = Math.min(Math.max(0, target), maxDuration)
    
    if (isFinite(newTime)) {
      audio.currentTime = newTime
      setCurrentTime(newTime)
    }
    
    if (!audio.paused) {
      startProgressLoop()
    }
    
    // 清理拖拽状态
    isScrubbingRef.current = false
    if (scrubRafRef.current) {
      cancelAnimationFrame(scrubRafRef.current)
      scrubRafRef.current = null
    }
    
    if (wasPausedBeforeScrubRef.current) {
      audio.pause()
      wasPausedBeforeScrubRef.current = false
    }
  }, [audioRef, duration, setCurrentTime, startProgressLoop])

  const skipBackward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 10)
  }, [audioRef])

  const skipForward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(duration, audio.currentTime + 10)
  }, [audioRef, duration])

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    const newVolume = value[0] / 100
    audio.volume = newVolume
    setVolume(newVolume)
  }, [audioRef, setVolume])

  const formatTime = useMemo(() => (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])

  const handleGenerateAudio = useCallback(() => {
    if (onGenerateAudio && !loading) {
      onGenerateAudio()
    }
  }, [onGenerateAudio, loading])

  const handleRegenerate = useCallback(() => {
    if (onRegenerate && !loading) {
      onRegenerate()
    }
  }, [onRegenerate, loading])

  // 当倍速变化或音频地址变化时，应用到 audio 元素
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.playbackRate = playbackRate
    } catch (err) {
      console.warn('Unsupported playbackRate, reverting to 1.0x', err)
      audio.playbackRate = DEFAULT_PLAYBACK_RATE
      setPlaybackRate(DEFAULT_PLAYBACK_RATE)
      toast({
        title: t("components.audioPlayer.unsupportedPlaybackRateTitle"),
        description: t("components.audioPlayer.unsupportedPlaybackRateDesc"),
        variant: "destructive",
      })
    }
  }, [playbackRate, audioUrl, audioRef, setPlaybackRate, toast, t])

  // 监听 storage 变化以跨页面同步设置
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
      // Ignore errors when setting playback rate
    }
    toast({
      title: t("components.audioPlayer.playbackRateChangedTitle"),
      description: t("components.audioPlayer.playbackRateChangedDesc", {
        values: { rate: next },
      }),
    })
  }, [setPlaybackRate, toast, t])

  return (
    <div className="space-y-6">
      <Card className="glass-effect p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">
          <BilingualText translationKey="components.audioPlayer.title" />
        </h2>

        {audioError || internalAudioError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="font-medium text-red-800 mb-2">
              <BilingualText translationKey="components.audioPlayer.audioError" />
            </h3>
            <p className="text-red-600 mb-4 text-sm">
              <BilingualText translationKey="components.audioPlayer.audioErrorMessage" />
            </p>
            <ul className="text-left text-sm text-red-600 mb-4 max-w-md mx-auto">
              <li>• <BilingualText translationKey="components.audioPlayer.errorReasons.localTtsNotStarted" /></li>
              <li>• <BilingualText translationKey="components.audioPlayer.errorReasons.modelLoadFailed" /></li>
              <li>• <BilingualText translationKey="components.audioPlayer.errorReasons.insufficientResources" /></li>
              <li>• <BilingualText translationKey="components.audioPlayer.errorReasons.pythonConfigIssue" /></li>
            </ul>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAudio}
                disabled={loading}
                className="bg-white border-red-300 text-red-600 hover:bg-red-50 rounded-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {loadingMessage || t("components.audioPlayer.retrying")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    <BilingualText translationKey="components.audioPlayer.retryGenerateAudio" />
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={onStartQuestions}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                <BilingualText translationKey="components.audioPlayer.skipAudioDirectQuestions" />
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
            <h3 className="font-medium text-blue-800 mb-2">
              {loadingMessage || t("components.audioPlayer.loadingAudio")}
            </h3>
            <p className="text-blue-600 text-sm">
              <BilingualText translationKey="components.audioPlayer.loadingMessage" />
            </p>
          </div>
        ) : audioUrl ? (
          <>
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            {/* Progress Bar */}
            <div className="mb-6">
              <Slider
                value={[currentTime]}
                onPointerDown={() => {
                  isScrubbingRef.current = true
                  // Pause the visual progress updates while user drags
                  stopProgressLoop()
                  const audio = audioRef.current
                  if (audio) {
                    wasPausedBeforeScrubRef.current = audio.paused
                    // Start playback so scrubbing has audible feedback (user gesture allows autoplay)
                    if (audio.paused) {
                      audio.play().catch((err) => {
                        console.warn('Unable to start audio for scrubbing preview:', err)
                      })
                    }
                  }
                }}
                onPointerUp={() => {
                  // Resume visual updates if audio is playing
                  const audio = audioRef.current
                  if (audio && !audio.paused) {
                    startProgressLoop()
                  }
                  // scrubbing state ends on commit; keep it until then
                }}
                onValueChange={(v) => {
                  // Batch slider updates into a single rAF per frame
                  pendingTimeRef.current = v[0]
                  if (!scrubRafRef.current) {
                    scrubRafRef.current = requestAnimationFrame(() => {
                      scrubRafRef.current = null
                      if (pendingTimeRef.current != null) {
                        const target = pendingTimeRef.current
                        setCurrentTime(target)
                        // Realtime preview: move audio head while dragging
                        const audio = audioRef.current
                        if (audio) {
                          const maxDur = isFinite(duration) && duration > 0 ? duration : audio.duration || 100
                          const clamped = Math.min(Math.max(0, target), maxDur)
                          if (isFinite(clamped) && !Number.isNaN(clamped)) {
                            audio.currentTime = clamped
                          }
                        }
                      }
                    })
                  }
                }}
                onValueCommit={handleSeek}
                className="w-full"
                disabled={!audioUrl}
                min={0}
                max={isFinite(duration) && duration > 0 ? duration : 100}
                step={0.1}
              />
              <div className="flex justify-between text-sm text-gray-500 mt-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="outline"
                size="icon"
                onClick={skipBackward}
                disabled={!audioUrl}
                className="glass-effect bg-transparent rounded-full"
                title={t("components.audioPlayer.skipBackward")}
              >
                <SkipBack className="w-4 h-4" />
              </Button>

          <Button
            size="lg"
            onClick={togglePlayPause}
            disabled={!audioUrl}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-16 h-16 rounded-full"
            aria-label={isPlaying ? t("components.audioPlayer.pause") : t("components.audioPlayer.play")}
            title={isPlaying ? t("components.audioPlayer.pause") : t("components.audioPlayer.play")}
          >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={skipForward}
                disabled={!audioUrl}
                className="glass-effect bg-transparent rounded-full"
                title={t("components.audioPlayer.skipForward")}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 mb-6">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <Slider value={[volume * 100]} onValueChange={handleVolumeChange} className="flex-1" max={100} step={1} />
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-gray-600">
                <BilingualText translationKey="components.audioPlayer.playbackRateLabel" />
              </span>
              <Select value={String(playbackRate)} onValueChange={handleRateChange} disabled={!audioUrl}>
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
          </>
        ) : (
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-8 text-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Volume2 className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-800 mb-2">
              <BilingualText translationKey="components.audioPlayer.readyToGenerate" />
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              <BilingualText translationKey="components.audioPlayer.readyMessage" />
            </p>
          </div>
        )}

        <div className="space-y-3">
          {!audioUrl && !audioError && !loading && (
            <Button
              onClick={handleGenerateAudio}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg"
            >
              <BilingualText translationKey="components.audioPlayer.generateAudio" />
            </Button>
          )}
          
          <Button
            onClick={onStartQuestions}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-lg"
          >
            <BilingualText translationKey="components.audioPlayer.startQuestions" />
          </Button>

          {onRegenerate && (
            <Button
              onClick={handleRegenerate}
              variant="outline"
              className="w-full glass-effect bg-transparent"
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <BilingualText translationKey="components.audioPlayer.regenerateListeningMaterial" />
            </Button>
          )}
        </div>
      </Card>

      {/* Transcript (Hidden during listening) */}
      <Card className="glass-effect p-6">
        <h3 className="font-medium mb-3 text-gray-600">
          <BilingualText translationKey="components.audioPlayer.transcript" />
        </h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm leading-relaxed text-gray-700 blur-sm hover:blur-none transition-all duration-300">
            {transcript}
          </p>
          <p className="text-xs text-gray-500 mt-2 italic">
            <BilingualText translationKey="components.audioPlayer.transcriptHoverHint" />
          </p>
        </div>
      </Card>
    </div>
  )
})

AudioPlayerComponent.displayName = "AudioPlayer"

export const AudioPlayer = React.memo(AudioPlayerComponent)
