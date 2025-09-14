"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, Volume2, AlertCircle, RefreshCw, Loader2 } from "lucide-react"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"

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

interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
}

// 优化的音频控制Hook
function useOptimizedAudioPlayer() {
  const [state, setState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isLoading: false
  })
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const rafRef = useRef<number | null>(null)
  const isScrubbingRef = useRef(false)
  
  // 批量状态更新
  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])
  
  // 优化的进度更新
  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (audio && !isScrubbingRef.current) {
      updateState({ currentTime: audio.currentTime })
    }
    rafRef.current = requestAnimationFrame(updateProgress)
  }, [updateState])
  
  // 开始/停止进度更新
  const toggleProgressLoop = useCallback((start: boolean) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    
    if (start) {
      rafRef.current = requestAnimationFrame(updateProgress)
    }
  }, [updateProgress])
  
  // 清理函数
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])
  
  return {
    state,
    updateState,
    audioRef,
    isScrubbingRef,
    toggleProgressLoop
  }
}

// 音频事件处理器
const useAudioEventHandlers = (
  audioRef: React.RefObject<HTMLAudioElement | null>,
  updateState: (updates: Partial<AudioPlayerState>) => void,
  toggleProgressLoop: (start: boolean) => void,
  isScrubbingRef: React.MutableRefObject<boolean>
) => {
  const handlers = useMemo(() => ({
    onTimeUpdate: () => {
      if (!isScrubbingRef.current && audioRef.current) {
        updateState({ currentTime: audioRef.current.currentTime })
      }
    },
    
    onLoadedMetadata: () => {
      if (audioRef.current?.duration) {
        updateState({
          duration: audioRef.current.duration,
          isLoading: false
        })
      }
    },
    
    onPlay: () => {
      updateState({ isPlaying: true })
      toggleProgressLoop(true)
    },
    
    onPause: () => {
      updateState({ isPlaying: false })
      toggleProgressLoop(false)
    },
    
    onEnded: () => {
      updateState({ isPlaying: false })
      toggleProgressLoop(false)
    },
    
    onError: () => {
      console.error('Audio loading error')
      updateState({ isLoading: false })
    }
  }), [audioRef, updateState, toggleProgressLoop, isScrubbingRef])
  
  return handlers
}

// 优化的音频控制
const useAudioControls = (
  audioRef: React.RefObject<HTMLAudioElement | null>,
  state: AudioPlayerState,
  updateState: (updates: Partial<AudioPlayerState>) => void
) => {
  const controls = useMemo(() => ({
    togglePlayPause: () => {
      const audio = audioRef.current
      if (!audio) return
      
      if (!audio.paused) {
        audio.pause()
      } else {
        audio.play().catch((err) => {
          console.error("Failed to play audio:", err)
          updateState({ isPlaying: false })
        })
      }
    },
    
    seek: (value: number[]) => {
      const audio = audioRef.current
      if (!audio) return
      
      const newTime = Math.min(Math.max(0, value[0]), state.duration)
      audio.currentTime = newTime
      updateState({ currentTime: newTime })
    },
    
    skipBackward: () => {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = Math.max(0, audio.currentTime - 10)
    },
    
    skipForward: () => {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = Math.min(state.duration, audio.currentTime + 10)
    },
    
    setVolume: (value: number[]) => {
      const audio = audioRef.current
      if (!audio) return
      const newVolume = value[0] / 100
      audio.volume = newVolume
      updateState({ volume: newVolume })
    }
  }), [audioRef, state.duration, updateState])
  
  return controls
}

export const OptimizedAudioPlayer = React.memo(function OptimizedAudioPlayer({
  audioUrl,
  audioError,
  transcript,
  onGenerateAudio,
  onStartQuestions,
  onRegenerate,
  loading = false,
  loadingMessage = ""
}: AudioPlayerProps) {
  const { state, updateState, audioRef, isScrubbingRef, toggleProgressLoop } = useOptimizedAudioPlayer()
  const handlers = useAudioEventHandlers(audioRef, updateState, toggleProgressLoop, isScrubbingRef)
  const controls = useAudioControls(audioRef, state, updateState)
  const { t } = useBilingualText()
  
  // 音频元素事件绑定
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    
    updateState({ isLoading: true })
    
    // 绑定事件处理器
    Object.entries(handlers).forEach(([event, handler]) => {
      const eventName = event.replace(/^on/, '').toLowerCase()
      audio.addEventListener(eventName, handler)
    })
    
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        const eventName = event.replace(/^on/, '').toLowerCase()
        audio.removeEventListener(eventName, handler)
      })
    }
  }, [audioUrl, handlers, updateState, audioRef])
  
  // 格式化时间
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])
  
  // 处理函数优化
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
  
  return (
    <div className="space-y-6">
      <Card className="glass-effect p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">
          <BilingualText translationKey="components.audioPlayer.title" />
        </h2>
        
        {audioError ? (
          <AudioErrorDisplay
            loading={loading}
            loadingMessage={loadingMessage}
            onRetry={handleGenerateAudio}
            onSkip={onStartQuestions}
          />
        ) : loading ? (
          <AudioLoadingDisplay loadingMessage={loadingMessage} />
        ) : audioUrl ? (
          <AudioPlayerInterface
            audioRef={audioRef}
            audioUrl={audioUrl}
            state={state}
            controls={controls}
            formatTime={formatTime}
            isScrubbingRef={isScrubbingRef}
          />
        ) : (
          <AudioReadyDisplay />
        )}
        
        <PlayerControls
          audioUrl={audioUrl}
          audioError={audioError}
          loading={loading}
          onGenerateAudio={handleGenerateAudio}
          onStartQuestions={onStartQuestions}
          onRegenerate={onRegenerate ? handleRegenerate : undefined}
        />
      </Card>
      
      <TranscriptDisplay transcript={transcript} />
    </div>
  )
})
OptimizedAudioPlayer.displayName = 'OptimizedAudioPlayer'

interface AudioErrorDisplayProps {
  loading: boolean;
  loadingMessage: string;
  onRetry: () => void;
  onSkip: () => void;
}

// 分离的子组件
const AudioErrorDisplay = React.memo(({ loading, loadingMessage, onRetry, onSkip }: AudioErrorDisplayProps) => {
  const { t } = useBilingualText()
  
  return (
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
          onClick={onRetry}
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
          onClick={onSkip}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
        >
          <BilingualText translationKey="components.audioPlayer.skipAudioDirectQuestions" />
        </Button>
      </div>
    </div>
  )
})
AudioErrorDisplay.displayName = 'AudioErrorDisplay'

interface AudioLoadingDisplayProps {
  loadingMessage: string;
}

const AudioLoadingDisplay = React.memo(({ loadingMessage }: AudioLoadingDisplayProps) => {
  const { t } = useBilingualText()
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
      <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
      <h3 className="font-medium text-blue-800 mb-2">
        {loadingMessage || t("components.audioPlayer.loadingAudio")}
      </h3>
      <p className="text-blue-600 text-sm">
        <BilingualText translationKey="components.audioPlayer.loadingMessage" />
      </p>
    </div>
  )
})
AudioLoadingDisplay.displayName = 'AudioLoadingDisplay'

interface AudioPlayerInterfaceProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioUrl: string;
  state: AudioPlayerState;
  controls: {
    togglePlayPause: () => void;
    seek: (value: number[]) => void;
    skipBackward: () => void;
    skipForward: () => void;
    setVolume: (value: number[]) => void;
  };
  formatTime: (time: number) => string;
  isScrubbingRef: React.MutableRefObject<boolean>;
}

const AudioPlayerInterface = React.memo(({ audioRef, audioUrl, state, controls, formatTime, isScrubbingRef }: AudioPlayerInterfaceProps) => {
  const { t } = useBilingualText()
  
  return (
    <>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Progress Bar */}
      <div className="mb-6">
        <Slider
          value={[state.currentTime]}
          onPointerDown={() => { isScrubbingRef.current = true }}
          onPointerUp={() => { isScrubbingRef.current = false }}
          onValueCommit={controls.seek}
          className="w-full"
          disabled={!audioUrl}
          min={0}
          max={state.duration || 100}
          step={0.1}
        />
        <div className="flex justify-between text-sm text-gray-500 mt-2">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={controls.skipBackward}
          disabled={!audioUrl}
          className="glass-effect bg-transparent rounded-full"
          title={t("components.audioPlayer.skipBackward")}
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        
        <Button
          size="lg"
          onClick={controls.togglePlayPause}
          disabled={!audioUrl}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-16 h-16 rounded-full"
          title={state.isPlaying ? t("components.audioPlayer.pause") : t("components.audioPlayer.play")}
        >
          {state.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={controls.skipForward}
          disabled={!audioUrl}
          className="glass-effect bg-transparent rounded-full"
          title={t("components.audioPlayer.skipForward")}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Volume Control */}
      <div className="flex items-center gap-3 mb-6">
        <Volume2 className="w-4 h-4 text-gray-500" title={t("components.audioPlayer.volume")} />
        <Slider
          value={[state.volume * 100]}
          onValueChange={controls.setVolume}
          className="flex-1"
          max={100}
          step={1}
        />
      </div>
    </>
  )
})
AudioPlayerInterface.displayName = 'AudioPlayerInterface'

const AudioReadyDisplay = React.memo(() => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
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
))
AudioReadyDisplay.displayName = 'AudioReadyDisplay'

interface PlayerControlsProps {
  audioUrl: string;
  audioError: boolean;
  loading: boolean;
  onGenerateAudio: () => void;
  onStartQuestions: () => void;
  onRegenerate?: () => void;
}

const PlayerControls = React.memo(({ 
  audioUrl, 
  audioError, 
  loading, 
  onGenerateAudio, 
  onStartQuestions, 
  onRegenerate 
}: PlayerControlsProps) => (
  <div className="space-y-3">
    {!audioUrl && !audioError && !loading && (
      <Button
        onClick={onGenerateAudio}
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
        onClick={onRegenerate}
        variant="outline"
        className="w-full glass-effect bg-transparent"
        disabled={loading}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        <BilingualText translationKey="components.audioPlayer.regenerateListeningMaterial" />
      </Button>
    )}
  </div>
))
PlayerControls.displayName = 'PlayerControls'

const TranscriptDisplay = React.memo(({ transcript }: { transcript: string }) => (
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
))
TranscriptDisplay.displayName = 'TranscriptDisplay'