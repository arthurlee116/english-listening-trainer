"use client"

import React, { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BilingualText } from "@/components/ui/bilingual-text"
import { ExternalLink } from "lucide-react"
import { PrivacyContentDialog } from "@/components/auth/privacy-content-dialog"

interface PrivacyConsentCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  error?: string
}

export function PrivacyConsentCheckbox({
  checked,
  onCheckedChange,
  error
}: PrivacyConsentCheckboxProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleAgree = () => {
    onCheckedChange(true)
    setDialogOpen(false)
  }

  return (
    <>
      <div className={`flex items-start rounded-lg border px-3 py-3 ${error ? "border-red-300 bg-red-50/70" : "border-border/60 bg-muted/20"}`}>
        <Checkbox
          id="privacy-consent"
          data-testid="privacy-consent-checkbox"
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(c as boolean)}
          className="mt-0.5 h-5 w-5 rounded border-2 border-slate-400 bg-white shadow-sm data-[state=checked]:border-primary data-[state=checked]:bg-primary"
        />
        <div className="ml-3 flex-1">
          <Label htmlFor="privacy-consent" className="text-sm font-normal cursor-pointer block">
            <span className="flex items-center gap-1 flex-wrap">
              <BilingualText translationKey="components.authDialog.privacyConsent.checkboxLabel" />
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-primary underline text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  setDialogOpen(true)
                }}
              >
                <BilingualText translationKey="components.authDialog.privacyConsent.privacyLinkText" />
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </Button>
            </span>
          </Label>

          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <BilingualText translationKey="components.authDialog.privacyConsent.reviewAndAgreeButton" />
            </Button>
          </div>
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1 ml-2" role="alert">
          {error}
        </p>
      )}

      <PrivacyContentDialog open={dialogOpen} onOpenChange={setDialogOpen} onAgree={handleAgree} />
    </>
  )
}
