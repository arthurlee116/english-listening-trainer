import { type RefObject } from "react"

import { Loader2, Sparkles, Newspaper } from "lucide-react"

import { AchievementPanel } from "@/components/achievement-panel"

import { BilingualText } from "@/components/ui/bilingual-text"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

interface AchievementsProps {
  isGoalPanelOpen: boolean
  onToggleGoalPanel: () => void
  isAuthenticated: boolean
}

interface PracticeConfigurationProps {
  practiceSetup: PracticeSetupProps
  operations: PracticeOperationsProps
  achievements: AchievementsProps
}

export function PracticeConfiguration({
  practiceSetup,
  operations,
  achievements,
}: PracticeConfigurationProps) {
  const { t } = useBilingualText()

  // handleSelectRecommendedTopic logic moved to parent


  return (
    <div className="space-y-4">


      <Card className="glass-effect p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-6 h-6 text-sky-600" />
          <h2 className="text-2xl font-bold text-sky-700">
            <BilingualText translationKey="labels.createExercise" />
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="difficulty" className="text-base font-medium text-slate-700">
              <BilingualText translationKey="labels.difficulty" />
            </Label>
            <Select
              value={practiceSetup.difficulty}
              onValueChange={(value) => practiceSetup.onDifficultyChange(value as DifficultyLevel | "")}
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
            <Label htmlFor="language" className="text-base font-medium text-slate-700">
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
            <Label htmlFor="duration" className="text-base font-medium text-slate-700">
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
              <p className="text-xs text-slate-500">
                <BilingualText translationKey="news.newsEnhancedHint" />
              </p>
            </div>
          )}
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
