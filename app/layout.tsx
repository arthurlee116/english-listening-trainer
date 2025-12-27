import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { SidebarProvider } from '@/components/navigation/sidebar-context'
import React from 'react'

export const metadata: Metadata = {
  title: 'English Listening Trainer 英语听力训练器',
  description: 'Make learning fun with bite-sized AI listening practice | 轻松练听力，让 AI 帮你进步更有趣',
  generator: 'Arthur',
}

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement => {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <SidebarProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </SidebarProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

RootLayout.displayName = 'RootLayout'

export default RootLayout
