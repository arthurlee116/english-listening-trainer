"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Volume2, CheckCircle } from "lucide-react"
import AssessmentAudioPlayer from "@/components/assessment-audio-player"
import { Slider } from "@/components/ui/slider"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"
interface AssessmentQuestion {
  id: number
  audioFile: string
  topic: string
  difficulty: number
  description: string
}

interface AssessmentResultType {
  difficultyLevel: number
  difficultyRange: {
    min: number
    max: number
    name: string
    nameEn: string
    description: string
  }
  scores: number[]
  summary: string
  details: Array<{
    audioId: number
    topic: string
    userScore: number
    difficulty: number
    performance: string
  }>
  recommendation: string
}

interface AssessmentInterfaceProps {
  onBack: () => void
  onComplete: (result: AssessmentResultType) => void
}

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 1,
    audioFile: "/assessment-audio/test-1-level6.wav",
    topic: "日常对话",
    difficulty: 6,
    description: "基础水平 - 简单的日常对话"
  },
  {
    id: 2,
    audioFile: "/assessment-audio/test-2-level12.wav",
    topic: "工作场景",
    difficulty: 12,
    description: "初级水平 - 工作场景对话"
  },
  {
    id: 3,
    audioFile: "/assessment-audio/test-3-level18.wav",
    topic: "学术讨论",
    difficulty: 18,
    description: "中级水平 - 学术内容讨论"
  },
  {
    id: 4,
    audioFile: "/assessment-audio/test-4-level24.wav",
    topic: "新闻报道",
    difficulty: 24,
    description: "高级水平 - 新闻报道内容"
  },
  {
    id: 5,
    audioFile: "/assessment-audio/test-5-level30.wav",
    topic: "专业讲座",
    difficulty: 30,
    description: "专家水平 - 专业学术讲座"
  }
]

export function AssessmentInterface({ onBack, onComplete }: AssessmentInterfaceProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [audioPlayed, setAudioPlayed] = useState<Record<number, boolean>>({})
  const [isComplete, setIsComplete] = useState(false)
  // not using the translator directly here but keep hook for potential side-effects
  const _bilingual = useBilingualText()

  const currentQuestion = ASSESSMENT_QUESTIONS[currentIndex]
  const progress = ((currentIndex + 1) / ASSESSMENT_QUESTIONS.length) * 100
  
  const handleScoreSelect = (score: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: score
    }))
  }

  const handleNext = () => {
    if (currentIndex < ASSESSMENT_QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // 完成评估，计算结果
      const scores = ASSESSMENT_QUESTIONS.map(q => answers[q.id] || 0)
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
      const difficultyLevel = Math.round((averageScore / 10) * 30)
      
      // 根据难度级别确定范围
      let difficultyRange
      if (difficultyLevel <= 5) {
        difficultyRange = {
          min: 1,
          max: 5,
          name: "A1 - 初学者",
          nameEn: "Beginner",
          description: "适合英语学习的初学者，建议从基础对话开始练习"
        }
      } else if (difficultyLevel <= 10) {
        difficultyRange = {
          min: 6,
          max: 10,
          name: "A2 - 基础级",
          nameEn: "Elementary",
          description: "有一定英语基础，可以进行简单的日常交流"
        }
      } else if (difficultyLevel <= 15) {
        difficultyRange = {
          min: 11,
          max: 15,
          name: "B1 - 中级",
          nameEn: "Intermediate",
          description: "具备中级英语水平，能够理解大部分日常对话内容"
        }
      } else if (difficultyLevel <= 20) {
        difficultyRange = {
          min: 16,
          max: 20,
          name: "B2 - 中高级",
          nameEn: "Upper Intermediate",
          description: "英语水平较好，能够处理复杂的语言内容"
        }
      } else if (difficultyLevel <= 25) {
        difficultyRange = {
          min: 21,
          max: 25,
          name: "C1 - 高级",
          nameEn: "Advanced",
          description: "具备高级英语水平，能够理解复杂的学术和专业内容"
        }
      } else {
        difficultyRange = {
          min: 26,
          max: 30,
          name: "C2 - 精通级",
          nameEn: "Proficient",
          description: "英语接近母语水平，能够处理各种高难度内容"
        }
      }

      const result = {
        difficultyLevel,
        difficultyRange,
        scores,
        summary: `基于您在 ${ASSESSMENT_QUESTIONS.length} 段音频测试中的表现，系统评估您的英语听力水平为 ${difficultyRange.name}。`,
        details: ASSESSMENT_QUESTIONS.map((q, index) => ({
          audioId: q.id,
          topic: q.topic,
          userScore: scores[index],
          difficulty: q.difficulty,
          performance: scores[index] >= 8 ? "优秀" : scores[index] >= 6 ? "良好" : scores[index] >= 4 ? "一般" : "需改进"
        })),
        recommendation: difficultyLevel < 10 
          ? "建议从基础练习开始，多听简单的日常对话内容。"
          : difficultyLevel < 20 
          ? "您的基础不错，可以挑战更多样化的话题和场景。"
          : "您的听力水平很好，可以尝试更具挑战性的专业内容。"
      }

      setIsComplete(true)
      onComplete(result)
    }
  }

  const canNext = answers[currentQuestion.id] !== undefined && audioPlayed[currentQuestion.id]

  const handleAudioEnded = () => {
    setAudioPlayed(prev => ({
      ...prev,
      [currentQuestion.id]: true
    }))
  }

  if (isComplete) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">
          <BilingualText translationKey="components.assessmentInterface.assessmentComplete" />
        </h2>
        <p className="text-gray-600">
          <BilingualText translationKey="components.assessmentInterface.analyzingResults" />
        </p>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold">
              <BilingualText translationKey="components.assessmentInterface.title" />
            </h2>
          </div>
          <Badge variant="outline">
            <BilingualText 
              translationKey="components.assessmentInterface.questionCounter" 
              en={`${currentIndex + 1} / ${ASSESSMENT_QUESTIONS.length}`}
              zh={`第${currentIndex + 1}题，共${ASSESSMENT_QUESTIONS.length}题`}
            />
          </Badge>
        </div>
        
        <Progress value={progress} className="w-full" />
        <p className="text-sm text-gray-600 mt-2">
          <BilingualText translationKey="components.assessmentInterface.instructionText" />
        </p>
      </Card>

      {/* Current Question */}
      <Card className="p-8">
        <div className="text-center space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-2">
              <BilingualText 
                translationKey="components.assessmentInterface.segmentTitle"
                en={`Segment ${currentQuestion.id}: ${currentQuestion.topic}`}
                zh={`第${currentQuestion.id}段：${currentQuestion.topic}`}
              />
            </h3>
            <p className="text-gray-600">{currentQuestion.description}</p>
            <Badge variant="outline" className="mt-2">
              <BilingualText 
                translationKey="components.assessmentInterface.difficultyLevel"
                en={`Difficulty Level: ${currentQuestion.difficulty}/30`}
                zh={`难度级别: ${currentQuestion.difficulty}/30`}
              />
            </Badge>
          </div>

          {/* Audio Player */}
          <div className="max-w-md mx-auto">
            <AssessmentAudioPlayer
              src={currentQuestion.audioFile}
              onEnded={handleAudioEnded}
              className="mb-6"
            />
          </div>

          {/* Rating */}
          {audioPlayed[currentQuestion.id] && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">
                  <BilingualText translationKey="components.assessmentInterface.ratingPrompt" />
                </h4>
                <div className="max-w-md mx-auto">
                  <Slider
                    value={[answers[currentQuestion.id] ?? 5]}
                    onValueChange={(val) => handleScoreSelect(Math.min(10, Math.max(1, Math.round(val[0]))))}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>
                      <BilingualText translationKey="components.assessmentInterface.ratingScaleMin" />
                    </span>
                    <span>
                      <BilingualText translationKey="components.assessmentInterface.ratingScaleMax" />
                    </span>
                  </div>
                </div>
              </div>

              {answers[currentQuestion.id] !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    <BilingualText 
                      translationKey="components.assessmentInterface.yourRating"
                      en={`Your rating: ${answers[currentQuestion.id]}/10`}
                      zh={`您的评分：${answers[currentQuestion.id]}/10`}
                    />
                  </p>
                  <Button 
                    onClick={handleNext}
                    disabled={!canNext}
                    size="lg"
                  >
                    {currentIndex < ASSESSMENT_QUESTIONS.length - 1 ? (
                      <BilingualText translationKey="components.assessmentInterface.nextQuestion" />
                    ) : (
                      <BilingualText translationKey="components.assessmentInterface.completeTest" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Volume2 className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">
              <BilingualText translationKey="components.assessmentInterface.testInstructions" />：
            </p>
            <ul className="space-y-1">
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.playOnce" /></li>
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.rateUnderstanding" /></li>
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.oneIsMin" /></li>
              <li>• <BilingualText translationKey="components.assessmentInterface.instructionsList.recommendDifficulty" /></li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}