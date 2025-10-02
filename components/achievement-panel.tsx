"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Calendar, 
  Star,
  Settings,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { BilingualText } from "@/components/ui/bilingual-text"
import type { 
  UserProgressMetrics, 
  UserGoalSettings, 
  AchievementBadge,
  GoalProgress
} from "@/lib/types"
import { 
  getProgressMetrics, 
  getGoalSettings, 
  saveGoalSettings,
  isStorageAvailable
} from "@/lib/storage"
import { 
  calculateGoalProgress,
  getEarnedAchievements,
  getAvailableAchievements
} from "@/lib/achievement-service"

interface AchievementPanelProps {
  isOpen: boolean
  onToggle: () => void
  userAuthenticated: boolean
}

export const AchievementPanel = ({ isOpen, onToggle, userAuthenticated }: AchievementPanelProps) => {
  const { t } = useBilingualText()
  
  // State for progress data
  const [progressMetrics, setProgressMetrics] = useState<UserProgressMetrics | null>(null)
  const [goalSettings, setGoalSettings] = useState<UserGoalSettings | null>(null)
  const [earnedAchievements, setEarnedAchievements] = useState<AchievementBadge[]>([])
  const [availableAchievements, setAvailableAchievements] = useState<AchievementBadge[]>([])
  
  // State for UI
  const [showSettings, setShowSettings] = useState(false)
  const [tempGoals, setTempGoals] = useState<UserGoalSettings | null>(null)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data on component mount with error handling
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        if (!isStorageAvailable()) {
          setStorageAvailable(false)
          setIsLoading(false)
          return
        }

        // 使用 Promise.all 并行加载数据，提高性能
        const [metrics, goals, earned, available] = await Promise.all([
          Promise.resolve(getProgressMetrics()),
          Promise.resolve(getGoalSettings()),
          Promise.resolve(getEarnedAchievements()),
          Promise.resolve(getAvailableAchievements())
        ])

        setProgressMetrics(metrics)
        setGoalSettings(goals)
        setTempGoals(goals)
        setEarnedAchievements(earned)
        setAvailableAchievements(available)
      } catch (error) {
        console.error("Failed to load achievement data:", error)
        setError(t('components.achievementPanel.loadError') || 'Failed to load data')
        setStorageAvailable(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [])

  // Calculate goal progress
  const goalProgress: GoalProgress | null = useMemo(() => {
    if (!progressMetrics || !goalSettings) return null
    return calculateGoalProgress(progressMetrics, goalSettings)
  }, [progressMetrics, goalSettings])

  // Handle goal settings save
  const handleSaveGoals = () => {
    if (!tempGoals || !isStorageAvailable()) return

    try {
      const updatedGoals = {
        ...tempGoals,
        lastUpdatedAt: new Date().toISOString()
      }
      saveGoalSettings(updatedGoals)
      setGoalSettings(updatedGoals)
      setShowSettings(false)
      
      // Refresh goal progress
      if (progressMetrics) {
        // Goal progress will be recalculated in the next render
      }
    } catch (error) {
      console.error("Failed to save goal settings:", error)
    }
  }

  // Render error state
  if (error) {
    return (
      <Card className="glass-effect p-6">
        <div className="text-center text-red-500 dark:text-red-400">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium mb-2">{t('components.achievementPanel.errorTitle') || 'Error Loading Data'}</p>
          <p className="text-sm">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            {t('common.buttons.retry') || 'Retry'}
          </Button>
        </div>
      </Card>
    )
  }

  // Render storage unavailable state
  if (!storageAvailable) {
    return (
      <Card className="glass-effect p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p><BilingualText translationKey="components.achievementPanel.localModeNotice" /></p>
        </div>
      </Card>
    )
  }

  // Render loading state
  if (isLoading) {
    return (
      <Card className="glass-effect p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p><BilingualText translationKey="common.messages.loading" /></p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Panel Toggle Button */}
      <Button
        onClick={onToggle}
        variant="outline"
        className="w-full glass-effect"
      >
        <Trophy className="w-4 h-4 mr-2" />
        <BilingualText translationKey={isOpen ? "components.achievementPanel.hidePanel" : "components.achievementPanel.showPanel"} />
        {isOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
      </Button>

      {/* Panel Content */}
      {isOpen && (
        <div className="space-y-6">
          {/* Authentication Status Notice */}
          {!userAuthenticated && (
            <Card className="glass-effect p-4 border-orange-200 bg-orange-50 dark:bg-orange-950">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <Star className="w-4 h-4" />
                <span className="text-sm">
                  <BilingualText translationKey="components.achievementPanel.localModeNotice" />
                </span>
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                <BilingualText translationKey="components.achievementPanel.loginToSync" />
              </p>
            </Card>
          )}

          {/* Goal Progress Section */}
          <Card className="glass-effect p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <BilingualText translationKey="components.achievementPanel.goalProgress" />
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Goal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <BilingualText translationKey="components.achievementPanel.dailyGoalProgress" />
                  </Label>
                  {goalProgress && (
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {goalProgress.daily.current}/{goalProgress.daily.target} <BilingualText translationKey="common.labels.minutes" />
                    </span>
                  )}
                </div>
                {goalProgress && (
                  <Progress value={(goalProgress.daily.current / goalProgress.daily.target) * 100} className="h-2" />
                )}
                {goalProgress?.daily.isCompleted && (
                  <div className="flex items-center gap-1 text-green-600 text-xs">
                    <Trophy className="w-3 h-3" />
                    <BilingualText translationKey="components.achievementPanel.completed" />
                  </div>
                )}
              </div>

              {/* Weekly Goal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <BilingualText translationKey="components.achievementPanel.weeklyGoalProgress" />
                  </Label>
                  {goalProgress && (
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {goalProgress.weekly.current}/{goalProgress.weekly.target} <BilingualText translationKey="common.labels.sessions" />
                    </span>
                  )}
                </div>
                {goalProgress && (
                  <Progress value={(goalProgress.weekly.current / goalProgress.weekly.target) * 100} className="h-2" />
                )}
                {goalProgress?.weekly.isCompleted && (
                  <div className="flex items-center gap-1 text-green-600 text-xs">
                    <Trophy className="w-3 h-3" />
                    <BilingualText translationKey="components.achievementPanel.completed" />
                  </div>
                )}
              </div>
            </div>

            {/* Goal Settings */}
            {showSettings && tempGoals && (
              <div className="mt-6 pt-4 border-t space-y-4">
                <h4 className="font-medium">
                  <BilingualText translationKey="components.achievementPanel.goalSettings" />
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      <BilingualText translationKey="components.achievementPanel.dailyMinutesTarget" />
                    </Label>
                    <div className="space-y-2">
                      <Slider
                        value={[tempGoals.dailyMinutesTarget]}
                        onValueChange={(value) => setTempGoals({...tempGoals, dailyMinutesTarget: value[0]})}
                        max={60}
                        min={5}
                        step={5}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600 dark:text-gray-300">
                        {tempGoals.dailyMinutesTarget} <BilingualText translationKey="common.labels.minutes" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      <BilingualText translationKey="components.achievementPanel.weeklySessionsTarget" />
                    </Label>
                    <div className="space-y-2">
                      <Slider
                        value={[tempGoals.weeklySessionsTarget]}
                        onValueChange={(value) => setTempGoals({...tempGoals, weeklySessionsTarget: value[0]})}
                        max={21}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600 dark:text-gray-300">
                        {tempGoals.weeklySessionsTarget} <BilingualText translationKey="common.labels.sessions" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveGoals} size="sm">
                    <BilingualText translationKey="components.achievementPanel.saveGoalSettings" />
                  </Button>
                  <Button variant="outline" onClick={() => setShowSettings(false)} size="sm">
                    <BilingualText translationKey="common.buttons.cancel" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Statistics Overview */}
          <Card className="glass-effect p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <BilingualText translationKey="components.achievementPanel.statisticsOverview" />
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-blue-600">{progressMetrics?.totalSessions ?? 0}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="components.achievementPanel.totalSessions" />
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-green-600">{progressMetrics?.averageAccuracy ? (progressMetrics.averageAccuracy.toFixed(1) + '%') : '0%'}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="components.achievementPanel.averageAccuracy" />
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-orange-600">{progressMetrics?.currentStreakDays ?? 0}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="components.achievementPanel.currentStreak" />
                </div>
              </div>
              
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold text-purple-600">{progressMetrics?.totalListeningMinutes ?? 0}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="components.achievementPanel.totalListeningTime" />
                </div>
              </div>
            </div>
          </Card>

          {/* Achievement Badges */}
          <Card className="glass-effect p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <BilingualText translationKey="components.achievementPanel.achievementBadges" />
            </h3>
            
            {/* Earned Achievements */}
            {earnedAchievements.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium mb-3 text-green-600">
                  <BilingualText translationKey="components.achievementPanel.earnedAchievements" />
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {earnedAchievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="flex flex-col items-center p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                    >
                      <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          <BilingualText translationKey={achievement.titleKey} />
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          <BilingualText translationKey={achievement.descriptionKey} />
                        </div>
                        {achievement.earnedAt && (
                          <div className="text-xs text-green-600 mt-1">
                            <BilingualText translationKey="components.achievementPanel.earnedAt" />: {new Date(achievement.earnedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Achievements */}
            {availableAchievements.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 text-gray-600 dark:text-gray-300">
                  <BilingualText translationKey="components.achievementPanel.availableAchievements" />
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {availableAchievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="flex flex-col items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-60"
                    >
                      <Star className="w-6 h-6 text-gray-400 mb-2" />
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          <BilingualText translationKey={achievement.titleKey} />
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          <BilingualText translationKey={achievement.descriptionKey} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No achievements message */}
            {earnedAchievements.length === 0 && availableAchievements.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>
                  <BilingualText translationKey="components.achievementPanel.noAchievementsYet" />
                </p>
              </div>
            )}
          </Card>

          {/* Weekly Trend Chart */}
          {progressMetrics && progressMetrics.weeklyTrend && progressMetrics.weeklyTrend.length > 0 && (
            <Card className="glass-effect p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <BilingualText translationKey="components.achievementPanel.weeklyTrend" />
              </h3>
              
              <div className="grid grid-cols-7 gap-2">
                {progressMetrics.weeklyTrend.map((trend, index) => {
                  const date = new Date(trend.date)
                  const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                  const maxSessions = Math.max(...progressMetrics.weeklyTrend.map(t => t.sessions))
                  const height = maxSessions > 0 ? (trend.sessions / maxSessions) * 60 : 0
                  
                  return (
                    <div key={index} className="flex flex-col items-center space-y-1">
                      <div className="text-xs text-gray-600 dark:text-gray-300">{dayName}</div>
                      <div 
                        className="w-full bg-blue-500 rounded-t-sm"
                        style={{ height: Math.max(height, 4) + 'px' }}
                        title={`${trend.sessions} sessions on ${trend.date}`}
                      />
                      <div className="text-xs text-gray-500">{trend.sessions}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

AchievementPanel.displayName = "AchievementPanel"