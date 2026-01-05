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

  return (
    <>
      <div className="flex items-start space-x-2 pt-2">
        <Checkbox
          id="privacy-consent"
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(c as boolean)}
          className="mt-0.5"
        />
        <Label htmlFor="privacy-consent" className="text-sm font-normal cursor-pointer flex-1">
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
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1 ml-6" role="alert">
          {error}
        </p>
      )}

      <PrivacyContentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
