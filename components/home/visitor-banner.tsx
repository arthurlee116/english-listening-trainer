"use client"

import { useEffect, useState } from "react"
import { Mail, MessageCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BilingualText } from "@/components/ui/bilingual-text"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { cn } from "@/lib/utils"

type VisitorSummary = {
  totalUsers: number
  userRank: number
}

const CONTACT_EMAIL = "laoliarthur@outlook.com"
const CONTACT_WECHAT = "bookspiano"

export function VisitorBanner() {
  const { t } = useBilingualText()
  const [summary, setSummary] = useState<VisitorSummary | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let active = true

    const loadSummary = async () => {
      try {
        setIsLoading(true)
        setHasError(false)
        const response = await fetch("/api/visitors/summary", { cache: "no-store" })

        if (!response.ok) {
          throw new Error("Failed to load visitor summary")
        }

        const data = (await response.json()) as VisitorSummary
        if (active) {
          setSummary(data)
        }
      } catch (error) {
        console.error("Failed to load visitor summary", error)
        if (active) {
          setHasError(true)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      active = false
    }
  }, [])

  if (hasError) {
    return null
  }

  const rankText = summary
    ? t("components.visitorBanner.rankTitle", { values: { rank: summary.userRank } })
    : t("components.visitorBanner.loading")

  if (isMinimized) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-2 shadow-[0_16px_35px_-30px_rgba(33,21,10,0.6)]">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-foreground-secondary">{rankText}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => setIsMinimized(false)}
          >
            <ChevronDown className="mr-1 h-4 w-4" />
            <BilingualText translationKey="components.visitorBanner.expand" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className="glass-effect p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">
              {rankText}
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              <BilingualText translationKey="components.visitorBanner.subtitle" />
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => setIsMinimized(true)}
          >
            <ChevronUp className="mr-1 h-4 w-4" />
            <BilingualText translationKey="components.visitorBanner.minimize" />
          </Button>
        </div>

        <div className="grid gap-3 text-sm text-foreground-secondary md:grid-cols-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span className={cn("font-medium", isLoading && "opacity-70")}>
              <BilingualText translationKey="components.visitorBanner.emailLabel" />
            </span>
            <span className="text-foreground">{CONTACT_EMAIL}</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className={cn("font-medium", isLoading && "opacity-70")}>
              <BilingualText translationKey="components.visitorBanner.wechatLabel" />
            </span>
            <span className="text-foreground">{CONTACT_WECHAT}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
