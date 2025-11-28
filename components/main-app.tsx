"use client"

import { useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, History, MessageSquare, User, LogOut, Book, RefreshCw } from "lucide-react"
import { Toaster } from "@/components/ui/toaster"
import { AuthDialog } from "@/components/auth-dialog"
import { MigrationNotification } from "@/components/migration-notification"
import { AudioPlayer } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import { HistoryPanel } from "@/components/history-panel"
import { WrongAnswersBook } from "@/components/wrong-answers-book"
import { AssessmentResult } from "@/components/assessment-result"
import { AssessmentInterface } from "@/components/assessment-interface"
import { MobileSidebarWrapper } from "@/components/navigation/mobile-sidebar-wrapper"
import { AppLayoutWithSidebar } from "@/components/app-layout-with-sidebar"
import { LANGUAGE_OPTIONS } from "@/lib/language-config"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useLegacyMigration } from "@/hooks/use-legacy-migration"
import { useAuthState, type AuthState, type AuthUserInfo } from "@/hooks/use-auth-state"
import type { DifficultyLevel, ListeningLanguage, NavigationAction } from "@/lib/types"
import { useThemeClasses, combineThemeClasses } from "@/hooks/use-theme-classes"
import { useExerciseWorkflow, type ExerciseStep } from "@/hooks/use-exercise-workflow"
import { useBilingualText } from "@/hooks/use-bilingual-text"

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
  } = useAuthState()

  const { t } = useBilingualText()
  const { shouldShowNotification } = useLegacyMigration()
  const { textClass, iconClass, borderClass } = useThemeClasses()
  
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={combineThemeClasses("w-8 h-8 animate-spin mx-auto mb-4", iconClass('loading'))} />
          <h2 className="text-lg font-semibold mb-2">
            <BilingualText translationKey="messages.loadingApp" />
          </h2>
          <p className={combineThemeClasses(
            "text-gray-600 dark:text-gray-300",
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
              "text-gray-600 dark:text-gray-300",
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
          "sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b dark:border-gray-800",
          borderClass('default')
        )} role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className={combineThemeClasses(
                  "text-xl font-bold text-gray-900 dark:text-white",
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
                    "text-sm text-gray-700 dark:text-gray-300",
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
              <div className="max-w-2xl mx-auto">
                <Card className="glass-effect p-8">
                  <h2 className="text-2xl font-bold text-center mb-8">创建听力练习</h2>

                  <div className="space-y-6">
                    {/* Difficulty Selection */}
                    <div>
                      <Label htmlFor="difficulty" className="text-base font-medium">
                        Difficulty Level
                      </Label>
                      <Select value={state.difficulty} onValueChange={(value: DifficultyLevel) => setDifficulty(value)}>
                        <SelectTrigger id="difficulty" className="glass-effect">
                          <SelectValue placeholder="选择难度级别" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIFFICULTY_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language Selection */}
                    <div>
                      <Label htmlFor="language" className="text-base font-medium">
                        Language
                      </Label>
                      <Select value={state.language} onValueChange={(value: ListeningLanguage) => setLanguage(value)}>
                        <SelectTrigger className="glass-effect">
                          <SelectValue placeholder="选择语言" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Duration Selection */}
                    <div>
                      <Label htmlFor="duration" className="text-base font-medium">
                        Duration
                      </Label>
                      <Select value={state.duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                        <SelectTrigger className="glass-effect">
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

                    {/* Topic Generation */}
                    {state.difficulty && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-base font-medium">
                            Topic Suggestions
                          </Label>
                          <Button
                            onClick={handleGenerateTopics}
                            disabled={state.loading}
                            variant="outline"
                            size="sm"
                          >
                            {state.loading ? (
                              <Loader2 className={combineThemeClasses("w-3 h-3 mr-1 animate-spin", iconClass('loading'))} />
                            ) : (
                              <Sparkles className={combineThemeClasses("w-3 h-3 mr-1", iconClass('secondary'))} />
                            )}
                            生成话题
                          </Button>
                        </div>

                        {state.suggestedTopics.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className={combineThemeClasses(
                                "text-sm text-gray-600 dark:text-gray-400",
                                textClass('tertiary')
                              )}>
                                点击选择一个话题：
                              </p>
                              <Button
                                onClick={handleRefreshTopics}
                                disabled={state.loading}
                                variant="ghost"
                                size="sm"
                                className="px-3"
                              >
                                {state.loading ? (
                                  <Loader2 className={combineThemeClasses("w-4 h-4 mr-1 animate-spin", iconClass('loading'))} />
                                ) : (
                                  <RefreshCw className={combineThemeClasses("w-4 h-4 mr-1", iconClass('secondary'))} />
                                )}
                                <span className="text-sm">刷新话题</span>
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {state.suggestedTopics.map((suggestedTopic, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  className="glass-effect justify-start text-left h-auto py-3 px-4"
                                  onClick={() => setTopic(suggestedTopic)}
                                >
                                  <span className="text-sm">{suggestedTopic}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manual Topic Input */}
                    <div>
                      <Label htmlFor="topic" className="text-base font-medium">
                        Topic (or enter your own)
                      </Label>
                      <Input
                        id="topic"
                        value={state.topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Enter a topic for your listening exercise"
                        className="glass-effect"
                      />
                    </div>

                    {/* Generate Exercise Button */}
                    <Button
                      onClick={handleGenerateTranscript}
                      disabled={!isSetupComplete || state.loading}
                      className="w-full"
                      size="lg"
                    >
                      {state.loading ? (
                        <>
                          <Loader2 className={combineThemeClasses("w-4 h-4 mr-2 animate-spin", iconClass('loading'))} />
                          {state.loadingMessage}
                        </>
                      ) : (
                        <>
                          <Sparkles className={combineThemeClasses("w-4 h-4 mr-2", iconClass('primary'))} />
                          Generate Listening Exercise
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
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
