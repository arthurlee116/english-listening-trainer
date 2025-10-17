import 'server-only'
import type { FocusArea, ListeningLanguage } from '../types'
import {
  validateFocusAreas,
  generateFocusAreasPrompt
} from '../focus-area-utils'
import { getLanguageDisplayName } from '../language-config'
import { getDifficultyPromptModifier } from '../difficulty-service'

export interface RequestPreprocessorInput {
  difficulty: string
  language?: ListeningLanguage
  difficultyLevel?: number
  focusAreas?: FocusArea[]
}

export interface RequestPreprocessorResult {
  languageCode: ListeningLanguage
  languageName: string
  validatedFocusAreas: FocusArea[]
  focusAreasPrompt: string
  difficultyModifier: string
  hasDifficultyLevel: boolean
  difficultyLabel: string
}

export function preprocessRequestContext(
  input: RequestPreprocessorInput
): RequestPreprocessorResult {
  const languageCode = input.language ?? 'en-US'
  const languageName = getLanguageDisplayName(languageCode)
  const validatedFocusAreas = validateFocusAreas(input.focusAreas)
  const focusAreasPrompt = generateFocusAreasPrompt(validatedFocusAreas, languageName)

  let difficultyModifier = input.difficulty
  let hasDifficultyLevel = false

  if (typeof input.difficultyLevel === 'number') {
    difficultyModifier = getDifficultyPromptModifier(input.difficultyLevel, languageCode)
    hasDifficultyLevel = true
  }

  return {
    languageCode,
    languageName,
    validatedFocusAreas,
    focusAreasPrompt,
    difficultyModifier,
    hasDifficultyLevel,
    difficultyLabel: input.difficulty
  }
}
