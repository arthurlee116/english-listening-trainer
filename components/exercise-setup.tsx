/**
 * 练习设置组件
 * 从主页面中提取的练习设置界面
 */

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles } from "lucide-react"
import { ExerciseFormData } from "@/hooks/use-exercise-workflow"
import { mapDifficultyToCEFR, getDifficultyRange, mapCEFRToDifficulty } from "@/lib/difficulty-service"
import type { DifficultyLevel } from "@/lib/types"
import type { AssessmentInfo } from "@/hooks/use-invitation-code"

const DIFFICULTY_LEVELS = [
  { value: "A1", label: "A1 - Beginner" },
  { value: "A2", label: "A2 - Elementary" },
  { value: "B1", label: "B1 - Intermediate" },
  { value: "B2", label: "B2 - Upper Intermediate" },
  { value: "C1", label: "C1 - Advanced" },
  { value: "C2", label: "C2 - Proficient" },
]

const DURATION_OPTIONS = [
  { value: 60, label: "1 minute (~120 words)" },
  { value: 120, label: "2 minutes (~240 words)" },
  { value: 180, label: "3 minutes (~360 words)" },
  { value: 300, label: "5 minutes (~600 words)" },
]

interface ExerciseSetupProps {
  formData: ExerciseFormData
  suggestedTopics: string[]
  isGenerating: boolean
  generationProgress: string
  error: string | null
  assessmentInfo?: AssessmentInfo
  onFormDataChange: (data: Partial<ExerciseFormData>) => void
  onGenerateTopics: () => void
  onStartExercise: () => void
}

export function ExerciseSetup({
  formData,
  suggestedTopics,
  isGenerating,
  generationProgress,
  error,
  assessmentInfo,
  onFormDataChange,
  onGenerateTopics,
  onStartExercise
}: ExerciseSetupProps) {
  const canStartExercise = formData.topic !== '' || formData.customTopic.trim() !== ''

  // 计算推荐难度信息
  const recommendedLevel = assessmentInfo?.hasAssessment && assessmentInfo.difficultyLevel 
    ? mapDifficultyToCEFR(assessmentInfo.difficultyLevel)
    : null;
  
  const difficultyRange = assessmentInfo?.hasAssessment && assessmentInfo.difficultyLevel
    ? getDifficultyRange(assessmentInfo.difficultyLevel)
    : null;

  // 动态生成难度选项列表
  let difficultyOptions = [...DIFFICULTY_LEVELS];
  if (assessmentInfo?.hasAssessment && assessmentInfo.difficultyLevel) {
    difficultyOptions = [
      { 
        value: "personalized", 
        label: difficultyRange 
          ? `Personalized - ${difficultyRange.name} (L${assessmentInfo.difficultyLevel})`
          : `Personalized - L${assessmentInfo.difficultyLevel}`
      },
      ...DIFFICULTY_LEVELS
    ];
  }
  // 新增：为每个CEFR难度拼接L区间
  const difficultyOptionsWithL = difficultyOptions.map(opt => {
    if (opt.value === "personalized") return opt;
    const lRange = mapCEFRToDifficulty(opt.value);
    return {
      ...opt,
      label: `${opt.label} (L${lRange.min}~L${lRange.max})`
    };
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">英语听力训练</h1>
        <p className="text-muted-foreground">
          AI 驱动的个性化听力练习，提升您的英语听力技能
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="difficulty">难度级别</Label>
                {recommendedLevel && (
                  <Badge variant="secondary" className="text-xs">
                    推荐: {recommendedLevel}
                  </Badge>
                )}
              </div>
              
              {assessmentInfo?.hasAssessment && assessmentInfo.difficultyLevel && difficultyRange && (
                <div className="text-xs text-muted-foreground mb-2 p-2 bg-blue-50 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    <span>
                      根据您的评估结果，推荐难度：<strong>{difficultyRange.name}</strong> 
                      （{assessmentInfo.difficultyLevel}/30级）
                    </span>
                  </div>
                </div>
              )}
              
              <Select
                value={formData.difficulty}
                onValueChange={(value: string) => {
                  if (value === 'personalized') {
                    if (recommendedLevel) {
                      onFormDataChange({ difficulty: recommendedLevel as DifficultyLevel });
                    }
                  } else {
                    onFormDataChange({ difficulty: value as DifficultyLevel });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择难度" />
                </SelectTrigger>
                <SelectContent>
                  {difficultyOptionsWithL.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{level.label}</span>
                        {recommendedLevel === level.value && (
                          <Badge variant="default" className="ml-2 text-xs">
                            推荐
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">时长</Label>
              <Select
                value={formData.duration.toString()}
                onValueChange={(value) => 
                  onFormDataChange({ duration: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择时长" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="focus">重点训练 (可选)</Label>
            <Input
              id="focus"
              placeholder="例如：商务英语、日常对话、学术英语等"
              value={formData.focus}
              onChange={(e) => onFormDataChange({ focus: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>选择话题</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateTopics}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                AI 生成话题
              </Button>
            </div>

            {suggestedTopics.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  建议话题（点击选择）：
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTopics.map((topic, index) => (
                    <Badge
                      key={index}
                      variant={formData.topic === topic ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => onFormDataChange({ topic, customTopic: '' })}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customTopic">或输入自定义话题</Label>
              <Input
                id="customTopic"
                placeholder="例如：环境保护、科技发展、文化交流等"
                value={formData.customTopic}
                onChange={(e) => {
                  onFormDataChange({ 
                    customTopic: e.target.value,
                    topic: e.target.value ? 'custom' : ''
                  })
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {isGenerating && generationProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 dark:bg-blue-950 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-sm text-blue-600 dark:text-blue-300">
                {generationProgress}
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={onStartExercise}
          disabled={!canStartExercise || isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          开始练习
        </Button>
      </Card>
    </div>
  )
}