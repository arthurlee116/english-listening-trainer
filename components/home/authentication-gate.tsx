"use client"

import type { ReactNode } from "react"

import { Loader2 } from "lucide-react"

import { AuthDialog } from "@/components/auth-dialog"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Card } from "@/components/ui/card"
import type { AuthUserInfo } from "@/hooks/use-auth-state"

interface AuthenticationGateProps {
  isLoading: boolean
  hasMounted: boolean
  isAuthenticated: boolean
  showAuthDialog: boolean
  onUserAuthenticated: (user: AuthUserInfo, token: string) => void
  children: ReactNode
}

export function AuthenticationGate({
  isLoading,
  hasMounted,
  isAuthenticated,
  showAuthDialog,
  onUserAuthenticated,
  children,
}: AuthenticationGateProps) {
  if (isLoading || !hasMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-semibold mb-2">
            <BilingualText translationKey="messages.loadingApp" />
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            <BilingualText translationKey="messages.verifyingLogin" />
          </p>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <AuthDialog open={showAuthDialog} onUserAuthenticated={onUserAuthenticated} />
      </div>
    )
  }

  return <>{children}</>
}
