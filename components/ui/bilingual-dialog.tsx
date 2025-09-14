"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"

interface BilingualDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey?: string
  title?: string
  descriptionKey?: string
  description?: string
  children?: React.ReactNode
  showCancel?: boolean
  showConfirm?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  confirmTextKey?: string
  cancelTextKey?: string
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
}

export function BilingualDialog({
  open,
  onOpenChange,
  titleKey,
  title,
  descriptionKey,
  description,
  children,
  showCancel = false,
  showConfirm = false,
  onConfirm,
  onCancel,
  confirmTextKey = "buttons.confirm",
  cancelTextKey = "buttons.cancel",
  confirmVariant = "default"
}: BilingualDialogProps) {
  const { t } = useBilingualText()

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          {(titleKey || title) && (
            <DialogTitle>
              {titleKey ? (
                <BilingualText translationKey={titleKey} />
              ) : (
                title
              )}
            </DialogTitle>
          )}
          {(descriptionKey || description) && (
            <DialogDescription>
              {descriptionKey ? (
                <BilingualText translationKey={descriptionKey} />
              ) : (
                description
              )}
            </DialogDescription>
          )}
        </DialogHeader>
        
        {children}
        
        {(showCancel || showConfirm) && (
          <DialogFooter>
            {showCancel && (
              <Button variant="outline" onClick={handleCancel}>
                <BilingualText translationKey={cancelTextKey} />
              </Button>
            )}
            {showConfirm && (
              <Button variant={confirmVariant} onClick={handleConfirm}>
                <BilingualText translationKey={confirmTextKey} />
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}