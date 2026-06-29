import axios from 'axios'

export const API_BASE_URL = 'http://127.0.0.1:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

let _accessToken: string | null = null

export function setAuthToken(token: string | null) {
  _accessToken = token
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete apiClient.defaults.headers.common['Authorization']
  }
}

// Request interceptor to attach the in-memory access token dynamically
apiClient.interceptors.request.use(
  (config) => {
    if (_accessToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${_accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Response interceptor to catch 401s and refresh the token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If it's a 401 and we haven't retried yet, and it's not a login/refresh request
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/api/login/' &&
      originalRequest.url !== '/api/token/refresh/' &&
      originalRequest.url !== '/api/register/' &&
      originalRequest.url !== '/api/logout/'
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const rawAuth = localStorage.getItem('auth')
        if (!rawAuth) throw new Error('No refresh token found')

        const auth = JSON.parse(rawAuth)
        const refreshToken = auth.refreshToken
        if (!refreshToken) throw new Error('No refresh token found in storage')

        // Fetch new access token using raw axios to avoid interceptor recursion
        const refreshResponse = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
          refresh: refreshToken,
        })

        const newAccessToken = refreshResponse.data.access
        
        // Update memory and headers
        setAuthToken(newAccessToken)
        
        processQueue(null, newAccessToken)
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        // Clear auth and redirect to login
        localStorage.removeItem('auth')
        setAuthToken(null)
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)