import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface ProgressCardProps {
  title: string
  value: string
  subtitle?: string
  icon: ReactNode
  className?: string
}

export function ProgressCard({ title, value, subtitle, icon, className }: ProgressCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <div className="ml-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
