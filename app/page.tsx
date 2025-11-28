/**
 * English Listening Trainer - 主页面
 * 专注于鉴权检查和整体布局，状态管理统一由 MainApp 负责
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { MainApp } from "@/components/main-app"
import { AuthenticationGate } from "@/components/home/authentication-gate"
import { useAuthState, type AuthUserInfo } from "@/hooks/use-auth-state"

export default function HomePage() {
  const [hasMounted, setHasMounted] = useState(false)
  const authState = useAuthState()
  const {
    isAuthenticated,
    isLoading,
    showAuthDialog,
    handleUserAuthenticated,
  } = authState

  // Client-side mount detection
  useEffect(() => {
    setHasMounted(true)
  }, [])

  const handleUserAuthenticatedCallback = useCallback(
    (userData: AuthUserInfo, token: string) => {
      handleUserAuthenticated(userData, token)
    },
    [handleUserAuthenticated]
  )

  return (
    <AuthenticationGate
      isLoading={isLoading}
      hasMounted={hasMounted}
      isAuthenticated={isAuthenticated}
      showAuthDialog={showAuthDialog}
      onUserAuthenticated={handleUserAuthenticatedCallback}
    >
      {/* MainApp 内部统一管理状态、侧边栏和主内容 */}
      <MainApp authState={authState} />
    </AuthenticationGate>
  )
}

HomePage.displayName = "HomePage"
