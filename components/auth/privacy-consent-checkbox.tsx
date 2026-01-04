"use client"

import React, { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BilingualText } from "@/components/ui/bilingual-text"
import { ExternalLink } from "lucide-react"

const PRIVACY_NOTICE_LAST_UPDATED = '2026-01-04'

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

function PrivacyContentDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <BilingualText translationKey="components.authDialog.privacyConsent.dialogTitle" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <BilingualText
              translationKey="components.authDialog.privacyConsent.lastUpdated"
              options={{ values: { date: PRIVACY_NOTICE_LAST_UPDATED } }}
            />
          </p>

          {/* Introduction */}
          <p className="text-gray-700 dark:text-gray-300">
            <BilingualText translationKey="components.authDialog.privacyConsent.collectionText" />
          </p>

          {/* Collection Section */}
          <section>
            <h4 className="font-semibold mb-2">
              <BilingualText translationKey="components.authDialog.privacyConsent.collectionTitle" />
            </h4>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
              <li>
                <BilingualText translationKey="components.authDialog.privacyConsent.collectionList" />
              </li>
            </ul>
          </section>

          {/* Usage Section */}
          <section>
            <h4 className="font-semibold mb-2">
              <BilingualText translationKey="components.authDialog.privacyConsent.usageTitle" />
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              <BilingualText translationKey="components.authDialog.privacyConsent.usageText" />
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
              <li>
                <BilingualText translationKey="components.authDialog.privacyConsent.usageList" />
              </li>
            </ul>
          </section>

          {/* No Collection Section */}
          <section>
            <h4 className="font-semibold mb-2">
              <BilingualText translationKey="components.authDialog.privacyConsent.noCollectionTitle" />
            </h4>
            <p className="text-gray-700 dark:text-gray-300">
              <BilingualText translationKey="components.authDialog.privacyConsent.noCollectionText" />
            </p>
          </section>

          {/* Data Usage Section */}
          <section>
            <h4 className="font-semibold mb-2">
              <BilingualText translationKey="components.authDialog.privacyConsent.dataUsageTitle" />
            </h4>
            <p className="text-gray-700 dark:text-gray-300">
              <BilingualText translationKey="components.authDialog.privacyConsent.dataUsageText" />
            </p>
          </section>

          {/* Consent Statement */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <BilingualText translationKey="components.authDialog.privacyConsent.consentStatement" />
            </p>
          </div>

          {/* Close button */}
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              <BilingualText translationKey="components.authDialog.privacyConsent.closeButton" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
