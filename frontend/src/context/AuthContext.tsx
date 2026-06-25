import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiClient, setAuthToken } from '../api/client'
import type { ApiEnvelope, LoginResult, UserRole } from '../types'

const STORAGE_KEY = 'auth'

const initial = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as { accessToken: string | null; username: string | null; role: UserRole | null }
  } catch { /* ignore */ }
  return { accessToken: null, username: null, role: null } as const
})()

if (initial.accessToken) setAuthToken(initial.accessToken)

function persist(accessToken: string | null, username: string | null, role: UserRole | null) {
  if (accessToken) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, username, role }))
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
    persist(access, returnedUsername, userRole)
  }

  function logout() {
    setAccessToken(null)
    setUsername(null)
    setRole(null)
    setAuthToken(null)
    persist(null, null, null)
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
