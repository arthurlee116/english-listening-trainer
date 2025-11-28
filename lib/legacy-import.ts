import type { Prisma, PrismaClient } from '@prisma/client'

export interface LegacyAnswer {
  userAnswer: string
  isCorrect: boolean
  attemptedAt: string
}

export interface LegacyQuestion {
  index: number
  type: string
  question: string
  options?: string[]
  correctAnswer: string
  explanation?: string
  answers: LegacyAnswer[]
}

export interface LegacySession {
  sessionId: string
  topic: string
  difficulty: string
  language: string
  transcript: string
  score: number
  createdAt: string
  questions: LegacyQuestion[]
}

export interface ImportCounts {
  sessions: number
  questions: number
  answers: number
}

export function validateLegacyPayload(sessions: unknown): string[] {
  if (!sessions || !Array.isArray(sessions)) {
    return ['Invalid request: sessions array is required']
  }

  const errors: string[] = []

  sessions.forEach((session, sessionIndex) => {
    if (!session || typeof session !== 'object') {
      errors.push(`Session ${sessionIndex}: session must be an object`)
      return
    }

    const s = session as Partial<LegacySession>

    if (!s.sessionId || typeof s.sessionId !== 'string') errors.push(`Session ${sessionIndex}: sessionId is required and must be a string`)
    if (!s.topic || typeof s.topic !== 'string') errors.push(`Session ${sessionIndex}: topic is required and must be a string`)
    if (!s.difficulty || typeof s.difficulty !== 'string') errors.push(`Session ${sessionIndex}: difficulty is required and must be a string`)
    if (!s.language || typeof s.language !== 'string') errors.push(`Session ${sessionIndex}: language is required and must be a string`)
    if (!s.transcript || typeof s.transcript !== 'string') errors.push(`Session ${sessionIndex}: transcript is required and must be a string`)
    if (!s.createdAt || typeof s.createdAt !== 'string') errors.push(`Session ${sessionIndex}: createdAt is required and must be a string`)
    if (s.score !== undefined && typeof s.score !== 'number') errors.push(`Session ${sessionIndex}: score must be a number if provided`)
    if (!s.questions || !Array.isArray(s.questions)) errors.push(`Session ${sessionIndex}: questions is required and must be an array`)

    if (Array.isArray(s.questions)) {
      s.questions.forEach((question, questionIndex) => {
        if (!question || typeof question !== 'object') {
          errors.push(`Session ${sessionIndex}, Question ${questionIndex}: question must be an object`)
          return
        }
        const q = question as LegacyQuestion

        if (typeof q.index !== 'number') errors.push(`Session ${sessionIndex}, Question ${questionIndex}: index is required and must be a number`)
        if (!q.type || typeof q.type !== 'string') errors.push(`Session ${sessionIndex}, Question ${questionIndex}: type is required and must be a string`)
        if (!q.question || typeof q.question !== 'string') errors.push(`Session ${sessionIndex}, Question ${questionIndex}: question is required and must be a string`)
        if (!q.correctAnswer || typeof q.correctAnswer !== 'string') errors.push(`Session ${sessionIndex}, Question ${questionIndex}: correctAnswer is required and must be a string`)
        if (q.options !== undefined && q.options !== null && !Array.isArray(q.options)) errors.push(`Session ${sessionIndex}, Question ${questionIndex}: options must be an array if provided`)
        if (q.explanation !== undefined && q.explanation !== null && typeof q.explanation !== 'string') errors.push(`Session ${sessionIndex}, Question ${questionIndex}: explanation must be a string if provided`)
        if (!q.answers || !Array.isArray(q.answers)) errors.push(`Session ${sessionIndex}, Question ${questionIndex}: answers is required and must be an array`)

        if (Array.isArray(q.answers)) {
          q.answers.forEach((answer, answerIndex) => {
            if (!answer || typeof answer !== 'object') {
              errors.push(`Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}: answer must be an object`)
              return
            }

            const a = answer as LegacyAnswer

            if (!a.userAnswer || typeof a.userAnswer !== 'string') errors.push(`Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}: userAnswer is required and must be a string`)
            if (typeof a.isCorrect !== 'boolean') errors.push(`Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}: isCorrect is required and must be a boolean`)
            if (!a.attemptedAt || typeof a.attemptedAt !== 'string') errors.push(`Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}: attemptedAt is required and must be a string`)

            const attemptedAtDate = new Date(a.attemptedAt)
            if (Number.isNaN(attemptedAtDate.getTime())) {
              errors.push(`Session ${sessionIndex}, Question ${questionIndex}, Answer ${answerIndex}: attemptedAt must be a valid date string`)
            }
          })
        }
      })
    }

    const createdAtDate = new Date(s.createdAt as string)
    if (Number.isNaN(createdAtDate.getTime())) {
      errors.push(`Session ${sessionIndex}: createdAt must be a valid date string`)
    }
  })

  return errors
}

export async function importLegacySessions(
  prisma: PrismaClient,
  sessions: LegacySession[],
  userId: string,
  hasFocusAreasColumn: boolean
): Promise<ImportCounts> {
  let importedSessions = 0
  let importedQuestions = 0
  let importedAnswers = 0

  await prisma.$transaction(async (tx) => {
    for (const legacySession of sessions) {
      const sessionData = {
        userId,
        topic: legacySession.topic,
        difficulty: legacySession.difficulty,
        language: legacySession.language,
        transcript: legacySession.transcript,
        score: legacySession.score || null,
        exerciseData: JSON.stringify(legacySession),
        createdAt: new Date(legacySession.createdAt),
        updatedAt: new Date(legacySession.createdAt)
      }

      const practiceSession = await tx.practiceSession.create({
        data: sessionData
      })

      importedSessions++

      for (const legacyQuestion of legacySession.questions) {
        const questionData: Prisma.PracticeQuestionUncheckedCreateInput = {
          sessionId: practiceSession.id,
          index: legacyQuestion.index,
          type: legacyQuestion.type,
          question: legacyQuestion.question,
          options: legacyQuestion.options ? JSON.stringify(legacyQuestion.options) : null,
          correctAnswer: legacyQuestion.correctAnswer,
          explanation: legacyQuestion.explanation || null,
          transcriptSnapshot: null,
          createdAt: new Date(legacySession.createdAt)
        }

        if (hasFocusAreasColumn) {
          questionData.focusAreas = null
        }

        const practiceQuestion = await tx.practiceQuestion.create({
          data: questionData
        })

        importedQuestions++

        for (const legacyAnswer of legacyQuestion.answers) {
          await tx.practiceAnswer.create({
            data: {
              questionId: practiceQuestion.id,
              userAnswer: legacyAnswer.userAnswer,
              isCorrect: legacyAnswer.isCorrect,
              attemptedAt: new Date(legacyAnswer.attemptedAt),
              aiAnalysis: null,
              aiAnalysisGeneratedAt: null,
              tags: '[]',
              needsAnalysis: !legacyAnswer.isCorrect
            }
          })

          importedAnswers++
        }
      }
    }
  }, {
    timeout: 30000
  })

  return { sessions: importedSessions, questions: importedQuestions, answers: importedAnswers }
}
