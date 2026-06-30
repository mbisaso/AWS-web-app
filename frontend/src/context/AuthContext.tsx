import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { apiClient, setAuthToken, setLogoutHandler } from '../api/client'
import type { ApiEnvelope, LoginResult, UserRole } from '../types'

const STORAGE_KEY = 'auth'

interface AuthData {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  role: UserRole | null
}

const initial = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AuthData
  } catch { /* ignore */ }
  return { accessToken: null, refreshToken: null, username: null, role: null } as const
})()

if (initial.accessToken) setAuthToken(initial.accessToken)

function persist(data: AuthData) {
  if (data.accessToken) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

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
  const [accessToken, setAccessToken] = useState<string | null>(initial.accessToken)
  const [username, setUsername] = useState<string | null>(initial.username)
  const [role, setRole] = useState<UserRole | null>(initial.role)

  const logout = useCallback(() => {
    setAccessToken(null)
    setUsername(null)
    setRole(null)
    setAuthToken(null)
    persist({ accessToken: null, refreshToken: null, username: null, role: null })
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    setLogoutHandler(logout)
  }, [logout])

  async function login(usernameInput: string, password: string) {
    const response = await apiClient.post<ApiEnvelope<LoginResult>>('/api/login/', {
      username: usernameInput,
      password,
    })
    const { access, refresh, role: userRole, username: returnedUsername } = response.data.data
    setAccessToken(access)
    setUsername(returnedUsername)
    setRole(userRole)
    setAuthToken(access)
    persist({ accessToken: access, refreshToken: refresh, username: returnedUsername, role: userRole })
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
