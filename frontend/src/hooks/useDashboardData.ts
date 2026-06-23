import { useCallback, useEffect, useRef, useState } from 'react'
import { type DashboardData, fetchDashboardData } from '../services/api'

export interface UseDashboardDataResult {
  data: DashboardData | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const hasDataRef = useRef(false)

  useEffect(() => {
    const abort = new AbortController()

    async function initialFetch() {
      try {
        const result = await fetchDashboardData()
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        hasDataRef.current = true
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
      } catch {
        /* background poll errors are silent — keep existing data visible */
      }
    }

    /* Defer to avoid cascading-render lint on effect-initial setState */
    const startTimer = setTimeout(() => initialFetch(), 0)

    const interval = window.setInterval(() => backgroundFetch(), 30_000)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      abort.abort()
    }
  }, [retryCount])

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setRetryCount((c) => c + 1)
  }, [])

  return { data, isLoading, error, retry }
}
