import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiClient, setAuthToken } from '../api/client'
import type { ApiEnvelope, LoginResult, UserRole } from '../types'

interface AuthContextValue {
  accessToken: string | null
  username: string | null
  role: UserRole | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)

  async function login(usernameInput: string, password: string) {
    const response = await apiClient.post<ApiEnvelope<LoginResult>>('/api/login/', {
      username: usernameInput,
      password,
    })
    const { access, role: userRole, username: returnedUsername } = response.data.data
    setAccessToken(access)
    setUsername(returnedUsername)
    setRole(userRole)
    setAuthToken(access)
  }

  function logout() {
    setAccessToken(null)
    setUsername(null)
    setRole(null)
    setAuthToken(null)
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, username, role, isAuthenticated: !!accessToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
