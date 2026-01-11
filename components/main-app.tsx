"use client"

import dynamic from "next/dynamic"
import { useCallback, useState, useRef } from "react"
import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, LogOut, Book } from "lucide-react"
import { MobileSidebarWrapper } from "@/components/navigation/mobile-sidebar-wrapper"
import { AppLayoutWithSidebar } from "@/components/app-layout-with-sidebar"
import { RecommendedTopics, type RecommendedTopic } from "@/components/home/recommended-topics"
import { PracticeConfiguration } from "@/components/home/practice-configuration"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useLegacyMigration } from "@/hooks/use-legacy-migration"
import type { AuthState, AuthUserInfo } from "@/hooks/use-auth-state"
import type { NavigationAction } from "@/lib/types"
import { useThemeClasses, combineThemeClasses } from "@/hooks/use-theme-classes"
import { useExerciseWorkflow, type ExerciseStep } from "@/hooks/use-exercise-workflow"
import { useBilingualText } from "@/hooks/use-bilingual-text"

const AuthDialog = dynamic(
  () => import("@/components/auth-dialog").then((mod) => mod.AuthDialog),
  { ssr: false }
)
const MigrationNotification = dynamic(
  () => import("@/components/migration-notification").then((mod) => mod.MigrationNotification),
  { ssr: false }
)
const AudioPlayer = dynamic(
  () => import("@/components/audio-player").then((mod) => mod.AudioPlayer),
  { ssr: false }
)
const QuestionInterface = dynamic(
  () => import("@/components/question-interface").then((mod) => mod.QuestionInterface),
  { ssr: false }
)
const ResultsDisplay = dynamic(
  () => import("@/components/results-display").then((mod) => mod.ResultsDisplay),
  { ssr: false }
)
const HistoryPanel = dynamic(
  () => import("@/components/history-panel").then((mod) => mod.HistoryPanel),
  { ssr: false }
)
const WrongAnswersBook = dynamic(
  () => import("@/components/wrong-answers-book").then((mod) => mod.WrongAnswersBook),
  { ssr: false }
)
const AssessmentResult = dynamic(
  () => import("@/components/assessment-result").then((mod) => mod.AssessmentResult),
  { ssr: false }
)
const AssessmentInterface = dynamic(
  () => import("@/components/assessment-interface").then((mod) => mod.AssessmentInterface),
  { ssr: false }
)
const Toaster = dynamic(
  () => import("@/components/ui/toaster").then((mod) => mod.Toaster),
  { ssr: false }
)

type MainAppProps = {
  authState: AuthState
}

export const MainApp = ({ authState }: MainAppProps) => {
  const {
    user,
    isAuthenticated,
    isLoading,
    showAuthDialog,
    handleUserAuthenticated: setAuthenticatedUser,
    handleLogout: performLogout
  } = authState

  const { t } = useBilingualText()
  const { shouldShowNotification } = useLegacyMigration()
  const { textClass, iconClass, borderClass } = useThemeClasses()
  const [isGoalPanelOpen, setIsGoalPanelOpen] = useState(false)
  const topicInputRef = useRef<HTMLInputElement>(null)

  // 使用统一的workflow hook
  const {
    state,
    wordCount,
    isSetupComplete,
    setStep,
    setDifficulty,
    setDuration,
    setLanguage,
    setTopic,
    setAnswers,
    setAssessmentResult,
    handleGenerateTopics,
    handleRefreshTopics,
    handleGenerateTranscript,
    handleGenerateAudio,
    handleStartQuestions,
    handleSubmitAnswers,
    handleRestart,
    handleExport,
    handleRestoreExercise,
    setTranscript, // Destructure setTranscript
    setNewsTopicId,
    setNewsTranscriptDurationMinutes,
    setNewsTranscriptMissingDurationMinutes,
  } = useExerciseWorkflow()

  const handleUserAuthenticated = useCallback((userData: AuthUserInfo, token: string) => {
    setAuthenticatedUser(userData, token)
  }, [setAuthenticatedUser])

  const handleLogout = useCallback(async () => {
    await performLogout()
  }, [performLogout])

  // 包装handleSubmitAnswers以传入user
  const onSubmitAnswers = useCallback(async () => {
    if (user) {
      await handleSubmitAnswers({ ...user, name: user.name ?? undefined })
    }
  }, [handleSubmitAnswers, user])

  // 统一的导航处理器，供侧边栏和内部按钮使用
  const handleNavigate = useCallback(
    (action: NavigationAction) => {
      if (action.type === 'setState') {
        setStep(action.targetState as ExerciseStep)
      } else if (action.type === 'callback') {
        if (action.callbackName === 'handleLogout') {
          handleLogout()
        }
      } else if (action.type === 'external') {
        if (action.openInNewTab) {
          window.open(action.href, '_blank')
        } else {
          window.location.href = action.href
        }
      }
    },
    [setStep, handleLogout]
  )

  // 处理推荐话题选择
  const handleSelectRecommendedTopic = useCallback(async (topic: RecommendedTopic, durationMinutes: number) => {
    // 同步时长（左侧分钟选择 = 右侧时长）
    setDuration(durationMinutes * 60)
    // 设置话题主题（立刻更新UI）
    setTopic(topic.topic)
    // 标记当前选择为新闻话题（用于新闻增强模式）
    setNewsTopicId(topic.id)

    // 尝试获取预生成的文稿
    try {
      const res = await fetch(`/api/news/transcript?topicId=${topic.id}&duration=${durationMinutes}`)
      if (!res.ok) {
        setNewsTranscriptMissingDurationMinutes(durationMinutes)
        return
      }

      const data = await res.json()
      if (data.transcript) {
        setTranscript(data.transcript)
        setNewsTranscriptDurationMinutes(durationMinutes)
      } else {
        setNewsTranscriptMissingDurationMinutes(durationMinutes)
      }
    } catch (error) {
      console.error("Failed to fetch transcript:", error)
      setNewsTranscriptMissingDurationMinutes(durationMinutes)
      // 失败也不影响，后续点击生成会走API重新生成
    }
  }, [
    setDuration,
    setTopic,
    setNewsTopicId,
    setTranscript,
    setNewsTranscriptDurationMinutes,
    setNewsTranscriptMissingDurationMinutes,
  ])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={combineThemeClasses("w-8 h-8 animate-spin mx-auto mb-4", iconClass('loading'))} />
          <h2 className="text-lg font-semibold mb-2">
            <BilingualText translationKey="messages.loadingApp" />
          </h2>
          <p className={combineThemeClasses(
            "text-gray-600",
            textClass('secondary')
          )}>
            <BilingualText translationKey="messages.verifyingLogin" />
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthDialog
          open={showAuthDialog}
          onUserAuthenticated={handleUserAuthenticated}
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className={combineThemeClasses(
              "text-gray-600",
              textClass('secondary')
            )}>
              <BilingualText en="Please log in to use the application" zh="请先登录以使用应用" />
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile Sidebar Wrapper */}
      <MobileSidebarWrapper
        currentStep={state.currentStep}
        onNavigate={handleNavigate}
        assessmentResult={state.assessmentResult}
      />

      {/* Desktop Layout with Sidebar */}
      <AppLayoutWithSidebar
        currentStep={state.currentStep}
        onNavigate={handleNavigate}
        assessmentResult={state.assessmentResult}
      >
        {/* Header */}
        <header className={combineThemeClasses(
          "sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200",
          borderClass('default')
        )} role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className={combineThemeClasses(
                  "text-xl font-bold text-gray-900",
                  textClass('primary')
                )}>
                  <BilingualText translationKey="pages.home.title" />
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                {/* User Menu */}
                <div className="flex items-center space-x-2" role="region" aria-label={t("labels.userMenu")}>
                  <User className={combineThemeClasses("w-4 h-4", iconClass('nav'))} />
                  <span className={combineThemeClasses(
                    "text-sm text-gray-700",
                    textClass('secondary')
                  )}>
                    {user?.name || user?.email}
                  </span>
                  {user?.isAdmin && (
                    <Badge variant="secondary" className="text-xs">
                      <BilingualText translationKey="labels.administrator" />
                    </Badge>
                  )}
                </div>

                {/* Navigation Buttons */}
                <nav className="flex items-center space-x-2" role="navigation" aria-label={t("labels.mainNavigation")}>
                  <Button
                    variant={state.currentStep === "setup" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStep("setup")}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    <BilingualText translationKey="buttons.practice" />
                  </Button>
                  <Button
                    variant={state.currentStep === "history" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStep("history")}
                  >
                    <History className="w-4 h-4 mr-1" />
                    <BilingualText translationKey="buttons.history" />
                  </Button>
                  <Button
                    variant={state.currentStep === "wrong-answers" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStep("wrong-answers")}
                  >
                    <Book className="w-4 h-4 mr-1" />
                    <BilingualText translationKey="buttons.wrongAnswersBook" />
                  </Button>
                  <Button
                    variant={state.currentStep === "assessment" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStep("assessment")}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    <BilingualText translationKey="buttons.assessment" />
                  </Button>
                </nav>

                <Button variant="ghost" size="sm" onClick={handleLogout} title={t("buttons.logout")} aria-label={t("buttons.logout")}>
                  <LogOut className="w-4 h-4 mr-1" />
                  <BilingualText translationKey="buttons.logout" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Migration Notification */}
        {shouldShowNotification() && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <MigrationNotification />
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* History Panel */}
          {state.currentStep === "history" && (
            <HistoryPanel
              onBack={() => setStep("setup")}
              onRestore={handleRestoreExercise}
            />
          )}

          {/* Wrong Answers Book */}
          {state.currentStep === "wrong-answers" && (
            <WrongAnswersBook onBack={() => setStep("setup")} />
          )}

          {/* Assessment */}
          {state.currentStep === "assessment" && (
            <AssessmentInterface
              onBack={() => setStep("setup")}
              onComplete={(result) => {
                setAssessmentResult(result)
                setStep("assessment-result")
              }}
            />
          )}

          {/* Assessment Result */}
          {state.currentStep === "assessment-result" && state.assessmentResult && (
            <AssessmentResult
              result={state.assessmentResult}
              onReturnHome={() => {
                setStep("setup")
                setAssessmentResult(null)
              }}
              onRetry={() => {
                setAssessmentResult(null)
                setStep("assessment")
              }}
            />
          )}

          {/* Exercise Flow */}
          {state.currentStep !== "history" && state.currentStep !== "wrong-answers" && state.currentStep !== "assessment" && state.currentStep !== "assessment-result" && (
            <>
              {/* Setup Step */}
              {state.currentStep === "setup" && (
                <div className="relative">
                  {/* 两列布局容器 */}
                  <div className="grid grid-cols-2 gap-8 items-start">
                    {/* Left Column: Recommended Topics - 正常文档流 */}
                    <div className="min-w-0 space-y-4">
                      <RecommendedTopics
                        difficulty={state.difficulty}
                        selectedDuration={Math.floor(state.duration / 60)}
                        onDurationChange={(minutes) => setDuration(minutes * 60)}
                        onSelectTopic={handleSelectRecommendedTopic}
                        onRefresh={() => { }}
                      />
                    </div>

                    {/* Right Column: Practice Configuration - 始终 sticky */}
                    <div className="min-w-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
                      {(() => {
                        const durationMinutes = Math.floor(state.duration / 60)
                        const hasPreGeneratedNewsTranscript =
                          Boolean(state.newsTopicId) &&
                          state.newsTranscriptDurationMinutes === durationMinutes
                        const shouldShowSearchEnhancement =
                          !state.newsTopicId ||
                          (!hasPreGeneratedNewsTranscript &&
                            state.newsTranscriptMissingDurationMinutes === durationMinutes)

                        return (
                      <PracticeConfiguration
                        practiceSetup={{
                          difficulty: state.difficulty,
                          duration: state.duration,
                          language: state.language,
                          topic: state.topic,
                          suggestedTopics: state.suggestedTopics,
                          isSetupComplete: isSetupComplete,
                          onDifficultyChange: setDifficulty,
                          onDurationChange: setDuration,
                          onLanguageChange: setLanguage,
                          onTopicChange: setTopic,
                          topicInputRef: topicInputRef,
                        }}
                        operations={{
                          loading: state.loading,
                          loadingMessage: state.loadingMessage,
                          onGenerateTopics: handleGenerateTopics,
                          onRefreshTopics: handleRefreshTopics,
                          onGenerateExercise: handleGenerateTranscript,
                          shouldShowSearchEnhancement,
                        }}
                        achievements={{
                          isGoalPanelOpen: isGoalPanelOpen,
                          onToggleGoalPanel: () => setIsGoalPanelOpen(!isGoalPanelOpen),
                          isAuthenticated: isAuthenticated
                        }}
                      />
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Listening Step */}
              {state.currentStep === "listening" && (
                <div className="max-w-4xl mx-auto">
                  <AudioPlayer
                    transcript={state.transcript}
                    difficulty={state.difficulty}
                    topic={state.topic}
                    wordCount={wordCount}
                    audioUrl={state.audioUrl}
                    audioError={state.audioError}
                    onGenerateAudio={handleGenerateAudio}
                    onStartQuestions={handleStartQuestions}
                    onRegenerate={state.canRegenerate ? handleGenerateTranscript : undefined}
                    loading={state.loading}
                    loadingMessage={state.loadingMessage}
                    initialDuration={state.audioDuration ?? undefined}
                  />
                </div>
              )}

              {/* Questions Step */}
              {state.currentStep === "questions" && state.questions.length > 0 && (
                <div className="max-w-4xl mx-auto">
                  <QuestionInterface
                    questions={state.questions}
                    answers={state.answers}
                    onAnswerChange={setAnswers}
                    onSubmit={onSubmitAnswers}
                    loading={state.loading}
                    loadingMessage={state.loadingMessage}
                    audioUrl={state.audioUrl}
                    transcript={state.transcript}
                    initialDuration={state.audioDuration ?? undefined}
                  />
                </div>
              )}

              {/* Results Step */}
              {state.currentStep === "results" && state.currentExercise && (
                <div className="max-w-4xl mx-auto">
                  <ResultsDisplay exercise={state.currentExercise} onRestart={handleRestart} onExport={handleExport} />
                </div>
              )}
            </>
          )}
        </main>
      </AppLayoutWithSidebar>
      <Toaster />
    </>
  )
}

MainApp.displayName = "MainApp"
