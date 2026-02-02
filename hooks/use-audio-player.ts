'use client'

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_PLAYBACK_RATE, PLAYBACK_RATE_STORAGE_KEY, parsePlaybackRate } from '@/lib/constants'

const AUDIO_POSITION_STORAGE_PREFIX = 'audio-position:'

export interface UseAudioPlayerOptions {
  audioUrl?: string
  initialDuration?: number
  fallbackUrl?: string
  /**
   * Optional override for the localStorage key that keeps track of playback progress.
   * When not provided, the hook derives a key from the audio URL.
   */
  playbackPositionKey?: string
  toastMessages?: {
    unsupportedRateTitle: string
    unsupportedRateDesc: string
  }
}

export interface UseAudioPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  playbackRate: number
}

export interface UseAudioPlayerControls {
  togglePlayPause: () => void
  play: () => void
  pause: () => void
  skipBackward: (amount?: number) => void
  skipForward: (amount?: number) => void
  handleVolumeChange: (values: number[]) => void
  handlePlaybackRateChange: (value: string) => void
  handleSliderPointerDown: () => void
  handleSliderPointerUp: () => void
  handleSliderValueChange: (values: number[]) => void
  handleSliderValueCommit: (values: number[]) => void
}

export interface UseAudioPlayerReturn {
  audioRef: RefObject<HTMLAudioElement | null>
  state: UseAudioPlayerState
  controls: UseAudioPlayerControls
  sliderMax: number
  internalError: boolean
  hasAudio: boolean
  resolvedAudioUrl: string
  formatTime: (time: number) => string
}

const DEFAULT_TOAST_MESSAGES = {
  unsupportedRateTitle: 'Unsupported playback speed',
  unsupportedRateDesc: 'Your browser does not support this playback speed.',
}

export function useAudioPlayer({
  audioUrl,
  initialDuration,
  fallbackUrl,
  playbackPositionKey,
  toastMessages,
}: UseAudioPlayerOptions): UseAudioPlayerReturn {
  const { toast } = useToast()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration ?? 0)
  const [volume, setVolume] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE)
  const [internalError, setInternalError] = useState(false)
  const [activeUrl, setActiveUrl] = useState(audioUrl ?? '')

  const audioRef = useRef<HTMLAudioElement>(null)
  const rafRef = useRef<number | null>(null)
  const scrubRafRef = useRef<number | null>(null)
  const pendingTimeRef = useRef<number | null>(null)
  const isScrubbingRef = useRef(false)
  const wasPausedBeforeScrubRef = useRef(false)
  const playbackRateRef = useRef(DEFAULT_PLAYBACK_RATE)
  const hasTriedFallbackRef = useRef(false)

  const effectiveToastMessages = toastMessages ?? DEFAULT_TOAST_MESSAGES

  const positionStorageKey = useMemo(() => {
    if (playbackPositionKey) return playbackPositionKey
    if (!audioUrl) return null
    return `${AUDIO_POSITION_STORAGE_PREFIX}${encodeURIComponent(audioUrl)}`
  }, [audioUrl, playbackPositionKey])

  useEffect(() => {
    setActiveUrl(audioUrl ?? '')
    hasTriedFallbackRef.current = false
    setInternalError(false)
  }, [audioUrl])

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (scrubRafRef.current) {
      cancelAnimationFrame(scrubRafRef.current)
      scrubRafRef.current = null
    }
    pendingTimeRef.current = null
    isScrubbingRef.current = false
    wasPausedBeforeScrubRef.current = false
  }, [])

  const startProgressLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    const tick = () => {
      const audio = audioRef.current
      if (audio && !isScrubbingRef.current) {
        setCurrentTime(audio.currentTime)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopProgressLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const readSavedPosition = useCallback((): number => {
    if (!positionStorageKey || typeof window === 'undefined') {
      return 0
    }
    try {
      const raw = window.localStorage.getItem(positionStorageKey)
      const parsed = raw ? parseFloat(raw) : 0
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    } catch (error) {
      console.warn('Failed to read saved audio position', error)
      return 0
    }
  }, [positionStorageKey])

  const persistPosition = useCallback(
    (time: number) => {
      if (!positionStorageKey || typeof window === 'undefined') {
        return
      }
      try {
        const safeTime = Math.max(0, Math.floor(time))
        window.localStorage.setItem(positionStorageKey, safeTime.toString())
      } catch (error) {
        console.warn('Failed to persist audio position', error)
      }
    },
    [positionStorageKey],
  )

  const applyPlaybackRate = useCallback(
    (audio: HTMLAudioElement | null, rate: number) => {
      if (!audio) return
      try {
        audio.playbackRate = rate
      } catch (error) {
        console.warn('Unsupported playbackRate, reverting to default', error)
        audio.playbackRate = DEFAULT_PLAYBACK_RATE
        if (rate !== DEFAULT_PLAYBACK_RATE) {
          setPlaybackRate(DEFAULT_PLAYBACK_RATE)
          toast({
            title: effectiveToastMessages.unsupportedRateTitle,
            description: effectiveToastMessages.unsupportedRateDesc,
            variant: 'destructive',
          })
        }
      }
    },
    [effectiveToastMessages.unsupportedRateDesc, effectiveToastMessages.unsupportedRateTitle, toast],
  )

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
    } else {
      audio
        .play()
        .catch((error) => {
          // AbortError is expected when audio element is removed from DOM (e.g., navigating away)
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }
          console.error('Failed to play audio:', error)
          setIsPlaying(false)
        })
    }
  }, [])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.paused) return
    audio
      .play()
      .catch((error) => {
        // AbortError is expected when audio element is removed from DOM (e.g., navigating away)
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        console.error('Failed to play audio:', error)
        setIsPlaying(false)
      })
  }, [])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audio.paused) return
    audio.pause()
  }, [])

  const skipBackward = useCallback(
    (amount = 10) => {
      const audio = audioRef.current
      if (!audio) return
      const newTime = Math.max(0, audio.currentTime - amount)
      audio.currentTime = newTime
      setCurrentTime(newTime)
    },
    [],
  )

  const skipForward = useCallback(
    (amount = 10) => {
      const audio = audioRef.current
      if (!audio) return
      const cap = isFinite(duration) && duration > 0 ? duration : audio.duration || amount
      const newTime = Math.min(cap, audio.currentTime + amount)
      audio.currentTime = newTime
      setCurrentTime(newTime)
    },
    [duration],
  )

  const handleVolumeChange = useCallback(
    (values: number[]) => {
      const audio = audioRef.current
      if (!audio || values.length === 0) return
      const raw = values[0]
      const normalized = Math.min(Math.max(raw / 100, 0), 1)
      audio.volume = normalized
      setVolume(normalized)
    },
    [],
  )

  const handlePlaybackRateChange = useCallback(
    (value: string) => {
      const parsed = parsePlaybackRate(value)
      setPlaybackRate(parsed)

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, parsed.toString())
        } catch (error) {
          console.warn('Failed to persist playback rate', error)
        }
      }
    },
    [],
  )

  const handleSliderPointerDown = useCallback(() => {
    isScrubbingRef.current = true
    stopProgressLoop()
    const audio = audioRef.current
    if (audio) {
      wasPausedBeforeScrubRef.current = audio.paused
      if (audio.paused) {
        audio.play().catch((error) => {
          console.warn('Unable to start audio for scrubbing preview:', error)
        })
      }
    }
  }, [stopProgressLoop])

  const handleSliderPointerUp = useCallback(() => {
    const audio = audioRef.current
    if (audio && !audio.paused) {
      startProgressLoop()
    }
  }, [startProgressLoop])

  const handleSliderValueChange = useCallback(
    (values: number[]) => {
      if (values.length === 0) return
      pendingTimeRef.current = values[0]
      if (!scrubRafRef.current) {
        scrubRafRef.current = requestAnimationFrame(() => {
          scrubRafRef.current = null
          if (pendingTimeRef.current == null) {
            return
          }
          const target = pendingTimeRef.current
          setCurrentTime(target)
          const audio = audioRef.current
          if (audio) {
            const cap = isFinite(duration) && duration > 0 ? duration : audio.duration || 100
            const clamped = Math.min(Math.max(0, target), cap)
            if (Number.isFinite(clamped) && !Number.isNaN(clamped)) {
              audio.currentTime = clamped
            }
          }
        })
      }
    },
    [duration],
  )

  const handleSliderValueCommit = useCallback(
    (values: number[]) => {
      const audio = audioRef.current
      if (!audio || values.length === 0) return
      const target = values[0]
      const cap = isFinite(duration) && duration > 0 ? duration : audio.duration || 100
      const newTime = Math.min(Math.max(0, target), cap)

      if (Number.isFinite(newTime) && !Number.isNaN(newTime)) {
        audio.currentTime = newTime
        setCurrentTime(newTime)
      }

      if (!audio.paused) {
        startProgressLoop()
      }

      isScrubbingRef.current = false
      pendingTimeRef.current = null
      if (scrubRafRef.current) {
        cancelAnimationFrame(scrubRafRef.current)
        scrubRafRef.current = null
      }

      if (wasPausedBeforeScrubRef.current) {
        audio.pause()
        wasPausedBeforeScrubRef.current = false
      }
    },
    [duration, startProgressLoop],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      const savedRateRaw = window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)
      const rate = parsePlaybackRate(savedRateRaw ?? DEFAULT_PLAYBACK_RATE)
      playbackRateRef.current = rate
      setPlaybackRate(rate)
    } catch (error) {
      console.warn('Failed to read playback rate from storage', error)
      playbackRateRef.current = DEFAULT_PLAYBACK_RATE
      setPlaybackRate(DEFAULT_PLAYBACK_RATE)
    }
  }, [])

  useEffect(() => {
    playbackRateRef.current = playbackRate
    const audio = audioRef.current
    if (audio) {
      applyPlaybackRate(audio, playbackRate)
    }
  }, [applyPlaybackRate, playbackRate])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio || !activeUrl) {
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(initialDuration ?? 0)
      return
    }

    setInternalError(false)

    const savedPosition = readSavedPosition()
    if (savedPosition > 0) {
      try {
        audio.currentTime = savedPosition
        setCurrentTime(savedPosition)
      } catch (error) {
        console.warn('Failed to set saved audio position', error)
        setCurrentTime(0)
      }
    } else {
      setCurrentTime(0)
      try {
        audio.currentTime = 0
      } catch {
        // ignore
      }
    }

    if (typeof initialDuration === 'number' && initialDuration > 0) {
      setDuration(initialDuration)
    }

    audio.volume = volume

    const handleTimeUpdate = () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(audio.currentTime)
      }
    }

    const refreshDuration = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
    }

    const handleLoadedMetadata = () => {
      refreshDuration()
      const freshSavedPosition = readSavedPosition()
      if (freshSavedPosition > 0 && audio.duration && isFinite(audio.duration)) {
        const clamped = Math.min(freshSavedPosition, audio.duration)
        try {
          audio.currentTime = clamped
          setCurrentTime(clamped)
        } catch (error) {
          console.warn('Failed to restore saved audio position after metadata load', error)
        }
      }
      applyPlaybackRate(audio, playbackRateRef.current)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      startProgressLoop()
    }

    const handlePause = () => {
      setIsPlaying(false)
      stopProgressLoop()
      persistPosition(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      stopProgressLoop()
    }

    const handleCanPlay = () => {
      applyPlaybackRate(audio, playbackRateRef.current)
    }

    const handleError = () => {
      if (fallbackUrl && !hasTriedFallbackRef.current && fallbackUrl !== activeUrl) {
        hasTriedFallbackRef.current = true
        setInternalError(false)
        setActiveUrl(fallbackUrl)
        try {
          audio.pause()
          audio.src = fallbackUrl
          audio.load()
        } catch (error) {
          console.warn('Failed to switch to fallback audio URL:', error)
          setInternalError(true)
        }
        return
      }
      setInternalError(true)
      stopProgressLoop()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', refreshDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      // Pause audio before cleanup to prevent AbortError when component unmounts
      try {
        if (!audio.paused) {
          audio.pause()
        }
      } catch {
        // Ignore errors during cleanup
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', refreshDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
      stopProgressLoop()
      cleanup()
    }
  }, [
    applyPlaybackRate,
    activeUrl,
    fallbackUrl,
    cleanup,
    initialDuration,
    persistPosition,
    readSavedPosition,
    startProgressLoop,
    stopProgressLoop,
    volume,
  ])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volume
    }
  }, [volume])

  useEffect(() => cleanup, [cleanup])

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  const sliderMax = useMemo(() => {
    return isFinite(duration) && duration > 0 ? duration : 100
  }, [duration])

  return {
    audioRef,
    state: {
      isPlaying,
      currentTime,
      duration,
      volume,
      playbackRate,
    },
    controls: {
      togglePlayPause,
      play,
      pause,
      skipBackward,
      skipForward,
      handleVolumeChange,
      handlePlaybackRateChange,
      handleSliderPointerDown,
      handleSliderPointerUp,
      handleSliderValueChange,
      handleSliderValueCommit,
    },
    sliderMax,
    internalError,
    hasAudio: Boolean(activeUrl) && !internalError,
    resolvedAudioUrl: activeUrl,
    formatTime,
  }
}
