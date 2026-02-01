import { useEffect, useState } from 'react'

import type { UserProgressMetrics } from '@/lib/types'
import { mergeHistoryEntries, getHistory, getProgressMetrics } from '@/lib/storage'
import { fetchAllPracticeHistory } from '@/lib/practice-history'
import { syncProgressFromHistory } from '@/lib/achievement-service'
interface SyncOptions {
  enabled?: boolean
  isAuthenticated?: boolean
}

export function useSyncedProgressMetrics(options: SyncOptions = {}) {
  const { enabled = true, isAuthenticated = false } = options
  const [metrics, setMetrics] = useState<UserProgressMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadMetrics = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const localMetrics = getProgressMetrics()
        const localHistory = (() => {
          try {
            const history = getHistory()
            return Array.isArray(history) ? history : []
          } catch {
            return []
          }
        })()

        if (!enabled || !isAuthenticated) {
          if (isActive) {
            setMetrics(localMetrics)
          }
          return
        }

        const serverHistory = await fetchAllPracticeHistory()
        const mergedHistory = mergeHistoryEntries({
          serverHistory,
          localHistory
        })
        const syncedMetrics = syncProgressFromHistory(mergedHistory)

        if (isActive) {
          setMetrics(syncedMetrics)
        }
      } catch (error) {
        if (isActive) {
          setMetrics(getProgressMetrics())
          setError(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadMetrics()

    return () => {
      isActive = false
    }
  }, [enabled, isAuthenticated])

  return { metrics, isLoading, error }
}
