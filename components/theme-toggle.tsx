"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useBilingualText } from "@/hooks/use-bilingual-text"
import { useThemeClasses, combineThemeClasses } from "@/hooks/use-theme-classes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { t } = useBilingualText()
  const { glassClass, iconClass } = useThemeClasses()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={combineThemeClasses(glassClass(), "bg-transparent rounded-full")}
        disabled
      >
        <Sun className={combineThemeClasses("h-[1.2rem] w-[1.2rem]", iconClass('interactive'))} />
        <span className="sr-only">{t("buttons.themeToggle")}</span>
      </Button>
    )
  }

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={combineThemeClasses(glassClass(), "bg-transparent rounded-full")}
      title={t("buttons.themeToggle")}
    >
      <Sun className={combineThemeClasses(
        "h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0", 
        iconClass('interactive')
      )} />
      <Moon className={combineThemeClasses(
        "absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100", 
        iconClass('interactive')
      )} />
      <span className="sr-only">{t("buttons.themeToggle")}</span>
    </Button>
  )
} 