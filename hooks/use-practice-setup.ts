import { useCallback, useMemo, useState } from "react"

import { useBilingualText } from "@/hooks/use-bilingual-text"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_LANGUAGE } from "@/lib/language-config"
import type { DifficultyLevel, ListeningLanguage } from "@/lib/types"

interface UsePracticeSetupOptions {
  isSpecializedMode: boolean
  onSpecializedLanguageReset?: () => void
}

export function usePracticeSetup({
  isSpecializedMode,
  onSpecializedLanguageReset,
}: UsePracticeSetupOptions) {
  const { toast } = useToast()
  const { t } = useBilingualText()

  const [difficulty, setDifficulty] = useState<DifficultyLevel | "">("")
  const [duration, setDuration] = useState<number>(120)
  const [language, setLanguage] = useState<ListeningLanguage>(DEFAULT_LANGUAGE)
  const [topic, setTopic] = useState<string>("")
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([])

  const handleLanguageChange = useCallback(
    (newLanguage: ListeningLanguage) => {
      setLanguage(newLanguage)

      if (isSpecializedMode) {
        onSpecializedLanguageReset?.()
        toast({
          title: t("messages.languageChanged"),
          description: t("messages.languageChangedDesc"),
          variant: "default",
        })
      }
    },
    [isSpecializedMode, onSpecializedLanguageReset, toast, t],
  )

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
