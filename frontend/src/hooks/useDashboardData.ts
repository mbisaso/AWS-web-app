import { useCallback, useEffect, useRef, useState } from 'react'
import { type DashboardData, fetchDashboardData } from '../services/api'
import { getCachedData, setCachedData } from '../services/cache'

const CACHE_KEY = 'dashboard'

export interface UseDashboardDataResult {
  data: DashboardData | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useDashboardData(): UseDashboardDataResult {
  const cached = getCachedData<DashboardData>(CACHE_KEY)

  const [data, setData] = useState<DashboardData | null>(cached)
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const hasDataRef = useRef(!!cached)

  useEffect(() => {
    const abort = new AbortController()

    async function initialFetch() {
      try {
        const result = await fetchDashboardData()
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        hasDataRef.current = true
        setCachedData(CACHE_KEY, result)
      } catch (err) {
        if (abort.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        if (!abort.signal.aborted) setIsLoading(false)
      }
    }

    async function backgroundFetch() {
      try {
        const result = await fetchDashboardData()
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        hasDataRef.current = true
        setCachedData(CACHE_KEY, result)
      } catch { /* silent */ }
    }

    if (!cached) {
      setIsLoading(true)
      setError(null)
    }
    const startTimer = setTimeout(() => initialFetch(), 0)
    const interval = window.setInterval(() => backgroundFetch(), 30_000)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      abort.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount])

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setRetryCount((c) => c + 1)
  }, [])

  return { data, isLoading, error, retry }
}
