import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ErrorBoundary } from '@/components/error-boundary'
import '../lib/kokoro-init'

export const metadata: Metadata = {
  title: 'English Listening Trainer',
  description: 'AI-powered listening practice for K12 students',
  generator: 'Arthur',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
