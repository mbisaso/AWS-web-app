import axios from 'axios'

export const API_BASE_URL = 'http://127.0.0.1:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

const AUTH_STORAGE_KEY = 'auth'
let onLogout: (() => void) | null = null

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete apiClient.defaults.headers.common['Authorization']
  }
}

export function setLogoutHandler(handler: () => void) {
  onLogout = handler
}

function getRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return data.refreshToken ?? null
    }
  } catch { /* ignore */ }
  return null
}

function setAccessToken(token: string) {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      data.accessToken = token
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
    }
  } catch { /* ignore */ }
}

function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const refreshToken = getRefreshToken()

    if (!refreshToken) {
      clearAuth()
      onLogout?.()
      return Promise.reject(error)
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
        refresh: refreshToken,
      })
      const newAccess = res.data.access
      setAccessToken(newAccess)
      setAuthToken(newAccess)
      originalRequest.headers['Authorization'] = `Bearer ${newAccess}`
      return apiClient(originalRequest)
    } catch {
      clearAuth()
      onLogout?.()
      return Promise.reject(error)
    }
  },
)
