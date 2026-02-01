import { type Dispatch, type RefObject, type SetStateAction } from "react"

import { AudioPlayer, type AudioPlayerControls } from "@/components/audio-player"
import { QuestionInterface } from "@/components/question-interface"
import { ResultsDisplay } from "@/components/results-display"
import type { DifficultyLevel, Exercise, Question } from "@/lib/types"

interface PracticeWorkspaceProps {
  step: string
  audioPlayerRef: RefObject<AudioPlayerControls | null>
  transcript: string
  difficulty: DifficultyLevel | ""
  topic: string
  wordCount: number
  audioUrl: string
  audioError: boolean
  onGenerateAudio: () => Promise<void>
  onStartQuestions: () => Promise<void>
  onRegenerate: (() => Promise<void>) | undefined
  canRegenerate: boolean
  loading: boolean
  loadingMessage: string
  audioDuration: number | null
  questions: Question[]
  answers: Record<number, string>
  onAnswerChange: Dispatch<SetStateAction<Record<number, string>>>
  onSubmitAnswers: () => Promise<void>
  currentExercise: Exercise | null
  onRestart: () => void
  onExport: () => void
  isAuthenticated?: boolean
}

export function PracticeWorkspace({
  step,
  audioPlayerRef,
  transcript,
  difficulty,
  topic,
  wordCount,
  audioUrl,
  audioError,
  onGenerateAudio,
  onStartQuestions,
  onRegenerate,
  canRegenerate,
  loading,
  loadingMessage,
  audioDuration,
  questions,
  answers,
  onAnswerChange,
  onSubmitAnswers,
  currentExercise,
  onRestart,
  onExport,
  isAuthenticated = false,
}: PracticeWorkspaceProps) {
  if (step === "listening") {
    return (
      <div className="max-w-4xl mx-auto">
        <AudioPlayer
          ref={audioPlayerRef}
          transcript={transcript}
          difficulty={difficulty}
          topic={topic}
          wordCount={wordCount}
          audioUrl={audioUrl}
          audioError={audioError}
          onGenerateAudio={onGenerateAudio}
          onStartQuestions={onStartQuestions}
          onRegenerate={canRegenerate ? onRegenerate : undefined}
          loading={loading}
          loadingMessage={loadingMessage}
          initialDuration={audioDuration ?? undefined}
        />
      </div>
    )
  }

  if (step === "questions" && questions.length > 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <QuestionInterface
          questions={questions}
          answers={answers}
          onAnswerChange={onAnswerChange}
          onSubmit={onSubmitAnswers}
          loading={loading}
          loadingMessage={loadingMessage}
          audioUrl={audioUrl}
          transcript={transcript}
          initialDuration={audioDuration ?? undefined}
        />
      </div>
    )
  }

  if (step === "results" && currentExercise) {
    return (
      <div className="max-w-4xl mx-auto">
        <ResultsDisplay
          exercise={currentExercise}
          onRestart={onRestart}
          onExport={onExport}
          isAuthenticated={isAuthenticated}
        />
      </div>
    )
  }

  return null
}
