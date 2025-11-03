'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Target, TrendingUp, Clock, Award, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { ProgressCard } from '@/components/challenges/progress-card'
import { InsightPanel } from '@/components/challenges/insight-panel'
import type { ChallengeWithStats } from '@/lib/types'

export default function ChallengeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const challengeId = params.challengeId as string
  const [challenge, setChallenge] = useState<ChallengeWithStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const { t } = useBilingualText()

  useEffect(() => {
    loadChallenge()
  }, [challengeId])

  const loadChallenge = async () => {
    try {
      const response = await fetch(`/api/challenges/${challengeId}`)
      if (response.ok) {
        const data = await response.json()
        // API returns { challenge, stats, sessions }, need to flatten for ChallengeWithStats
        const challengeWithStats = {
          ...data.challenge,
          stats: data.stats,
          sessions: data.sessions
        }
        setChallenge(challengeWithStats)
      } else if (response.status === 404) {
        router.push('/challenges')
      }
    } catch (error) {
      console.error('Failed to load challenge:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteChallenge = async () => {
    if (!challenge || challenge.status === 'completed') return

    setCompleting(true)
    try {
      const response = await fetch(`/api/challenges/${challengeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        await loadChallenge() // 重新加载挑战数据以获取新的总结
      }
    } catch (error) {
      console.error('Failed to complete challenge:', error)
    } finally {
      setCompleting(false)
    }
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

  // 准备图表数据
  const prepareAccuracyChartData = () => {
    if (!challenge?.sessions) return []

    return challenge.sessions.map((session, index) => ({
      session: `练习 ${index + 1}`,
      accuracy: session.accuracy ? session.accuracy * 100 : 0,
      difficulty: session.difficulty
    }))
  }

  const prepareCompletionChartData = () => {
    if (!challenge?.stats.difficultyDistribution) return []

    return Object.entries(challenge.stats.difficultyDistribution).map(([level, count]) => ({
      difficulty: level,
      sessions: count
    }))
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('challenges.notFound')}
          </h2>
          <Button onClick={() => router.push('/challenges')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('challenges.backToList')}
          </Button>
        </div>
      </div>
    )
  }

  const accuracyChartData = prepareAccuracyChartData()
  const completionChartData = prepareCompletionChartData()

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.push('/challenges')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('challenges.backToList')}
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {challenge.topic}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {getStatusBadge(challenge.status)}
            <span className="text-gray-600 dark:text-gray-400">
              {t('challenges.difficultyRange')}: {challenge.minDifficulty} - {challenge.maxDifficulty}
            </span>
          </div>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <ProgressCard
          title={t('challenges.completion')}
          value={`${challenge.stats.completedSessions}/${challenge.stats.targetSessions}`}
          subtitle={`${challenge.stats.completionPercentage.toFixed(1)}%`}
          icon={<Target className="w-5 h-5" />}
        />
        <ProgressCard
          title={t('challenges.avgAccuracy')}
          value={challenge.stats.averageAccuracy ? `${(challenge.stats.averageAccuracy * 100).toFixed(1)}%` : 'N/A'}
          subtitle={t(`challenges.trend.${challenge.stats.accuracyTrend}`)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <ProgressCard
          title={t('challenges.totalTime')}
          value={`${Math.round(challenge.stats.totalDuration / 60)}min`}
          subtitle={challenge.stats.averageDuration ? `${Math.round(challenge.stats.averageDuration / 60)}min/次` : ''}
          icon={<Clock className="w-5 h-5" />}
        />
        <ProgressCard
          title={t('challenges.sessions')}
          value={challenge.stats.completedSessions.toString()}
          subtitle={t('challenges.completed')}
          icon={<Award className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 准确率趋势图 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('challenges.accuracyTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                accuracy: {
                  label: t('challenges.accuracy'),
                  color: 'hsl(var(--chart-1))'
                }
              }}
              className="h-[300px]"
            >
              <LineChart data={accuracyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="session" />
                <YAxis domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="var(--color-accuracy)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-accuracy)' }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 难度分布图 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('challenges.difficultyDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                sessions: {
                  label: t('challenges.sessions'),
                  color: 'hsl(var(--chart-2))'
                }
              }}
              className="h-[300px]"
            >
              <BarChart data={completionChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="difficulty" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sessions" fill="var(--color-sessions)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI洞察面板 */}
      <InsightPanel
        summaryText={challenge.summaryText}
        isCompleted={challenge.status === 'completed'}
        onRegenerate={handleCompleteChallenge}
        loading={completing}
        className="mb-8"
      />

      {/* 练习会话列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('challenges.sessionHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('challenges.sessionTopic')}</TableHead>
                <TableHead>{t('challenges.difficulty')}</TableHead>
                <TableHead>{t('challenges.accuracy')}</TableHead>
                <TableHead>{t('challenges.duration')}</TableHead>
                <TableHead>{t('challenges.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challenge.sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">{session.topic}</TableCell>
                  <TableCell>{session.difficulty}</TableCell>
                  <TableCell>
                    {session.accuracy ? `${(session.accuracy * 100).toFixed(1)}%` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {session.duration ? `${Math.round(session.duration / 60)}min` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {new Date(session.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 完成挑战按钮 */}
      {challenge.status === 'active' && challenge.stats.completedSessions >= challenge.stats.targetSessions && (
        <div className="mt-8 text-center">
          <Button
            onClick={handleCompleteChallenge}
            disabled={completing}
            size="lg"
            className="gap-2"
          >
            {completing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {t('challenges.completeChallenge')}
          </Button>
        </div>
      )}
    </div>
  )
}
