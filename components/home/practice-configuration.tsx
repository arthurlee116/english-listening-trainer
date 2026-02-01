import { type RefObject, useEffect, useMemo, useState } from "react"

import { Loader2, Sparkles, Newspaper } from "lucide-react"


import { BilingualText } from "@/components/ui/bilingual-text"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import {
  DIFFICULTY_LEVELS,
  DIFFICULTY_RANGE_MAP,
  DURATION_OPTIONS,
} from "@/lib/constants/practice-config"
import { LANGUAGE_OPTIONS } from "@/lib/language-config"
import type { FocusArea } from "@/lib/types"
import { FOCUS_AREA_LIST } from "@/lib/types"
import { loadSpecializedModeSettings, saveSpecializedModeSettings } from "@/lib/specialized-mode"
import { loadDifficultyMode, loadManualDifficulty, saveDifficultyMode } from "@/lib/difficulty-mode"
import { loadPersonalization } from "@/lib/personalization"
import type {
  DifficultyLevel,
  ListeningLanguage,
} from "@/lib/types"

interface PracticeSetupProps {
  difficulty: DifficultyLevel | ""
  duration: number
  language: ListeningLanguage
  topic: string
  suggestedTopics: string[]
  isSetupComplete: boolean
  onDifficultyChange: (value: DifficultyLevel | "") => void
  onDurationChange: (value: number) => void
  onLanguageChange: (value: ListeningLanguage) => void
  onTopicChange: (value: string) => void
  topicInputRef: RefObject<HTMLInputElement | null>
}



interface PracticeOperationsProps {
  loading: boolean
  loadingMessage: string
  onGenerateTopics: () => void
  onRefreshTopics: () => void
  onGenerateExercise: (newsEnhanced?: boolean) => void
  shouldShowSearchEnhancement: boolean
}

interface PracticeConfigurationProps {
  practiceSetup: PracticeSetupProps
  operations: PracticeOperationsProps
}

export function PracticeConfiguration({
  practiceSetup,
  operations,
}: PracticeConfigurationProps) {
  const { t } = useBilingualText()
  const { difficulty, onDifficultyChange } = practiceSetup

  // handleSelectRecommendedTopic logic moved to parent
  const [specializedEnabled, setSpecializedEnabled] = useState(false)
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<FocusArea[]>([])
  const [difficultyMode, setDifficultyMode] = useState<'auto' | 'manual'>('manual')
  const [autoHint, setAutoHint] = useState<string>('')

  useEffect(() => {
    const settings = loadSpecializedModeSettings()
    setSpecializedEnabled(settings.enabled)
    setSelectedFocusAreas(settings.selectedFocusAreas)

    const mode = loadDifficultyMode()
    setDifficultyMode(mode)

    const personalization = loadPersonalization()
    if (personalization) {
      setAutoHint(`${personalization.cefr} (${personalization.difficultyRange.min}-${personalization.difficultyRange.max})`)
    } else {
      setAutoHint(t("labels.selectDifficulty"))
    }
  }, [])

  useEffect(() => {
    saveSpecializedModeSettings({ enabled: specializedEnabled, selectedFocusAreas })
  }, [specializedEnabled, selectedFocusAreas])

  useEffect(() => {
    saveDifficultyMode(difficultyMode)
    if (difficultyMode === 'auto') {
      const personalization = loadPersonalization()
      if (personalization) {
        if (personalization.cefr !== difficulty) {
          onDifficultyChange(personalization.cefr)
        }
      }
    } else {
      const manual = loadManualDifficulty()
      if (manual) {
        if (manual !== difficulty) {
          onDifficultyChange(manual)
        }
      }
    }
  }, [difficultyMode, difficulty, onDifficultyChange])

  const selectedCountLabel = useMemo(() => {
    return t("components.specializedPractice.selectedAreas", {
      values: { count: selectedFocusAreas.length },
    })
  }, [selectedFocusAreas.length, t])

  const canSelectMore = selectedFocusAreas.length < 5


  return (
    <div className="space-y-4">


      <Card className="glass-effect p-8 shadow-[0_30px_60px_-40px_rgba(33,21,10,0.75)]">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">
            <BilingualText translationKey="labels.createExercise" />
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="difficulty" className="text-base font-medium text-foreground-secondary">
              <BilingualText translationKey="labels.difficulty" />
            </Label>

            <div className="mt-2 mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-foreground-muted">
                {difficultyMode === 'auto' ? (
                  <span>Auto: {autoHint}</span>
                ) : (
                  <span>Manual</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground-muted">Auto</span>
                <Switch
                  checked={difficultyMode === 'auto'}
                  onCheckedChange={(checked) => setDifficultyMode(checked ? 'auto' : 'manual')}
                  aria-label="Difficulty Auto Mode"
                />
              </div>
            </div>
            <Select
              value={practiceSetup.difficulty}
              onValueChange={(value) => practiceSetup.onDifficultyChange(value as DifficultyLevel | "")}
              disabled={difficultyMode === 'auto'}
            >
              <SelectTrigger
                aria-label={t("labels.difficulty")}
                className="glass-effect"
              >
                <SelectValue placeholder={t("labels.selectDifficulty")} />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <BilingualText translationKey={level.labelKey} />{" "}
                    <span className="text-xs text-foreground-muted">
                      (
                      {DIFFICULTY_RANGE_MAP[level.value as DifficultyLevel].min}-
                      {DIFFICULTY_RANGE_MAP[level.value as DifficultyLevel].max})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Specialized Practice Mode */}
          <Card className="p-4 border border-border/60 bg-background/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">
                  <BilingualText translationKey="components.specializedPractice.title" />
                </div>
                <div className="text-xs text-foreground-muted">
                  <BilingualText translationKey="components.specializedPractice.description" />
                </div>
              </div>
              <Switch
                id="specialized-mode"
                checked={specializedEnabled}
                onCheckedChange={setSpecializedEnabled}
                aria-label="Specialized Mode"
              />
            </div>

            {specializedEnabled && (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-foreground-secondary font-medium">
                  {selectedCountLabel}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FOCUS_AREA_LIST.map((area) => {
                    const checked = selectedFocusAreas.includes(area)
                    const disabled = !checked && !canSelectMore
                    return (
                      <label
                        key={area}
                        className={`flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-accent/60'}`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(next) => {
                            const isChecked = Boolean(next)
                            setSelectedFocusAreas((prev) => {
                              if (isChecked) {
                                if (prev.includes(area) || prev.length >= 5) return prev
                                return [...prev, area]
                              }
                              return prev.filter((a) => a !== area)
                            })
                          }}
                          aria-label={area}
                        />
                        <span>
                          <BilingualText translationKey={`components.specializedPractice.focusAreas.${area}`} />
                        </span>
                      </label>
                    )
                  })}
                </div>

                {selectedFocusAreas.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setSelectedFocusAreas([])}
                  >
                    <BilingualText translationKey="components.specializedPractice.clearSelection" />
                  </Button>
                )}
              </div>
            )}
          </Card>

          <div>
            <Label htmlFor="language" className="text-base font-medium text-foreground-secondary">
              <BilingualText translationKey="labels.listeningLanguage" />
            </Label>
            <Select
              value={practiceSetup.language}
              onValueChange={(value) => practiceSetup.onLanguageChange(value as ListeningLanguage)}
            >
              <SelectTrigger
                aria-label={t("labels.listeningLanguage")}
                className="glass-effect"
              >
                <SelectValue placeholder={t("labels.selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="duration" className="text-base font-medium text-foreground-secondary">
              <BilingualText translationKey="labels.duration" />
            </Label>
            <Select
              value={practiceSetup.duration.toString()}
              onValueChange={(value) => practiceSetup.onDurationChange(parseInt(value, 10))}
            >
              <SelectTrigger
                aria-label={t("labels.duration")}
                className="glass-effect"
              >
                <SelectValue placeholder={t("labels.selectDuration")} />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    <BilingualText translationKey={option.labelKey} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          {practiceSetup.difficulty && (
            <Button
              onClick={operations.onGenerateTopics}
              disabled={operations.loading}
              className="w-full glass-effect"
            >
              {operations.loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {operations.loadingMessage}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <BilingualText translationKey="buttons.generateTopicSuggestions" />
                </>
              )}
            </Button>
          )}

          {practiceSetup.suggestedTopics.length > 0 && (
            <div>
              <Label className="text-base font-medium">
                <BilingualText translationKey="labels.suggestedTopics" />
              </Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {practiceSetup.suggestedTopics.map((suggestedTopic, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="glass-effect justify-start text-left h-auto py-3 px-4"
                    onClick={() => practiceSetup.onTopicChange(suggestedTopic)}
                  >
                    <span className="text-sm">{suggestedTopic}</span>
                  </Button>
                ))}
              </div>
              <Button
                onClick={operations.onRefreshTopics}
                disabled={operations.loading}
                variant="outline"
                className="w-full mt-3 glass-effect"
              >
                {operations.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {operations.loadingMessage}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    <BilingualText translationKey="buttons.refreshTopics" />
                  </>
                )}
              </Button>
            </div>
          )}

          <div>
            <Label htmlFor="topic" className="text-base font-medium">
              <BilingualText translationKey="labels.manualTopic" />
            </Label>
            <Input
              id="topic"
              ref={practiceSetup.topicInputRef}
              value={practiceSetup.topic}
              onChange={(e) => practiceSetup.onTopicChange(e.target.value)}
              placeholder={t("placeholders.enterTopic")}
              className="glass-effect"
            />
          </div>

          <Button
            onClick={() => operations.onGenerateExercise(false)}
            disabled={!practiceSetup.isSetupComplete || operations.loading}
            className="w-full"
            size="lg"
          >
            {operations.loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {operations.loadingMessage}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                <BilingualText translationKey="buttons.generateListeningExercise" />
              </>
            )}
          </Button>

          {/* 当没有预生成稿时，才提供 Exa 搜索增强入口 */}
          {operations.shouldShowSearchEnhancement && (
            <div className="space-y-2">
              <Button
                onClick={() => operations.onGenerateExercise(true)}
                disabled={!practiceSetup.isSetupComplete || operations.loading}
                variant="outline"
                className="w-full"
                size="lg"
                title={t("news.newsEnhancedHint")}
              >
                <Newspaper className="w-4 h-4 mr-2" />
                <BilingualText translationKey="news.newsEnhanced" />
              </Button>
              <p className="text-xs text-foreground-muted">
                <BilingualText translationKey="news.newsEnhancedHint" />
              </p>
            </div>
          )}
        </div>
      </Card>

    </div>
  )
}
