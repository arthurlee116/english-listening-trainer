"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, Volume2, AlertCircle, RefreshCw, Loader2 } from "lucide-react"

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
}

export function AudioPlayer({ 
  audioUrl, 
  audioError, 
  transcript,
  difficulty: _difficulty,
  topic: _topic,
  wordCount: _wordCount,
  onGenerateAudio,
  onStartQuestions, 
  onRegenerate, 
  loading = false, 
  loadingMessage = "" 
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)
  const rafRef = useRef<number | null>(null)
  const isScrubbingRef = useRef(false)
  const scrubRafRef = useRef<number | null>(null)
  const pendingTimeRef = useRef<number | null>(null)
  const wasPausedBeforeScrubRef = useRef(false)

  const startProgressLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = () => {
      const audio = audioRef.current
      if (audio) {
        // Avoid fighting the user while scrubbing
        if (!isScrubbingRef.current) {
          setCurrentTime(audio.currentTime)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const stopProgressLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(audio.currentTime)
      }
    }
    const updateDuration = () => {
      console.log(`🎵 Audio duration loaded: ${audio.duration}s`)
      console.log(`🎵 Audio readyState: ${audio.readyState}`)
      console.log(`🎵 Audio networkState: ${audio.networkState}`)
      
      // 处理NaN或无效的duration
      if (isNaN(audio.duration) || !isFinite(audio.duration)) {
        console.warn(`⚠️ Invalid duration: ${audio.duration}`)
        return
      }
      
      setDuration(audio.duration)
    }

    const handleError = (e: Event) => {
      console.error(`❌ Audio error:`, e)
      console.error(`❌ Audio error code:`, audio.error)
    }

    const handleCanPlay = () => {
      console.log(`✅ Audio can play - duration: ${audio.duration}s`)
      // 尝试自动修复duration
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
    }

    const handleLoadStart = () => {
      console.log(`🔄 Audio load started`)
    }

    const handleLoadedData = () => {
      console.log(`📊 Audio data loaded - duration: ${audio.duration}s`)
      // 尝试自动修复duration
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
    }

    const handleCanPlayThrough = () => {
      console.log(`🎵 Audio can play through - duration: ${audio.duration}s`)
      
      // 如果duration还是无效，自动尝试修复
      if (isNaN(audio.duration) || !isFinite(audio.duration)) {
        console.log(`🔄 Auto-fixing on canplaythrough...`)
        autoFixDuration()
      } else {
        // duration有效，直接设置
        setDuration(audio.duration)
      }
    }

    const handleProgress = () => {
      console.log(`📈 Audio loading progress`)
    }

    audio.addEventListener("timeupdate", updateTime)
    // Keep UI in sync with actual playback state
    const handlePlay = () => {
      setIsPlaying(true)
      startProgressLoop()
    }
    const handlePause = () => {
      setIsPlaying(false)
      stopProgressLoop()
    }
    const handleEnded = () => {
      setIsPlaying(false)
      stopProgressLoop()
    }
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("playing", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    // Some sources update duration later
    audio.addEventListener("durationchange", updateDuration)
    audio.addEventListener("loadedmetadata", updateDuration)
    audio.addEventListener("error", handleError)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("loadstart", handleLoadStart)
    audio.addEventListener("loadeddata", handleLoadedData)
    audio.addEventListener("canplaythrough", handleCanPlayThrough)
    audio.addEventListener("progress", handleProgress)

    // 立即检查是否已经有数据
    if (audio.duration && isFinite(audio.duration)) {
      updateDuration()
    }
    
    // 立即尝试一次自动修复
    autoFixDuration()
    
    // 添加一个定时器来定期检查duration
    const durationCheckInterval = setInterval(() => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        console.log(`⏰ Interval check found duration: ${audio.duration}s`)
        setDuration(audio.duration)
        clearInterval(durationCheckInterval)
      } else {
        // 尝试自动修复
        console.log(`⏰ Interval attempting auto-fix...`)
        autoFixDuration()
      }
    }, 100)
    
    // 10秒后清理定时器
    setTimeout(() => {
      clearInterval(durationCheckInterval)
    }, 10000)

    return () => {
      audio.removeEventListener("timeupdate", updateTime)
      audio.removeEventListener("loadedmetadata", updateDuration)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("error", handleError)
      audio.removeEventListener("canplay", handleCanPlay)
      audio.removeEventListener("loadstart", handleLoadStart)
      audio.removeEventListener("loadeddata", handleLoadedData)
      audio.removeEventListener("canplaythrough", handleCanPlayThrough)
      audio.removeEventListener("progress", handleProgress)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("playing", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("durationchange", updateDuration)
      
      // 清理定时器
      clearInterval(durationCheckInterval)
      stopProgressLoop()
    }
  }, [audioUrl])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
      // Optimistic UI update; 'pause' event will confirm
      setIsPlaying(false)
    } else {
      // play() is async; update UI optimistically and sync via events
      audio
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch((err) => {
          console.error("Failed to play audio:", err)
          setIsPlaying(false)
        })
    }
  }

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    // Seek using absolute seconds for accuracy
    const target = value[0]
    const maxDuration = isFinite(duration) && duration > 0 ? duration : audio.duration || 100
    const newTime = Math.min(Math.max(0, target), maxDuration)
    
    if (isFinite(newTime)) {
      audio.currentTime = newTime
      setCurrentTime(newTime)
    }
    // If currently playing, ensure the progress loop is active
    if (!audio.paused) {
      startProgressLoop()
    }
    // End scrubbing state after commit
    isScrubbingRef.current = false
    if (scrubRafRef.current) {
      cancelAnimationFrame(scrubRafRef.current)
      scrubRafRef.current = null
    }
    // Restore pause state if we auto-played for scrubbing
    if (wasPausedBeforeScrubRef.current) {
      audio.pause()
      wasPausedBeforeScrubRef.current = false
    }
  }

  const skipBackward = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = Math.max(0, audio.currentTime - 10)
  }

  const skipForward = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = Math.min(duration, audio.currentTime + 10)
  }

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = value[0] / 100
    audio.volume = newVolume
    setVolume(newVolume)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const autoFixDuration = () => {
    const audio = audioRef.current
    if (audio) {
      console.log(`🔧 Auto-fixing duration...`)
      console.log(`🔍 Current audio duration: ${audio.duration}`)
      
      // 直接更新React state
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        console.log(`✅ Auto-setting duration to: ${audio.duration}s`)
        setDuration(audio.duration)
        return true
      } else {
        console.log("🔄 Auto-reloading audio...")
        audio.load()
        return false
      }
    }
    return false
  }

  const handleGenerateAudio = () => {
    if (onGenerateAudio && !loading) {
      onGenerateAudio()
    }
  }

  const _handleRegenerate = () => {
    if (onRegenerate && !loading) {
      onRegenerate()
    }
  }

  const debugAudioInfo = () => {
    const audio = audioRef.current
    if (audio) {
      console.log(`🔍 Audio Debug Info:`)
      console.log(`  - src: ${audio.src}`)
      console.log(`  - duration: ${audio.duration}`)
      console.log(`  - readyState: ${audio.readyState} (${getReadyStateText(audio.readyState)})`)
      console.log(`  - networkState: ${audio.networkState} (${getNetworkStateText(audio.networkState)})`)
      console.log(`  - error: ${audio.error}`)
      console.log(`  - currentTime: ${audio.currentTime}`)
      console.log(`  - buffered ranges: ${audio.buffered.length}`)
      for (let i = 0; i < audio.buffered.length; i++) {
        console.log(`    Range ${i}: ${audio.buffered.start(i)} - ${audio.buffered.end(i)}`)
      }
      
      // 如果duration有问题，尝试修复
      if (isNaN(audio.duration) || !isFinite(audio.duration)) {
        console.log(`🔧 Attempting to fix duration...`)
        audio.load()
        
        // 添加一次性事件监听器来更新duration
        const handleFixedDuration = () => {
          console.log(`✅ Duration fixed: ${audio.duration}s`)
          setDuration(audio.duration)
          audio.removeEventListener('loadedmetadata', handleFixedDuration)
        }
        audio.addEventListener('loadedmetadata', handleFixedDuration)
      }
    } else {
      console.log(`❌ Audio element not found`)
    }
  }

  const getReadyStateText = (state: number) => {
    switch (state) {
      case 0: return 'HAVE_NOTHING'
      case 1: return 'HAVE_METADATA'
      case 2: return 'HAVE_CURRENT_DATA'
      case 3: return 'HAVE_FUTURE_DATA'
      case 4: return 'HAVE_ENOUGH_DATA'
      default: return 'UNKNOWN'
    }
  }

  const getNetworkStateText = (state: number) => {
    switch (state) {
      case 0: return 'NETWORK_EMPTY'
      case 1: return 'NETWORK_IDLE'
      case 2: return 'NETWORK_LOADING'
      case 3: return 'NETWORK_NO_SOURCE'
      default: return 'UNKNOWN'
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-effect p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">听力练习</h2>

        {audioError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="font-medium text-red-800 mb-2">音频生成失败</h3>
            <p className="text-red-600 mb-4 text-sm">
              TTS服务调用失败。这可能是由于以下原因：
            </p>
            <ul className="text-left text-sm text-red-600 mb-4 max-w-md mx-auto">
              <li>• 本地TTS服务未启动</li>
              <li>• 模型加载失败</li>
              <li>• 系统资源不足</li>
              <li>• Python环境配置问题</li>
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
                    {loadingMessage || "重试中..."}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重试生成音频
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={onStartQuestions}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                跳过音频，直接做题
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
            <h3 className="font-medium text-blue-800 mb-2">
              {loadingMessage || "正在生成音频..."}
            </h3>
            <p className="text-blue-600 text-sm">
              请稍候，正在使用本地Kokoro模型生成音频内容
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
                  if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current)
                    rafRef.current = null
                  }
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
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                size="lg"
                onClick={togglePlayPause}
                disabled={!audioUrl}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-16 h-16 rounded-full"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={skipForward}
                disabled={!audioUrl}
                className="glass-effect bg-transparent rounded-full"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-3 mb-6">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <Slider value={[volume * 100]} onValueChange={handleVolumeChange} className="flex-1" max={100} step={1} />
            </div>
          </>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Volume2 className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-800 mb-2">准备生成音频</h3>
            <p className="text-gray-600 text-sm mb-4">
              点击下方按钮生成音频，或直接跳过进入答题环节
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
              生成音频
            </Button>
          )}
          
          <Button
            onClick={onStartQuestions}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-lg"
          >
            开始答题
          </Button>

          {audioUrl && (
            <div className="space-y-2">
              <Button
                onClick={debugAudioInfo}
                variant="outline"
                size="sm"
                className="w-full"
              >
                🔍 调试音频信息
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Transcript (Hidden during listening) */}
      <Card className="glass-effect p-6">
        <h3 className="font-medium mb-3 text-gray-600">听力稿（仅供参考）</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm leading-relaxed text-gray-700 blur-sm hover:blur-none transition-all duration-300">
            {transcript}
          </p>
          <p className="text-xs text-gray-500 mt-2 italic">鼠标悬停显示文本（请先尝试听录音！）</p>
        </div>
      </Card>
    </div>
  )
}
