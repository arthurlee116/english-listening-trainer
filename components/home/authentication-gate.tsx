"use client"

import type { ReactNode } from "react"

import { Loader2 } from "lucide-react"

import { AuthDialog } from "@/components/auth-dialog"
import { LoginConsentDialog } from "@/components/auth/login-consent-dialog"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Card } from "@/components/ui/card"
import type { AuthUserInfo } from "@/hooks/use-auth-state"

interface AuthenticationGateProps {
  isLoading: boolean
  hasMounted: boolean
  isAuthenticated: boolean
  showAuthDialog: boolean
  hasConsent: boolean
  showConsentDialog: boolean
  user: AuthUserInfo | null
  onUserAuthenticated: (user: AuthUserInfo, token: string) => void
  onConsentAgreed: () => void
  onConsentRefused: () => void
  children: ReactNode
}

export function AuthenticationGate({
  isLoading,
  hasMounted,
  isAuthenticated,
  showAuthDialog,
  hasConsent,
  showConsentDialog,
  user,
  onUserAuthenticated,
  onConsentAgreed,
  onConsentRefused,
  children,
}: AuthenticationGateProps) {
  if (isLoading || !hasMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-semibold mb-2">
            <BilingualText translationKey="messages.loadingApp" />
          </h2>
          <p className="text-gray-600">
            <BilingualText translationKey="messages.verifyingLogin" />
          </p>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <AuthDialog open={showAuthDialog} onUserAuthenticated={onUserAuthenticated} />
      </div>
    )
  }

  // Authenticated but no consent - show consent dialog
  if (isAuthenticated && !hasConsent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <AuthDialog open={showAuthDialog} onUserAuthenticated={onUserAuthenticated} />
        <LoginConsentDialog
          open={showConsentDialog}
          onConsent={onConsentAgreed}
          onRefuse={onConsentRefused}
          userId={user?.id || ''}
        />
      </div>
    )
  }

  return <>{children}</>
}
