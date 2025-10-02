// Shared constants for audio playback speed controls
export const PLAYBACK_RATE_STORAGE_KEY = "english-listening-playback-rate"

export const DEFAULT_PLAYBACK_RATE = 1.0

// Options use translation keys for labels; consumers render via BilingualText
export const PLAYBACK_SPEED_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 0.75, labelKey: "components.audioPlayer.rate075" },
  { value: 1.0, labelKey: "components.audioPlayer.rate100" },
  { value: 1.25, labelKey: "components.audioPlayer.rate125" },
  { value: 1.5, labelKey: "components.audioPlayer.rate150" },
]

// Utility to safely parse and validate playback rate from storage
export function parsePlaybackRate(input: unknown): number {
  const num = typeof input === "string" ? parseFloat(input) : typeof input === "number" ? input : NaN
  const allowed = PLAYBACK_SPEED_OPTIONS.map(o => o.value)
  return allowed.includes(num) ? num : DEFAULT_PLAYBACK_RATE
}