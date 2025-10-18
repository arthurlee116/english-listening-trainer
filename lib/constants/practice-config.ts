export const DIFFICULTY_LEVELS = [
  { value: "A1", labelKey: "difficultyLevels.A1" },
  { value: "A2", labelKey: "difficultyLevels.A2" },
  { value: "B1", labelKey: "difficultyLevels.B1" },
  { value: "B2", labelKey: "difficultyLevels.B2" },
  { value: "C1", labelKey: "difficultyLevels.C1" },
  { value: "C2", labelKey: "difficultyLevels.C2" },
]

export const DIFFICULTY_RANGE_MAP = {
  A1: { min: 1, max: 5 },
  A2: { min: 6, max: 10 },
  B1: { min: 11, max: 15 },
  B2: { min: 16, max: 20 },
  C1: { min: 21, max: 25 },
  C2: { min: 26, max: 30 },
} as const

export const DURATION_OPTIONS = [
  { value: 60, labelKey: "durationOptions.1min" },
  { value: 120, labelKey: "durationOptions.2min" },
  { value: 180, labelKey: "durationOptions.3min" },
  { value: 300, labelKey: "durationOptions.5min" },
]

