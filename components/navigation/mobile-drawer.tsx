"use client"

import { useMemo } from "react"
import { Shield, User, Globe } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useLanguage } from "@/components/providers/language-provider"
import type { NavigationAction } from "@/lib/types"

interface MobileDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (action: NavigationAction) => void
  isAuthenticated: boolean
  isAdmin: boolean
  userLabel?: string
}

export function MobileDrawer({
  open,
  onOpenChange,
  onNavigate,
  isAuthenticated,
  isAdmin,
  userLabel,
}: MobileDrawerProps) {
  const { currentLanguage, switchLanguage } = useLanguage()

  const languageLabel = useMemo(() => {
    return currentLanguage === "zh" ? "English" : "中文"
  }, [currentLanguage])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="mobile-drawer">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">
            <BilingualText translationKey="navigation.userSection" />
          </SheetTitle>
        </SheetHeader>

        {isAuthenticated && userLabel && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{userLabel}</div>
                {isAdmin && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    Admin
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 rounded-xl"
            onClick={() => {
              onNavigate({ type: "setState", targetState: "profile" })
              onOpenChange(false)
            }}
          >
            <User className="h-4 w-4" />
            <BilingualText translationKey="navigation.profile" />
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 rounded-xl"
            onClick={() => {
              switchLanguage(currentLanguage === "zh" ? "en" : "zh")
              onOpenChange(false)
            }}
          >
            <Globe className="h-4 w-4" />
            <BilingualText translationKey="navigation.language" />
            <span className="ml-auto text-xs text-foreground-muted">{languageLabel}</span>
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 rounded-xl"
              onClick={() => {
                onNavigate({ type: "external", href: "/admin", openInNewTab: true })
                onOpenChange(false)
              }}
            >
              <Shield className="h-4 w-4" />
              <BilingualText translationKey="navigation.admin" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
