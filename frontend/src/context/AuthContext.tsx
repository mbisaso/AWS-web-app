import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import axios from 'axios'
import { apiClient, setAuthToken, API_BASE_URL, setLogoutHandler } from '../api/client'
import type { ApiEnvelope, LoginResult, UserRole } from '../types'

const STORAGE_KEY = 'auth'

interface AuthContextValue {
  accessToken: string | null
  username: string | null
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const initial = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as { refreshToken: string | null; username: string | null; role: UserRole | null }
  } catch { /* ignore */ }
  return { refreshToken: null, username: null, role: null } as const
})()

function persist(refreshToken: string | null, username: string | null, role: UserRole | null) {
  if (refreshToken) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ refreshToken, username, role }))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(initial.username)
  const [role, setRole] = useState<UserRole | null>(initial.role)
  const [isLoading, setIsLoading] = useState<boolean>(!!initial.refreshToken)

  const logout = useCallback(async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const auth = JSON.parse(raw)
        if (auth.refreshToken) {
          await apiClient.post('/api/logout/', { refresh: auth.refreshToken })
        }
      }
    } catch (e) {
      console.error('Logout error blacklisting token:', e)
    } finally {
      setAccessToken(null)
      setUsername(null)
      setRole(null)
      setAuthToken(null)
      persist(null, null, null)
    }
  }, [])

  useEffect(() => {
    setLogoutHandler(logout)
  }, [logout])

  useEffect(() => {
    async function initAuth() {
      if (initial.refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
            refresh: initial.refreshToken,
          })
          const newAccessToken = response.data.access
          setAccessToken(newAccessToken)
          setAuthToken(newAccessToken)
        } catch (err) {
          console.error('Initial silent auth refresh failed:', err)
          await logout()
        }
      }
      setIsLoading(false)
    }
    initAuth()
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
    persist(refresh, returnedUsername, userRole)
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        username,
        role,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        logout,
      }}
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
