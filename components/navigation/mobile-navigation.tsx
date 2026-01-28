"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileTabBar } from "@/components/navigation/mobile-tab-bar"
import { MobileDrawer } from "@/components/navigation/mobile-drawer"
import { useSidebar } from "@/components/navigation/sidebar-context"
import type { NavigationAction } from "@/lib/types"

interface MobileNavigationProps {
  currentStep?: string
  onNavigate: (action: NavigationAction) => void
  isAuthenticated: boolean
  isAdmin: boolean
  userLabel?: string
}

export function MobileNavigation({
  currentStep,
  onNavigate,
  isAuthenticated,
  isAdmin,
  userLabel,
}: MobileNavigationProps) {
  const { mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      <div className="mobile-fab md:hidden">
        <Button
          variant="outline"
          size="icon"
          className="mobile-fab-button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <MobileDrawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        onNavigate={onNavigate}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        userLabel={userLabel}
      />

      <MobileTabBar currentStep={currentStep} onNavigate={onNavigate} />
    </>
  )
}
