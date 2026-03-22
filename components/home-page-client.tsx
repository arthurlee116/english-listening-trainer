/**
 * English Listening Trainer - 主页面客户端入口
 * 页面本身保持 server component，避免把整条路由都拖进客户端边界。
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { MainApp } from '@/components/main-app'
import { AuthenticationGate } from '@/components/home/authentication-gate'
import { useAuth } from '@/components/providers/auth-provider'
import type { AuthUserInfo } from '@/hooks/use-auth-state'

export function HomePageClient() {
  const [hasMounted, setHasMounted] = useState(false)
  const authState = useAuth()
  const {
    isAuthenticated,
    isLoading,
    showAuthDialog,
    hasConsent,
    showConsentDialog,
    user,
    handleUserAuthenticated,
    handleConsentAgreed,
    handleConsentRefused,
  } = authState

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
      hasConsent={hasConsent}
      showConsentDialog={showConsentDialog}
      user={user}
      onUserAuthenticated={handleUserAuthenticatedCallback}
      onConsentAgreed={handleConsentAgreed}
      onConsentRefused={handleConsentRefused}
    >
      <MainApp authState={authState} />
    </AuthenticationGate>
  )
}

HomePageClient.displayName = 'HomePageClient'
