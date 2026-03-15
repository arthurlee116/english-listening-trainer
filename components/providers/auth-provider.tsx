"use client"

import { createContext, useContext, type ReactNode } from "react"

import { useAuthState, type AuthState } from "@/hooks/use-auth-state"

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuthState()

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
}

AuthProvider.displayName = "AuthProvider"

export function useAuth(): AuthState {
  const authState = useContext(AuthContext)

  if (!authState) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return authState
}
