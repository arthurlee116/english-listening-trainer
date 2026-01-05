"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { BilingualText } from "@/components/ui/bilingual-text"
import { PRIVACY_POLICY_VERSION } from "@/lib/constants/privacy"
import { saveConsent } from "@/lib/privacy-consent"
import { PrivacyContentDialog } from "@/components/auth/privacy-content-dialog"

interface LoginConsentDialogProps {
  open: boolean
  onConsent: () => void
  onRefuse: () => void
  userId: string
}

export function LoginConsentDialog({ open, onConsent, onRefuse, userId }: LoginConsentDialogProps) {
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false)

  const handleAgree = () => {
    if (!userId) {
      onRefuse()
      return
    }

    // Store consent in localStorage
    saveConsent(userId)
    onConsent()
  }

  const handleRefuse = () => {
    // Clear any existing consent and logout
    onRefuse()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) return }}>
      <DialogContent className="sm:max-w-md" aria-labelledby="consent-dialog-title">
        <DialogHeader>
          <DialogTitle id="consent-dialog-title" className="flex items-center gap-2">
            <BilingualText translationKey="components.loginConsent.title" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Introduction */}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <BilingualText translationKey="components.loginConsent.description" />
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            <BilingualText
              translationKey="components.loginConsent.policyVersion"
              options={{ values: { version: PRIVACY_POLICY_VERSION } }}
            />
          </p>

          {/* Privacy Content Link */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              <BilingualText translationKey="components.loginConsent.readNotice" />
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setPrivacyDialogOpen(true)}
            >
              <BilingualText translationKey="components.loginConsent.viewPrivacyNotice" />
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleRefuse}
          >
            <BilingualText translationKey="components.loginConsent.logoutButton" />
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={handleAgree}
          >
            <BilingualText translationKey="components.loginConsent.agreeButton" />
          </Button>
        </div>
      </DialogContent>

      {/* Privacy Content Dialog */}
      <PrivacyContentDialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen} />
    </Dialog>
  )
}
