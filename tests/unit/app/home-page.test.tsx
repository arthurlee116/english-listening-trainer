import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockAuthState = {
  isAuthenticated: true,
  isLoading: false,
  showAuthDialog: false,
  hasConsent: true,
  showConsentDialog: false,
  user: { id: 'user-1', email: 'test@example.com' },
  handleUserAuthenticated: vi.fn(),
  handleConsentAgreed: vi.fn(),
  handleConsentRefused: vi.fn(),
}

vi.mock('@/hooks/use-auth-state', () => ({
  useAuthState: () => mockAuthState,
}))

vi.mock('@/components/home/authentication-gate', () => ({
  AuthenticationGate: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="auth-gate" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/main-app', () => ({
  MainApp: () => <div data-testid="main-app">MainApp</div>,
}))

import HomePage from '@/app/page'

describe('HomePage', () => {
  it('renders the main app inside authentication gate', () => {
    render(<HomePage />)

    const gate = screen.getByTestId('auth-gate')
    expect(gate).toBeInTheDocument()
    expect(screen.getByTestId('main-app')).toBeInTheDocument()
  })
})
