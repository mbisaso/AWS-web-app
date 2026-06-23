import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiClient } from '../api/client'

interface AuthContextValue {
  accessToken: string | null
  username: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  async function login(usernameInput: string, password: string) {
    const response = await apiClient.post('/api/token/', {
      username: usernameInput,
      password,
    })
    setAccessToken(response.data.access)
    setUsername(usernameInput)
    // TODO: no /api/me/ or profile endpoint exists yet to fetch role.
    // Sidebar currently shows a hardcoded "Admin" label — revisit once
    // accounts app exposes the logged-in user's role.
  }

  function logout() {
    setAccessToken(null)
    setUsername(null)
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, username, isAuthenticated: !!accessToken, login, logout }}
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