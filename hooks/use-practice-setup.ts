import { useMemo, useState } from "react"

import { DEFAULT_LANGUAGE } from "@/lib/language-config"
import type { DifficultyLevel, ListeningLanguage } from "@/lib/types"

export function usePracticeSetup() {

  const [difficulty, setDifficulty] = useState<DifficultyLevel | "">("")
  const [duration, setDuration] = useState<number>(120)
  const [language, setLanguage] = useState<ListeningLanguage>(DEFAULT_LANGUAGE)
  const [topic, setTopic] = useState<string>("")
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([])

  const handleLanguageChange = (newLanguage: ListeningLanguage) => {
    setLanguage(newLanguage)
  }

  const wordCount = useMemo(() => duration * 2, [duration])

  const isSetupComplete = useMemo(() => Boolean(difficulty && topic), [
    difficulty,
    topic,
  ])

  return {
    difficulty,
    setDifficulty,
    duration,
    setDuration,
    language,
    setLanguage,
    topic,
    setTopic,
    suggestedTopics,
    setSuggestedTopics,
    handleLanguageChange,
    wordCount,
    isSetupComplete,
  }
}
