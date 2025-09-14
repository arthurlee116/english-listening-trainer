"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { BilingualText } from "@/components/ui/bilingual-text"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BilingualLoadingProps {
  titleKey?: string
  title?: string
  descriptionKey?: string
  description?: string
  size?: "sm" | "md" | "lg"
  variant?: "card" | "inline" | "overlay"
  className?: string
}

export function BilingualLoading({
  titleKey,
  title,
  descriptionKey,
  description,
  size = "md",
  variant = "inline",
  className
}: BilingualLoadingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  }

  const LoadingContent = () => (
    <div className={cn("text-center", className)}>
      <Loader2 className={cn("animate-spin mx-auto mb-4 text-blue-600", sizeClasses[size])} />
      {(titleKey || title) && (
        <h2 className={cn(
          "font-semibold mb-2",
          size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg"
        )}>
          {titleKey ? (
            <BilingualText translationKey={titleKey} />
          ) : (
            title
          )}
        </h2>
      )}
      {(descriptionKey || description) && (
        <p className={cn(
          "text-gray-600 dark:text-gray-300",
          size === "sm" ? "text-xs" : "text-sm"
        )}>
          {descriptionKey ? (
            <BilingualText translationKey={descriptionKey} />
          ) : (
            description
          )}
        </p>
      )}
    </div>
  )

  if (variant === "card") {
    return (
      <Card className="p-8">
        <LoadingContent />
      </Card>
    )
  }

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <Card className="p-8">
          <LoadingContent />
        </Card>
      </div>
    )
  }

  return <LoadingContent />
}