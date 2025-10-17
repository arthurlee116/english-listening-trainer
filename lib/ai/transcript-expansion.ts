import 'server-only'
import type { ListeningLanguage } from '../types'
import type { ArkMessage } from '../ark-helper'
import { countWords, meetsLengthRequirement } from '../text-expansion'
import { invokeStructured } from './cerebras-service'
import { expansionSchema, type ExpansionStructuredResponse } from './schemas'
import { buildExpansionPrompt } from './prompt-templates'
import { getLanguageDisplayName } from '../language-config'

export interface TranscriptExpansionParams {
  text: string
  targetWordCount: number
  topic: string
  difficulty: string
  language?: ListeningLanguage
  maxAttempts?: number
  minAcceptablePercentage?: number
}

export interface TranscriptExpansionResult {
  success: boolean
  expandedText: string
  originalWordCount: number
  finalWordCount: number
  targetWordCount: number
  expansionAttempts: number
  meetsRequirement: boolean
  meetsBasicRequirement: boolean
  minAcceptablePercentage: number
  message: string
}

export async function expandTranscript(
  params: TranscriptExpansionParams
): Promise<TranscriptExpansionResult> {
  const {
    text,
    targetWordCount,
    topic,
    difficulty,
    language = 'en-US',
    maxAttempts = 5,
    minAcceptablePercentage = 0.9
  } = params

  const languageName = getLanguageDisplayName(language)
  const originalWordCount = countWords(text)

  if (meetsLengthRequirement(text, targetWordCount, minAcceptablePercentage)) {
    return {
      success: true,
      expandedText: text,
      originalWordCount,
      finalWordCount: originalWordCount,
      targetWordCount,
      expansionAttempts: 0,
      meetsRequirement: true,
      meetsBasicRequirement: true,
      minAcceptablePercentage,
      message: `文本已达到长度要求（${Math.round(minAcceptablePercentage * 100)}%），无需扩写`
    }
  }

  let currentText = text
  let attempt = 0
  let finalWordCount = originalWordCount

  while (
    attempt < maxAttempts &&
    !meetsLengthRequirement(currentText, targetWordCount, minAcceptablePercentage)
  ) {
    attempt += 1
    const currentWordCount = countWords(currentText)

    const prompt = buildExpansionPrompt({
      originalText: currentText,
      currentWordCount,
      targetWordCount,
      topic,
      difficulty,
      minAcceptablePercentage,
      languageName
    })

    const messages: ArkMessage[] = [{ role: 'user', content: prompt }]

    try {
      const result = await invokeStructured<ExpansionStructuredResponse>({
        messages,
        schema: expansionSchema,
        schemaName: 'expansion_response',
        options: {
          temperature: 0.4,
          maxTokens: 2048
        }
      })

      if (result && typeof result.expanded_text === 'string') {
        currentText = result.expanded_text.trim()
        finalWordCount = countWords(currentText)
      }
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error
      }
      continue
    }

    if (finalWordCount >= targetWordCount * 1.5) {
      break
    }
  }

  const meetsRequirement = meetsLengthRequirement(currentText, targetWordCount, minAcceptablePercentage)
  const meetsBasicRequirement = meetsLengthRequirement(currentText, targetWordCount, 0.9)

  return {
    success: true,
    expandedText: currentText,
    originalWordCount,
    finalWordCount,
    targetWordCount,
    expansionAttempts: attempt,
    meetsRequirement,
    meetsBasicRequirement,
    minAcceptablePercentage,
    message: meetsRequirement
      ? `扩写成功：从 ${originalWordCount} 词扩写到 ${finalWordCount} 词（达到${Math.round(minAcceptablePercentage * 100)}%要求）`
      : `扩写未完全达到目标：从 ${originalWordCount} 词扩写到 ${finalWordCount} 词（目标：${targetWordCount} 词，要求：${Math.round(minAcceptablePercentage * 100)}%）`
  }
}
