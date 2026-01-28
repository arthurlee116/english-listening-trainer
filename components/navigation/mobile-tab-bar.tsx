"use client"

import { Sparkles, History, Book, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BilingualText } from "@/components/ui/bilingual-text"
import type { NavigationAction } from "@/lib/types"

export type MobileTabId = "practice" | "history" | "wrong-answers" | "assessment"

type MobileTab = {
  id: MobileTabId
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  action: NavigationAction
  activeSteps: string[]
}

const MOBILE_TABS: MobileTab[] = [
  {
    id: "practice",
    labelKey: "navigation.practice",
    icon: Sparkles,
    action: { type: "setState", targetState: "setup" },
    activeSteps: ["setup", "listening", "questions", "results"],
  },
  {
    id: "history",
    labelKey: "navigation.practiceHistory",
    icon: History,
    action: { type: "setState", targetState: "history" },
    activeSteps: ["history"],
  },
  {
    id: "wrong-answers",
    labelKey: "navigation.wrongAnswers",
    icon: Book,
    action: { type: "setState", targetState: "wrong-answers" },
    activeSteps: ["wrong-answers"],
  },
  {
    id: "assessment",
    labelKey: "navigation.assessment",
    icon: MessageSquare,
    action: { type: "setState", targetState: "assessment" },
    activeSteps: ["assessment", "assessment-result"],
  },
]

type MobileTabBarProps = {
  currentStep?: string
  onNavigate: (action: NavigationAction) => void
}

export function MobileTabBar({ currentStep, onNavigate }: MobileTabBarProps) {
  return (
    <nav
      className="mobile-tabbar md:hidden"
      aria-label="Mobile primary navigation"
    >
      <div className="grid grid-cols-4 gap-1">
        {MOBILE_TABS.map((tab) => {
          const isActive = tab.activeSteps.includes(currentStep ?? "")
          const Icon = tab.icon

          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className={`flex h-auto flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs transition-colors ${
                isActive
                  ? "bg-primary/15 text-foreground"
                  : "text-foreground-muted hover:bg-accent/60 hover:text-foreground"
              }`}
              onClick={() => onNavigate(tab.action)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[11px] leading-none">
                <BilingualText translationKey={tab.labelKey} />
              </span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
