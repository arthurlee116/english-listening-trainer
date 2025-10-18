import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useBilingualText } from "@/hooks/use-bilingual-text"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_LANGUAGE, isLanguageSupported } from "@/lib/language-config"
import {
  deleteTemplate,
  getTemplates,
  renameTemplate,
  saveTemplate,
} from "@/lib/template-storage"
import type {
  DifficultyLevel,
  ListeningLanguage,
  PracticeTemplate,
} from "@/lib/types"

interface PracticeConfig {
  difficulty: DifficultyLevel | ""
  duration: number
  language: ListeningLanguage
  topic: string
}

interface UsePracticeTemplatesOptions {
  getCurrentConfig: () => PracticeConfig
  onApplyConfig: (config: PracticeConfig & { difficulty: DifficultyLevel }) => void
  onResetAfterApply?: () => void
}

export function usePracticeTemplates({
  getCurrentConfig,
  onApplyConfig,
  onResetAfterApply,
}: UsePracticeTemplatesOptions) {
  const { toast } = useToast()
  const { t } = useBilingualText()

  const [templates, setTemplates] = useState<PracticeTemplate[]>([])
  const [templateOpLoadingId, setTemplateOpLoadingId] = useState<string | null>(
    null,
  )
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState<string>("")

  const topicInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Guard for environments without localStorage (SSR)
    const storageAvailable =
      typeof window !== "undefined" && Boolean(window.localStorage)
    if (!storageAvailable) {
      toast({
        title: t("pages.templates.unavailable"),
        description: "",
        variant: "destructive",
      })
      return
    }
    setTemplates(getTemplates())
  }, [t, toast])

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) => {
        const aDate = new Date(a.createdAt ?? "").getTime()
        const bDate = new Date(b.createdAt ?? "").getTime()
        return bDate - aDate
      }),
    [templates],
  )

  const applyTemplate = useCallback(
    (tpl: PracticeTemplate) => {
      const fallbackLanguage = isLanguageSupported(tpl.language)
        ? tpl.language
        : DEFAULT_LANGUAGE

      if (!isLanguageSupported(tpl.language)) {
        toast({
          title: t("pages.templates.languageFallback"),
          description: "",
        })
      }

      onApplyConfig({
        difficulty: tpl.difficulty as DifficultyLevel,
        duration: tpl.duration,
        language: fallbackLanguage,
        topic: tpl.topic ?? "",
      })

      onResetAfterApply?.()

      toast({
        title: t("pages.templates.applySuccess"),
        description: "",
      })
    },
    [onApplyConfig, onResetAfterApply, t, toast],
  )

  const saveTemplateFromPrompt = useCallback(() => {
    try {
      const name = window.prompt(t("pages.templates.saveButton")) ?? ""
      const trimmed = name.trim()
      if (!trimmed) return

      const currentConfig = getCurrentConfig()
      const tpl: PracticeTemplate = {
        id: `${Date.now()}`,
        name: trimmed,
        createdAt: new Date().toISOString(),
        difficulty: (currentConfig.difficulty || "A1") as DifficultyLevel,
        language: currentConfig.language,
        duration: currentConfig.duration,
        autoGenerateTopic: false,
        topic: currentConfig.topic || "",
      }

      const ok = saveTemplate(tpl)
      if (!ok) {
        toast({
          title: t("pages.templates.nameDuplicate"),
          description: "",
          variant: "destructive",
        })
        return
      }

      setTemplates(getTemplates())
      toast({
        title: t("pages.templates.saveSuccess"),
        description: "",
      })
      topicInputRef.current?.focus()
    } catch {
      toast({
        title: t("pages.templates.unavailable"),
        description: "",
        variant: "destructive",
      })
    }
  }, [getCurrentConfig, t, toast])

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameText(currentName)
  }, [])

  const confirmRename = useCallback(() => {
    if (!renamingId) return
    const newName = renameText.trim()
    if (!newName) return

    setTemplateOpLoadingId(renamingId)
    const ok = renameTemplate(renamingId, newName)
    setTemplateOpLoadingId(null)

    if (!ok) {
      toast({
        title: t("pages.templates.nameDuplicate"),
        description: "",
        variant: "destructive",
      })
      return
    }

    setRenamingId(null)
    setRenameText("")
    setTemplates(getTemplates())
    toast({
      title: t("pages.templates.renameSuccess"),
      description: "",
    })
  }, [renamingId, renameText, t, toast])

  const deleteTemplateById = useCallback(
    (id: string) => {
      if (!window.confirm(t("pages.templates.deleteConfirm"))) return

      setTemplateOpLoadingId(id)
      deleteTemplate(id)
      setTemplateOpLoadingId(null)
      setTemplates(getTemplates())

      toast({
        title: t("pages.templates.deleteSuccess"),
        description: "",
      })
    },
    [t, toast],
  )

  const resetRenameState = useCallback(() => {
    setRenamingId(null)
    setRenameText("")
  }, [])

  return {
    templates: sortedTemplates,
    templateOpLoadingId,
    renamingId,
    renameText,
    topicInputRef,
    applyTemplate,
    saveTemplate: saveTemplateFromPrompt,
    startRename,
    confirmRename,
    deleteTemplateById,
    setRenameText,
    resetRenameState,
    refreshTemplates: useCallback(() => setTemplates(getTemplates()), []),
  }
}
