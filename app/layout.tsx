import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import '../lib/kokoro-init'
import React from 'react'

export const metadata: Metadata = {
  title: 'English Listening Trainer',
  description: 'AI-powered listening practice for K12 students',
  generator: 'Arthur',
}

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.ReactElement => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}

RootLayout.displayName = 'RootLayout'

export default RootLayout
