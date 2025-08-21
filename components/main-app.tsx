/**
 * 主应用组件
 * 重构后的主页面，使用模块化架构
 */

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, History, MessageSquare, User, Settings, LogOut, Book } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { AudioPlayer } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import { HistoryPanel } from "@/components/history-panel"
import { WrongAnswersBook } from "@/components/wrong-answers-book"
import { InvitationDialog } from "@/components/invitation-dialog"
import { ExerciseSetup } from "@/components/exercise-setup"
import { ThemeToggle } from "@/components/theme-toggle"
import { ErrorBoundary } from "@/components/error-boundary"
import { useInvitationCode } from "@/hooks/use-invitation-code"
import { useExerciseWorkflow } from "@/hooks/use-exercise-workflow"

export function MainApp() {
  const {
    invitationCode,
    isInvitationVerified,
    usageInfo,
    showInvitationDialog,
    isLoading: invitationLoading,
    setShowInvitationDialog,
    handleInvitationCodeVerified,
    handleLogout,
    decrementUsage
  } = useInvitationCode()

  const {
    state,
    progress,
    canProceed,
    generateTopicSuggestions,
    startExercise,
    startQuestions,
    submitAnswers,
    resetExercise,
    updateFormData,
    updateUserAnswer
  } = useExerciseWorkflow()

  const [currentView, setCurrentView] = React.useState<'exercise' | 'history' | 'wrong-answers'>('exercise')
  const { toast } = useToast()

  // 处理开始练习
  const handleStartExercise = React.useCallback(async () => {
    if (usageInfo.remainingUsage <= 0) {
      toast({
        title: "使用次数已用完",
        description: "今日使用次数已用完，请明天再来",
        variant: "destructive",
      })
      return
    }

    const success = await startExercise(invitationCode)
    if (success) {
      decrementUsage()
    }
  }, [startExercise, invitationCode, usageInfo.remainingUsage, decrementUsage, toast])

  // 处理提交答案
  const handleSubmitAnswers = React.useCallback(async () => {
    const success = await submitAnswers(invitationCode)
    return success
  }, [submitAnswers, invitationCode])

  // 如果正在加载邀请码验证
  if (invitationLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">正在验证邀请码...</p>
        </Card>
      </div>
    )
  }

  // 如果邀请码未验证，显示邀请码对话框
  if (!isInvitationVerified) {
    return (
      <>
        <InvitationDialog
          open={showInvitationDialog}
          onOpenChange={setShowInvitationDialog}
          onVerified={handleInvitationCodeVerified}
        />
        <Toaster />
      </>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* 顶部导航栏 */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-semibold">英语听力训练</h1>
                {state.currentStep !== 'setup' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">进度:</span>
                    <Progress value={progress} className="w-24" />
                    <span className="text-sm font-medium">{progress}%</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                {/* 导航按钮 */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant={currentView === 'exercise' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('exercise')}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    练习
                  </Button>
                  <Button
                    variant={currentView === 'history' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('history')}
                  >
                    <History className="h-4 w-4 mr-2" />
                    历史
                  </Button>
                  <Button
                    variant={currentView === 'wrong-answers' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView('wrong-answers')}
                  >
                    <Book className="h-4 w-4 mr-2" />
                    错题本
                  </Button>
                </div>

                {/* 用户信息 */}
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    <User className="h-3 w-3 mr-1" />
                    {invitationCode}
                  </Badge>
                  <Badge variant={usageInfo.remainingUsage > 0 ? 'default' : 'destructive'}>
                    剩余: {usageInfo.remainingUsage}/5
                  </Badge>
                </div>

                <ThemeToggle />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <main className="container mx-auto px-4 py-6">
          {currentView === 'exercise' && (
            <ExerciseView
              state={state}
              canProceed={canProceed}
              onFormDataChange={updateFormData}
              onGenerateTopics={generateTopicSuggestions}
              onStartExercise={handleStartExercise}
              onStartQuestions={startQuestions}
              onSubmitAnswers={handleSubmitAnswers}
              onUpdateAnswer={updateUserAnswer}
              onReset={resetExercise}
            />
          )}

          {currentView === 'history' && (
            <HistoryPanel invitationCode={invitationCode} />
          )}

          {currentView === 'wrong-answers' && (
            <WrongAnswersBook invitationCode={invitationCode} />
          )}
        </main>

        <Toaster />
      </div>
    </ErrorBoundary>
  )
}

// 练习视图组件
interface ExerciseViewProps {
  state: any
  canProceed: boolean
  onFormDataChange: (data: any) => void
  onGenerateTopics: () => void
  onStartExercise: () => void
  onStartQuestions: () => void
  onSubmitAnswers: () => Promise<boolean>
  onUpdateAnswer: (index: number, answer: string) => void
  onReset: () => void
}

function ExerciseView({
  state,
  canProceed,
  onFormDataChange,
  onGenerateTopics,
  onStartExercise,
  onStartQuestions,
  onSubmitAnswers,
  onUpdateAnswer,
  onReset
}: ExerciseViewProps) {
  switch (state.currentStep) {
    case 'setup':
      return (
        <ExerciseSetup
          formData={state.formData}
          suggestedTopics={state.suggestedTopics}
          isGenerating={state.isGenerating}
          generationProgress={state.generationProgress}
          error={state.error}
          onFormDataChange={onFormDataChange}
          onGenerateTopics={onGenerateTopics}
          onStartExercise={onStartExercise}
        />
      )

    case 'listening':
      return (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2">听力练习</h2>
                <p className="text-muted-foreground">
                  仔细听音频内容，准备回答相关问题
                </p>
              </div>

              {state.audioUrl && (
                <div className="space-y-4">
                  <AudioPlayer
                    src={state.audioUrl}
                    title="听力材料"
                    showSpeedControl={true}
                  />
                  
                  <div className="text-center">
                    <Button onClick={onStartQuestions} size="lg">
                      开始答题
                    </Button>
                  </div>
                </div>
              )}

              {state.isGenerating && (
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">{state.generationProgress}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )

    case 'questions':
      return (
        <div className="max-w-3xl mx-auto">
          <QuestionInterface
            questions={state.questions}
            userAnswers={state.userAnswers}
            audioUrl={state.audioUrl}
            onAnswerChange={onUpdateAnswer}
            onSubmit={onSubmitAnswers}
            canSubmit={canProceed}
          />
        </div>
      )

    case 'results':
      return (
        <div className="max-w-3xl mx-auto">
          <ResultsDisplay
            results={state.results}
            exercise={state.exercise}
            onReset={onReset}
          />
        </div>
      )

    default:
      return null
  }
}