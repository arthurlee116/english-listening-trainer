"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, Volume2 } from "lucide-react"
import { BilingualText } from "@/components/ui/bilingual-text"

interface AssessmentAudioPlayerProps {
  src: string
  onEnded: () => void
  disabled?: boolean
  className?: string
}

export default function AssessmentAudioPlayer({ 
  src, 
  onEnded, 
  disabled = false,
  className = "" 
}: AssessmentAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hasPlayed, setHasPlayed] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setHasPlayed(true)
      onEnded()
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [onEnded])

  // 当音频源发生变化时，重置内部状态，避免沿用上一段音频的“已播放”状态
  useEffect(() => {
    // 重置 UI 状态
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setHasPlayed(false)

    // 重置音频元素播放进度
    const audio = audioRef.current
    if (audio) {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {
        // 某些浏览器可能禁止直接设置 currentTime，忽略即可
      }
      // 触发浏览器重新加载新的音频资源
      audio.load()
    }
  }, [src])

  const handlePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`space-y-4 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center justify-center">
        <Button
          onClick={handlePlayPause}
          disabled={disabled || hasPlayed}
          size="lg"
          variant={isPlaying ? "destructive" : "default"}
          className="flex items-center space-x-2"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
          <span>
            {hasPlayed ? (
              <BilingualText translationKey="components.audioPlayer.hasPlayed" />
            ) : isPlaying ? (
              <BilingualText translationKey="components.audioPlayer.pause" />
            ) : (
              <BilingualText translationKey="components.audioPlayer.play" />
            )}
          </span>
        </Button>
      </div>

      {(currentTime > 0 || duration > 0) && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-sm text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {hasPlayed && (
        <div className="flex items-center justify-center text-green-600 text-sm">
          <Volume2 className="h-4 w-4 mr-1" />
          <span>
            <BilingualText translationKey="components.audioPlayer.playCompleted" />
          </span>
        </div>
      )}
    </div>
  )
}

AssessmentAudioPlayer.displayName = "AssessmentAudioPlayer"