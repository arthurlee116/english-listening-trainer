'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Plus, Target, Calendar, TrendingUp } from 'lucide-react'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { CreateChallengeDialog } from '@/components/challenges/create-challenge-dialog'
import type { Challenge, ChallengeProgressStats } from '@/lib/types'

interface ChallengeWithStats extends Challenge {
  stats: ChallengeProgressStats
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const { t } = useBilingualText()
  const router = useRouter()

  useEffect(() => {
    loadChallenges()
  }, [])

  const loadChallenges = async () => {
    try {
      const response = await fetch('/api/challenges')
      if (response.ok) {
        const data = await response.json()
        setChallenges(data.challenges)
      }
    } catch (error) {
      console.error('Failed to load challenges:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateChallenge = () => {
    setShowCreateDialog(true)
  }

  const handleChallengeCreated = () => {
    setShowCreateDialog(false)
    loadChallenges()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">{t('challenges.status.active')}</Badge>
      case 'completed':
        return <Badge variant="secondary">{t('challenges.status.completed')}</Badge>
      case 'paused':
        return <Badge variant="outline">{t('challenges.status.paused')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-2 bg-gray-200 rounded"></div>
                  <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('challenges.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('challenges.subtitle')}
          </p>
        </div>
        <Button onClick={handleCreateChallenge} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('challenges.createNew')}
        </Button>
      </div>

      {challenges.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('challenges.noChallenges')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('challenges.noChallengesDesc')}
          </p>
          <Button onClick={handleCreateChallenge}>
            <Plus className="w-4 h-4 mr-2" />
            {t('challenges.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {challenges.map((challenge) => (
            <Card
              key={challenge.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/challenges/${challenge.id}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{challenge.topic}</CardTitle>
                  {getStatusBadge(challenge.status)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {t('challenges.difficultyRange')}: {challenge.minDifficulty} - {challenge.maxDifficulty}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>{t('challenges.progress')}</span>
                      <span>{challenge.stats.completedSessions}/{challenge.stats.targetSessions}</span>
                    </div>
                    <Progress
                      value={challenge.stats.completionPercentage}
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="font-medium">
                          {challenge.stats.averageAccuracy
                            ? `${(challenge.stats.averageAccuracy * 100).toFixed(1)}%`
                            : 'N/A'
                          }
                        </div>
                        <div className="text-gray-500">{t('challenges.avgAccuracy')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">
                          {Math.round(challenge.stats.totalDuration / 60)}min
                        </div>
                        <div className="text-gray-500">{t('challenges.totalTime')}</div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" variant="outline">
                    {challenge.status === 'completed' ? t('challenges.viewSummary') : t('challenges.continue')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateChallengeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleChallengeCreated}
      />
    </div>
  )
}
