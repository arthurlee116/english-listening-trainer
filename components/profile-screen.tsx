"use client"

import { Shield, Globe, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useLanguage } from "@/components/providers/language-provider"

interface ProfileScreenProps {
  userLabel?: string
  isAdmin: boolean
  onLogout: () => void
  onOpenAdmin: () => void
}

export function ProfileScreen({ userLabel, isAdmin, onLogout, onOpenAdmin }: ProfileScreenProps) {
  const { currentLanguage, switchLanguage } = useLanguage()

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">
          <BilingualText translationKey="profileScreen.title" />
        </h2>
        <p className="text-sm text-foreground-muted">
          <BilingualText translationKey="profileScreen.subtitle" />
        </p>
      </div>

      <Card className="glass-effect p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-foreground">
              {userLabel ?? "-"}
            </div>
            {isAdmin && (
              <Badge variant="secondary" className="mt-2 text-[11px]">
                Admin
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="glass-effect p-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => switchLanguage(currentLanguage === "zh" ? "en" : "zh")}
          >
            <Globe className="h-4 w-4" />
            <BilingualText translationKey="navigation.language" />
            <span className="ml-auto text-xs text-foreground-muted">
              {currentLanguage === "zh" ? "English" : "中文"}
            </span>
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={onOpenAdmin}
            >
              <Shield className="h-4 w-4" />
              <BilingualText translationKey="navigation.admin" />
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            <BilingualText translationKey="navigation.logout" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
