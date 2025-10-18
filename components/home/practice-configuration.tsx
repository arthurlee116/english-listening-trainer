import { type RefObject } from "react"

import { Loader2, Sparkles } from "lucide-react"

import { AchievementPanel } from "@/components/achievement-panel"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import type {
  DifficultyLevel,
  FocusArea,
  FocusAreaStats,
  FocusCoverage,
  ListeningLanguage,
  PracticeTemplate,
  SpecializedPreset,
} from "@/lib/types"
import { FOCUS_AREA_LIST } from "@/lib/types"

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

interface TemplateManagerProps {
  templates: PracticeTemplate[]
  templateOpLoadingId: string | null
  renamingId: string | null
  renameText: string
  onRenameTextChange: (value: string) => void
  onApplyTemplate: (template: PracticeTemplate) => void
  onStartRename: (id: string, name: string) => void
  onConfirmRename: () => void
  onResetRenameState: () => void
  onDeleteTemplate: (id: string) => void
  onSaveTemplate: () => void
}

interface SpecializedControlsProps {
  isEnabled: boolean
  selectedAreas: FocusArea[]
  recommendedAreas: FocusArea[]
  focusAreaStats: FocusAreaStats
  focusCoverage: FocusCoverage | null
  isLoadingRecommendations: boolean
  loadingStates: {
    computingStats: boolean
    generatingRecommendations: boolean
    savingPreset: boolean
    loadingPreset: boolean
    clearingCache: boolean
  }
  progressInfo: {
    operation: string
    current: number
    total: number
    message: string
  } | null
  presets: SpecializedPreset[]
  onToggle: (enabled?: boolean) => void
  onSelectionChange: (areas: FocusArea[]) => void
  onApplyRecommendations: () => void
  onSavePreset: (name: string) => Promise<boolean> | boolean
  onLoadPreset: (preset: SpecializedPreset) => Promise<void> | void
  onDeletePreset: (id: string) => void
}

interface PracticeOperationsProps {
  loading: boolean
  loadingMessage: string
  onGenerateTopics: () => void
  onGenerateExercise: () => void
}

interface AchievementsProps {
  isGoalPanelOpen: boolean
  onToggleGoalPanel: () => void
  isAuthenticated: boolean
}

interface PracticeConfigurationProps {
  practiceSetup: PracticeSetupProps
  templateManager: TemplateManagerProps
  specialized: SpecializedControlsProps
  operations: PracticeOperationsProps
  achievements: AchievementsProps
}

export function PracticeConfiguration({
  practiceSetup,
  templateManager,
  specialized,
  operations,
  achievements,
}: PracticeConfigurationProps) {
  const { t } = useBilingualText()

  const canAddMoreAreas = specialized.selectedAreas.length < 5

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {specialized.isEnabled && specialized.selectedAreas.length > 0 && (
        <Card className="bg-slate-900/30 backdrop-blur border-slate-700 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-sky-400">
              <BilingualText translationKey="components.specializedPractice.selectedAreas" />
              {` (${specialized.selectedAreas.length}/5)`}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => specialized.onToggle(false)}
              className="text-sky-400 hover:text-sky-300"
            >
              <BilingualText translationKey="components.specializedPractice.disableMode" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {specialized.selectedAreas.map((area) => {
              const stats = specialized.focusAreaStats[area]
              return (
                <Badge
                  key={area}
                  variant="secondary"
                  className="bg-slate-800/60 text-sky-300 border-slate-600"
                >
                  <BilingualText translationKey={`components.specializedPractice.focusAreas.${area}`} />
                  {stats && stats.attempts > 0 && (
                    <span className="ml-1 text-xs opacity-75">
                      ({stats.accuracy.toFixed(0)}%)
                    </span>
                  )}
                </Badge>
              )
            })}
          </div>
          {specialized.focusCoverage && specialized.focusCoverage.coverage < 1 && (
            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-sm text-yellow-200">
              <BilingualText translationKey="components.specializedPractice.coverage.warning" />
              {`: ${Math.round(specialized.focusCoverage.coverage * 100)}%`}
            </div>
          )}
        </Card>
      )}

      <Card className="bg-slate-900/30 backdrop-blur border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-sky-400">
            <BilingualText translationKey="pages.templates.title" />
          </h3>
          <span className="text-xs text-slate-400">
            <BilingualText translationKey="pages.templates.deviceNotice" />
          </span>
        </div>
        {templateManager.templates.length === 0 ? (
          <p className="text-sm text-slate-300">
            <BilingualText translationKey="pages.templates.emptyPlaceholder" />
          </p>
        ) : (
          <ul className="space-y-2">
            {templateManager.templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  {templateManager.renamingId === tpl.id ? (
                    <Input
                      value={templateManager.renameText}
                      onChange={(e) => templateManager.onRenameTextChange(e.target.value)}
                      placeholder={t("pages.templates.renamePlaceholder")}
                      className="w-64"
                    />
                  ) : (
                    <div className="font-medium">{tpl.name}</div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t("pages.templates.createdAt")}：{new Date(tpl.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {templateManager.renamingId === tpl.id ? (
                    <>
                      <Button
                        onClick={templateManager.onConfirmRename}
                        disabled={
                          !templateManager.renameText.trim() ||
                          templateManager.templateOpLoadingId === tpl.id
                        }
                      >
                        <BilingualText translationKey="pages.templates.confirmRename" />
                      </Button>
                      <Button variant="outline" onClick={templateManager.onResetRenameState}>
                        {t("buttons.cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => templateManager.onApplyTemplate(tpl)}
                        disabled={
                          operations.loading || templateManager.templateOpLoadingId === tpl.id
                        }
                      >
                        <BilingualText translationKey="pages.templates.applyButton" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => templateManager.onStartRename(tpl.id, tpl.name)}
                      >
                        <BilingualText translationKey="pages.templates.rename" />
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => templateManager.onDeleteTemplate(tpl.id)}
                        disabled={templateManager.templateOpLoadingId === tpl.id}
                      >
                        <BilingualText translationKey="pages.templates.delete" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="bg-slate-900/30 backdrop-blur border-slate-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-6 h-6 text-sky-400" />
          <h2 className="text-2xl font-bold text-sky-400">
            <BilingualText translationKey="labels.createExercise" />
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="difficulty" className="text-base font-medium text-slate-300">
              <BilingualText translationKey="labels.difficulty" />
            </Label>
            <Select
              value={practiceSetup.difficulty}
              onValueChange={(value) => practiceSetup.onDifficultyChange(value as DifficultyLevel | "")}
            >
              <SelectTrigger
                aria-label={t("labels.difficulty")}
                className="border border-slate-600 bg-slate-800/50 text-slate-200"
              >
                <SelectValue placeholder={t("labels.selectDifficulty")} />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <BilingualText translationKey={level.labelKey} />{" "}
                    <span className="text-xs text-gray-500">
                      (
                      {DIFFICULTY_RANGE_MAP[level.value as DifficultyLevel].min}-
                      {DIFFICULTY_RANGE_MAP[level.value as DifficultyLevel].max})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="language" className="text-base font-medium text-slate-300">
              <BilingualText translationKey="labels.listeningLanguage" />
            </Label>
            <Select
              value={practiceSetup.language}
              onValueChange={(value) => practiceSetup.onLanguageChange(value as ListeningLanguage)}
            >
              <SelectTrigger
                aria-label={t("labels.listeningLanguage")}
                className="border border-slate-600 bg-slate-800/50 text-slate-200"
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
            <Label htmlFor="duration" className="text-base font-medium text-slate-300">
              <BilingualText translationKey="labels.duration" />
            </Label>
            <Select
              value={practiceSetup.duration.toString()}
              onValueChange={(value) => practiceSetup.onDurationChange(parseInt(value, 10))}
            >
              <SelectTrigger
                aria-label={t("labels.duration")}
                className="border border-slate-600 bg-slate-800/50 text-slate-200"
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

          <Card className="bg-slate-800/30 backdrop-blur border-slate-600 p-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-sky-400">
                    <BilingualText translationKey="components.specializedPractice.title" />
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400">
                    <BilingualText translationKey="components.specializedPractice.description" />
                  </p>
                </div>
                <Button
                  variant={specialized.isEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => specialized.onToggle()}
                  className={`${
                    specialized.isEnabled
                      ? "bg-sky-600 hover:bg-sky-700 text-white"
                      : "bg-slate-800/60 text-sky-400 border-slate-600 hover:bg-slate-700/80"
                  } text-xs sm:text-sm px-3 py-2 touch-manipulation self-start sm:self-auto min-w-[120px] sm:min-w-[140px]`}
                >
                  <BilingualText
                    translationKey={
                      specialized.isEnabled
                        ? "components.specializedPractice.disableMode"
                        : "components.specializedPractice.enableMode"
                    }
                  />
                </Button>
              </div>

              {specialized.isEnabled && (
                <div className="space-y-4 border-t border-blue-200 dark:border-blue-800 pt-4">
                  {specialized.recommendedAreas.length > 0 && (
                    <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-600">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <h4 className="font-medium text-sky-300 text-sm sm:text-base">
                          <BilingualText translationKey="components.specializedPractice.recommendedAreas" />
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={specialized.onApplyRecommendations}
                          className="bg-slate-700/60 text-sky-400 border-slate-600 hover:bg-slate-600/80 text-xs sm:text-sm self-start sm:self-auto"
                        >
                          <BilingualText translationKey="components.specializedPractice.applyRecommendations" />
                        </Button>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-400 mb-3">
                        <BilingualText translationKey="components.specializedPractice.recommendedAreasDescription" />
                      </p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {specialized.recommendedAreas.map((area) => {
                          const stats = specialized.focusAreaStats[area]
                          const canAdd =
                            !specialized.selectedAreas.includes(area) && canAddMoreAreas
                          return (
                            <Badge
                              key={area}
                              variant="secondary"
                              className={`bg-slate-700/60 text-sky-300 border-slate-600 text-xs sm:text-sm px-2 py-1 touch-manipulation ${
                                canAdd
                                  ? "cursor-pointer hover:bg-slate-600/80 active:scale-95"
                                  : "opacity-50 cursor-not-allowed"
                              }`}
                              onClick={() => {
                                if (canAdd) {
                                  specialized.onSelectionChange([...specialized.selectedAreas, area])
                                }
                              }}
                              role="button"
                              tabIndex={canAdd ? 0 : -1}
                              aria-pressed={canAdd}
                              aria-label={`${t(
                                `components.specializedPractice.focusAreas.${area}`,
                              )} - ${canAdd ? t("messages.tapToToggle") : t("messages.selectionLimit")}`}
                            >
                              <BilingualText translationKey={`components.specializedPractice.focusAreas.${area}`} />
                              {stats && (
                                <span className="ml-1 text-xs opacity-75">
                                  ({stats.accuracy.toFixed(0)}%)
                                </span>
                              )}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {(specialized.isLoadingRecommendations ||
                    specialized.loadingStates.computingStats ||
                    specialized.loadingStates.generatingRecommendations) && (
                    <div className="bg-slate-800/40 border border-slate-600 p-4 rounded-lg space-y-3">
                      <div className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin mr-2 text-sky-400" />
                        <span className="text-sm font-medium text-sky-300">
                          {specialized.loadingStates.computingStats && (
                            <BilingualText translationKey="components.specializedPractice.computingStats" />
                          )}
                          {specialized.loadingStates.generatingRecommendations && (
                            <BilingualText translationKey="components.specializedPractice.generatingRecommendations" />
                          )}
                          {specialized.isLoadingRecommendations &&
                            !specialized.loadingStates.computingStats &&
                            !specialized.loadingStates.generatingRecommendations && (
                              <BilingualText translationKey="components.specializedPractice.loadingRecommendations" />
                            )}
                        </span>
                      </div>
                      {specialized.progressInfo && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-sky-400">
                            <span>{specialized.progressInfo.message}</span>
                            <span>
                              {specialized.progressInfo.current}/{specialized.progressInfo.total}
                            </span>
                          </div>
                          <Progress
                            value={
                              (specialized.progressInfo.current / specialized.progressInfo.total) *
                              100
                            }
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {(specialized.loadingStates.savingPreset ||
                    specialized.loadingStates.loadingPreset ||
                    specialized.loadingStates.clearingCache) && (
                    <div className="flex items-center justify-center py-2 text-sm text-gray-600 dark:text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      {specialized.loadingStates.savingPreset && (
                        <BilingualText translationKey="components.specializedPractice.savingPreset" />
                      )}
                      {specialized.loadingStates.loadingPreset && (
                        <BilingualText translationKey="components.specializedPractice.loadingPreset" />
                      )}
                      {specialized.loadingStates.clearingCache && (
                        <BilingualText translationKey="components.specializedPractice.clearingCache" />
                      )}
                    </div>
                  )}

                  {!specialized.isLoadingRecommendations &&
                    specialized.recommendedAreas.length === 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <BilingualText translationKey="components.specializedPractice.noRecommendations" />
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          <BilingualText translationKey="components.specializedPractice.noRecommendationsDescription" />
                        </p>
                      </div>
                    )}

                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <Label className="text-sm sm:text-base font-medium">
                        <BilingualText translationKey="components.specializedPractice.selectFocusAreas" />
                      </Label>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs sm:text-sm text-gray-500">
                          <BilingualText translationKey="components.specializedPractice.selectedAreas" />
                          {` (${specialized.selectedAreas.length}/5)`}
                        </span>
                        {specialized.selectedAreas.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => specialized.onSelectionChange([])}
                            className="text-xs sm:text-sm text-sky-400 hover:text-sky-300 px-2 h-7"
                          >
                            <BilingualText translationKey="components.specializedPractice.clearSelection" />
                          </Button>
                        )}
                      </div>
                    </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FOCUS_AREA_LIST.map((area) => {
                          const isSelected = specialized.selectedAreas.includes(area)
                          const stats = specialized.focusAreaStats[area]
                          return (
                            <Button
                              key={area}
                              variant={isSelected ? "default" : "outline"}
                              className={`justify-start text-left h-auto py-3 px-4 ${
                                isSelected
                                  ? "bg-sky-600 hover:bg-sky-700 text-white"
                                  : "bg-slate-800/50 text-sky-300 border-slate-600 hover:bg-slate-700/70"
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  specialized.onSelectionChange(
                                    specialized.selectedAreas.filter((item) => item !== area),
                                  )
                                } else if (canAddMoreAreas) {
                                  specialized.onSelectionChange([
                                    ...specialized.selectedAreas,
                                    area,
                                  ])
                                }
                              }}
                            >
                              <div className="text-sm font-medium">
                                <BilingualText translationKey={`components.specializedPractice.focusAreas.${area}`} />
                              </div>
                              <div className="text-xs text-slate-300 opacity-80">
                                {stats?.attempts ?? 0}{" "}
                                <BilingualText translationKey="components.specializedPractice.attempts" />
                              </div>
                            </Button>
                          )
                        })}
                      </div>
                  </div>

                  {specialized.selectedAreas.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">
                          <BilingualText translationKey="components.specializedPractice.presets.title" />
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const name = window.prompt(
                              t("components.specializedPractice.presets.namePrompt"),
                            )
                            if (name) {
                              specialized.onSavePreset(name)
                            }
                          }}
                          className="text-xs h-7 px-2"
                        >
                          <BilingualText translationKey="components.specializedPractice.presets.save" />
                        </Button>
                      </div>

                      {specialized.presets.length > 0 ? (
                        <div className="space-y-2">
                          {specialized.presets.map((preset) => (
                            <div
                              key={preset.id}
                              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                            >
                              <div className="flex-1">
                                <div className="text-sm font-medium">{preset.name}</div>
                                <div className="text-xs text-gray-500">
                                  {preset.focusAreas.length} areas • {preset.difficulty} •{" "}
                                  {new Date(preset.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => specialized.onLoadPreset(preset)}
                                  className="text-xs h-6 px-2"
                                >
                                  <BilingualText translationKey="components.specializedPractice.presets.load" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        t("components.specializedPractice.presets.confirmDelete"),
                                      )
                                    ) {
                                      specialized.onDeletePreset(preset.id)
                                    }
                                  }}
                                  className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                                >
                                  <BilingualText translationKey="components.specializedPractice.presets.delete" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                          <BilingualText translationKey="components.specializedPractice.presets.noPresets" />
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

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
            onClick={templateManager.onSaveTemplate}
            disabled={!practiceSetup.difficulty || !practiceSetup.duration || operations.loading}
            className="w-full glass-effect"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <BilingualText translationKey="pages.templates.saveButton" />
          </Button>

          <Button
            onClick={operations.onGenerateExercise}
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
        </div>
      </Card>

      <AchievementPanel
        isOpen={achievements.isGoalPanelOpen}
        onToggle={achievements.onToggleGoalPanel}
        userAuthenticated={achievements.isAuthenticated}
      />
    </div>
  )
}
