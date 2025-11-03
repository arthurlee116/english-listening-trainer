import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Sparkles, Lightbulb } from 'lucide-react'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { cn } from '@/lib/utils'

interface InsightPanelProps {
  summaryText?: string
  isCompleted: boolean
  onRegenerate: () => void
  loading: boolean
  className?: string
}

export function InsightPanel({
  summaryText,
  isCompleted,
  onRegenerate,
  loading,
  className
}: InsightPanelProps) {
  const { t } = useBilingualText()

  const showSkeleton = !summaryText && (isCompleted || loading)
  const showGenerateButton = isCompleted && !summaryText && !loading

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            {t('challenges.aiInsights')}
          </CardTitle>
          {summaryText && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('challenges.regenerate')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : summaryText ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
              {summaryText}
            </div>
          </div>
        ) : showGenerateButton ? (
          <div className="text-center py-8">
            <Lightbulb className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('challenges.generateInsights')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('challenges.generateInsightsDesc')}
            </p>
            <Button onClick={onRegenerate} disabled={loading} className="gap-2">
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('challenges.generateSummary')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('challenges.completeToSeeInsights')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
