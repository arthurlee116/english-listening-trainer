"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BilingualText } from "@/components/ui/bilingual-text"

interface BilingualAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey?: string
  title?: string
  descriptionKey?: string
  description?: string
  confirmTextKey?: string
  cancelTextKey?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export function BilingualAlertDialog({
  open,
  onOpenChange,
  titleKey = "messages.confirmAction",
  title,
  descriptionKey = "messages.confirmActionDesc",
  description,
  confirmTextKey = "buttons.confirm",
  cancelTextKey = "buttons.cancel",
  onConfirm,
  onCancel,
}: BilingualAlertDialogProps) {
  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {titleKey ? (
              <BilingualText translationKey={titleKey} />
            ) : (
              title
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {descriptionKey ? (
              <BilingualText translationKey={descriptionKey} />
            ) : (
              description
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            <BilingualText translationKey={cancelTextKey} />
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            <BilingualText translationKey={confirmTextKey} />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}