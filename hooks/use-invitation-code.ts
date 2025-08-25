/**
 * 邀请码管理 Hook
 * 从主页面组件中提取的邀请码验证逻辑
 */

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface UsageInfo {
  todayUsage: number
  remainingUsage: number
}

export interface AssessmentInfo {
  hasAssessment: boolean
  difficultyLevel?: number
  testDate?: string
}

export function useInvitationCode() {
  const [invitationCode, setInvitationCode] = useState<string>("")
  const [isInvitationVerified, setIsInvitationVerified] = useState<boolean>(false)
  const [usageInfo, setUsageInfo] = useState<UsageInfo>({ todayUsage: 0, remainingUsage: 5 })
  const [assessmentInfo, setAssessmentInfo] = useState<AssessmentInfo>({ hasAssessment: false })
  const [showInvitationDialog, setShowInvitationDialog] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const { toast } = useToast()

  const checkInvitationCode = useCallback(async () => {
    setIsLoading(true)
    const storedCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
    
    if (storedCode) {
      try {
        const response = await fetch(`/api/invitation/check?code=${encodeURIComponent(storedCode)}`)
        const data = await response.json()
        
        if (response.ok) {
          setInvitationCode(data.code)
          setIsInvitationVerified(true)
          setUsageInfo({
            todayUsage: data.todayUsage,
            remainingUsage: data.remainingUsage
          })
          
          // 获取用户的难度评估状态
          try {
            const assessmentResponse = await fetch(`/api/assessment/status?code=${encodeURIComponent(data.code)}`)
            const assessmentData = await assessmentResponse.json()
            
            if (assessmentResponse.ok) {
              setAssessmentInfo({
                hasAssessment: assessmentData.data.hasAssessment,
                difficultyLevel: assessmentData.data.difficultyLevel,
                testDate: assessmentData.data.testDate
              })
            }
          } catch (assessmentError) {
            console.error('Failed to fetch assessment status:', assessmentError)
            // 不影响主流程，只是没有评估信息
          }
        } else {
          // 清理无效的邀请码
          localStorage.removeItem('invitation_code')
          sessionStorage.removeItem('invitation_code')
          setShowInvitationDialog(true)
          
          toast({
            title: "邀请码失效",
            description: data.message || "邀请码已失效，请重新输入",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error('Failed to verify invitation code:', error)
        toast({
          title: "验证失败",
          description: "无法验证邀请码，请检查网络连接后重试",
          variant: "destructive",
        })
        setShowInvitationDialog(true)
      } finally {
        setIsLoading(false)
      }
    } else {
      setShowInvitationDialog(true)
      setIsLoading(false)
    }
  }, [toast])

  const handleInvitationCodeVerified = useCallback((
    code: string, 
    usage: UsageInfo
  ) => {
    setInvitationCode(code)
    setIsInvitationVerified(true)
    setUsageInfo(usage)
    setShowInvitationDialog(false)
    
    toast({
      title: "验证成功",
      description: `今日剩余使用次数：${usage.remainingUsage}`,
    })
  }, [toast])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('invitation_code')
    sessionStorage.removeItem('invitation_code')
    setInvitationCode("")
    setIsInvitationVerified(false)
    setUsageInfo({ todayUsage: 0, remainingUsage: 5 })
    setShowInvitationDialog(true)
    
    toast({
      title: "已退出",
      description: "已清除邀请码信息",
    })
  }, [toast])

  const decrementUsage = useCallback(() => {
    setUsageInfo(prev => ({
      todayUsage: prev.todayUsage + 1,
      remainingUsage: Math.max(0, prev.remainingUsage - 1)
    }))
  }, [])

  // 初始化时检查邀请码
  useEffect(() => {
    checkInvitationCode()
  }, [checkInvitationCode])

  return {
    invitationCode,
    isInvitationVerified,
    usageInfo,
    assessmentInfo,
    showInvitationDialog,
    isLoading,
    setShowInvitationDialog,
    handleInvitationCodeVerified,
    handleLogout,
    decrementUsage,
    checkInvitationCode
  }
}