import { vi } from "vitest"

import type { AuthState, AuthUserInfo } from "@/hooks/use-auth-state"

const defaultUser: AuthUserInfo = {
  id: "test-user",
  email: "test@example.com",
  name: "Test User",
  isAdmin: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
}

export function createMockAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: overrides.user ?? defaultUser,
  isAuthenticated: overrides.isAuthenticated ?? true,
  isLoading: overrides.isLoading ?? false,
  showAuthDialog: overrides.showAuthDialog ?? false,
  authRefreshing: overrides.authRefreshing ?? false,
  cacheStale: overrides.cacheStale ?? false,
  handleUserAuthenticated:
    overrides.handleUserAuthenticated ??
    vi.fn<(userData: AuthUserInfo, token: string) => void>(),
  handleLogout:
    overrides.handleLogout ??
    vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  checkAuthStatus:
    overrides.checkAuthStatus ??
    vi.fn<(options?: { initial?: boolean }) => Promise<void>>(async () => {}),
}
}
