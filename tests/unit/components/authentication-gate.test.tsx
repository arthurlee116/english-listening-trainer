import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthenticationGate } from '@/components/home/authentication-gate'

vi.mock('@/components/auth-dialog', () => ({
  AuthDialog: ({ open }: { open: boolean }) => (
    <div data-testid="auth-dialog" data-open={open} />
  )
}))

vi.mock('@/components/auth/login-consent-dialog', () => ({
  LoginConsentDialog: ({ open }: { open: boolean }) => (
    <div data-testid="consent-dialog" data-open={open} />
  )
}))

vi.mock('@/components/ui/bilingual-text', () => ({
  BilingualText: ({ translationKey }: { translationKey: string }) => (
    <span>{translationKey}</span>
  )
}))

describe('AuthenticationGate', () => {
  it('renders loading state when mounting', () => {
    render(
      <AuthenticationGate
        isLoading={true}
        hasMounted={false}
        isAuthenticated={false}
        showAuthDialog={false}
        hasConsent={false}
        showConsentDialog={false}
        user={null}
        onUserAuthenticated={vi.fn()}
        onConsentAgreed={vi.fn()}
        onConsentRefused={vi.fn()}
      >
        <div>App</div>
      </AuthenticationGate>
    )

    expect(screen.getByText('messages.loadingApp')).toBeInTheDocument()
  })

  it('shows auth dialog for unauthenticated users', () => {
    render(
      <AuthenticationGate
        isLoading={false}
        hasMounted={true}
        isAuthenticated={false}
        showAuthDialog={true}
        hasConsent={false}
        showConsentDialog={false}
        user={null}
        onUserAuthenticated={vi.fn()}
        onConsentAgreed={vi.fn()}
        onConsentRefused={vi.fn()}
      >
        <div>App</div>
      </AuthenticationGate>
    )

    expect(screen.getByTestId('auth-dialog')).toBeInTheDocument()
  })

  it('shows consent dialog when authenticated without consent', () => {
    render(
      <AuthenticationGate
        isLoading={false}
        hasMounted={true}
        isAuthenticated={true}
        showAuthDialog={false}
        hasConsent={false}
        showConsentDialog={true}
        user={{ id: 'user-1', email: 'test@example.com' }}
        onUserAuthenticated={vi.fn()}
        onConsentAgreed={vi.fn()}
        onConsentRefused={vi.fn()}
      >
        <div>App</div>
      </AuthenticationGate>
    )

    expect(screen.getByTestId('consent-dialog')).toBeInTheDocument()
  })

  it('renders children when authenticated and consented', () => {
    render(
      <AuthenticationGate
        isLoading={false}
        hasMounted={true}
        isAuthenticated={true}
        showAuthDialog={false}
        hasConsent={true}
        showConsentDialog={false}
        user={{ id: 'user-1', email: 'test@example.com' }}
        onUserAuthenticated={vi.fn()}
        onConsentAgreed={vi.fn()}
        onConsentRefused={vi.fn()}
      >
        <div>App</div>
      </AuthenticationGate>
    )

    expect(screen.getByText('App')).toBeInTheDocument()
  })
})
