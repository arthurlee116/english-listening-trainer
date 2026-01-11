import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import { SidebarProvider } from '@/components/navigation/sidebar-context'
import React from 'react'

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

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
    <html
      lang="en"
      className={`light ${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased">
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
