import { useCallback, useEffect, useRef, useState } from 'react'

export interface UsePollingDataResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function usePollingData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  intervalMs = 30_000,
): UsePollingDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const hasDataRef = useRef(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    const abort = new AbortController()

    async function load() {
      try {
        const result = await fetcherRef.current()
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        hasDataRef.current = true
      } catch (err) {
        if (abort.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        if (!abort.signal.aborted) setIsLoading(false)
      }
    }

    async function backgroundLoad() {
      try {
        const result = await fetcherRef.current()
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        hasDataRef.current = true
      } catch {
        /* silent */
      }
    }

    setIsLoading(true)
    setError(null)
    const startTimer = setTimeout(() => load(), 0)
    const interval = window.setInterval(() => backgroundLoad(), intervalMs)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      abort.abort()
    }
  }, deps.concat(retryCount, intervalMs)) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setRetryCount((c) => c + 1)
  }, [])

  return { data, isLoading, error, retry }
}
