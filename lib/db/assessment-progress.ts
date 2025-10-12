import { withDatabase } from '@/lib/database'
import { clearUserCache } from '@/lib/auth'

export interface AssessmentProgressRecord {
  assessmentCompletedAt: Date | null
}

export async function getAssessmentProgress(userId: string): Promise<AssessmentProgressRecord> {
  const progress = await withDatabase(
    (client) => client.user.findUnique({
      where: { id: userId },
      select: { assessmentCompletedAt: true },
    }),
    'get assessment progress'
  )

  if (!progress) {
    throw new Error('User not found')
  }

  return { assessmentCompletedAt: progress.assessmentCompletedAt }
}

export async function markAssessmentCompleted(
  userId: string,
  completedAt: Date = new Date()
): Promise<AssessmentProgressRecord> {
  const updated = await withDatabase(
    (client) => client.user.update({
      where: { id: userId },
      data: { assessmentCompletedAt: completedAt },
      select: { assessmentCompletedAt: true },
    }),
    'mark assessment completed'
  )

  clearUserCache(userId)

  return { assessmentCompletedAt: updated.assessmentCompletedAt }
}
