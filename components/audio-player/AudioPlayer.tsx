"use client"

import React, { forwardRef, useCallback, useImperativeHandle, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, Volume2, AlertCircle, RefreshCw, Loader2 } from "lucide-react"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { PLAYBACK_SPEED_OPTIONS } from "@/lib/constants"
import componentsTranslationData from "@/lib/i18n/translations/components.json"
import { useAudioPlayer } from "@/hooks/use-audio-player"

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

type TranslationLeaf = { en: string; zh: string }

function isTranslationLeaf(value: unknown): value is TranslationLeaf {
  return (
    typeof value === "object" &&
    value !== null &&
    "en" in value &&
    "zh" in value &&
    typeof (value as { en: unknown }).en === "string" &&
    typeof (value as { zh: unknown }).zh === "string"
  )
}

function resolveComponentsTranslation(path: string): TranslationLeaf | null {
  const normalizedPath = path.startsWith("components.") ? path.slice("components.".length) : path
  const segments = normalizedPath.split(".")

  let current: unknown = componentsTranslationData
  for (const segment of segments) {
    if (typeof current === "object" && current !== null && segment in current) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return null
    }
  }

  return isTranslationLeaf(current) ? current : null
}

function formatPlaybackRateValue(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(1) : rate}×`
}

const AudioPlayerComponent = forwardRef<AudioPlayerControls, AudioPlayerProps>(
  (
    {
      audioUrl,
      audioError,
      transcript,
      onGenerateAudio,
      onStartQuestions,
      onRegenerate,
      loading = false,
      loadingMessage = "",
      initialDuration,
    },
    ref,
  ) => {
    const { t, formatBilingual } = useBilingualText()

    const toastMessages = useMemo(
      () => ({
        unsupportedRateTitle: t("components.audioPlayer.unsupportedPlaybackRateTitle"),
        unsupportedRateDesc: t("components.audioPlayer.unsupportedPlaybackRateDesc"),
      }),
      [t],
    )

    const {
      audioRef,
      state: { isPlaying, currentTime, duration, volume, playbackRate },
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
      hasAudio,
      resolvedAudioUrl,
      formatTime,
    } = useAudioPlayer({
      audioUrl,
      initialDuration,
      fallbackUrl: audioUrl.startsWith("/api/audio/")
        ? audioUrl.replace("/api/audio/", "/audio/")
        : audioUrl.startsWith("/audio/")
          ? audioUrl.replace("/audio/", "/api/audio/")
          : undefined,
      toastMessages,
    })

    const combinedAudioError = audioError || internalError

    const playbackRateLabels = useMemo(() => {
      const labelMap = new Map<string, string>()

      for (const option of PLAYBACK_SPEED_OPTIONS) {
        const translation = resolveComponentsTranslation(option.labelKey)
        if (translation) {
          const { en, zh } = translation
          labelMap.set(String(option.value), en === zh ? en : formatBilingual(en, zh))
        } else {
          labelMap.set(String(option.value), formatPlaybackRateValue(option.value))
        }
      }

      return labelMap
    }, [formatBilingual])

    const selectedPlaybackRateLabel =
      playbackRateLabels.get(String(playbackRate)) ?? formatPlaybackRateValue(playbackRate)

    useImperativeHandle(
      ref,
      () => ({
        togglePlayPause,
        play,
        pause,
        isPlaying,
        hasAudio: Boolean(hasAudio && !audioError),
      }),
      [togglePlayPause, play, pause, isPlaying, hasAudio, audioError],
    )

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

          {combinedAudioError ? (
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
              {(!loadingMessage || loadingMessage.toLowerCase().includes("audio")) && (
                <p className="text-blue-600 text-sm">
                  <BilingualText translationKey="components.audioPlayer.loadingMessage" />
                </p>
              )}
              {loadingMessage && loadingMessage.toLowerCase().includes("question") && (
                <p className="text-blue-600 text-sm">
                  <BilingualText translationKey="components.audioPlayer.loadingQuestions" />
                </p>
              )}
            </div>
          ) : resolvedAudioUrl ? (
            <>
      <audio ref={audioRef} src={resolvedAudioUrl} preload="auto" playsInline />

              {/* Progress Bar */}
              <div className="mb-6">
                <Slider
                  value={[currentTime]}
                  onPointerDown={handleSliderPointerDown}
                  onPointerUp={handleSliderPointerUp}
                  onValueChange={handleSliderValueChange}
                  onValueCommit={handleSliderValueCommit}
                  className="w-full"
                  disabled={!resolvedAudioUrl}
                  min={0}
                  max={sliderMax}
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
                  onClick={() => skipBackward()}
                  disabled={!resolvedAudioUrl}
                  className="glass-effect bg-transparent rounded-full"
                  title={t("components.audioPlayer.skipBackward")}
                >
                  <SkipBack className="w-4 h-4" />
                </Button>

                <Button
                  size="lg"
                  onClick={togglePlayPause}
                  disabled={!resolvedAudioUrl}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-16 h-16 rounded-full"
                  aria-label={isPlaying ? t("components.audioPlayer.pause") : t("components.audioPlayer.play")}
                  title={isPlaying ? t("components.audioPlayer.pause") : t("components.audioPlayer.play")}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => skipForward()}
                  disabled={!resolvedAudioUrl}
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
                <Select value={String(playbackRate)} onValueChange={handlePlaybackRateChange} disabled={!resolvedAudioUrl}>
                  <SelectTrigger aria-label={t("components.audioPlayer.playbackRateAriaLabel")} className="w-28">
                    <SelectValue placeholder={t("components.audioPlayer.playbackRatePlaceholder")}>
                      {selectedPlaybackRateLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYBACK_SPEED_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        <BilingualText translationKey={opt.labelKey} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="bg-white/70 border border-slate-200 rounded-lg p-8 text-center">
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
  },
)

AudioPlayerComponent.displayName = "AudioPlayer"

export const AudioPlayer = React.memo(AudioPlayerComponent)
