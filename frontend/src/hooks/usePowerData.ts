import { useCallback, useEffect, useRef, useState } from 'react'
import type { PowerChart } from '../types'
import { fetchPowerHistory } from '../api/stations'

export interface UsePowerDataResult {
  data: PowerChart[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function usePowerData(params: {
  stationId: string | null
  hours: number
}): UsePowerDataResult {
  const [data, setData] = useState<PowerChart[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    if (!paramsRef.current.stationId) {
      setData([])
      setIsLoading(false)
      setError(null)
      return
    }

    const abort = new AbortController()
    const p = paramsRef.current

    async function load() {
      try {
        const result = await fetchPowerHistory(p.stationId!, p.hours)
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
      } catch (err) {
        if (abort.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load power data')
      } finally {
        if (!abort.signal.aborted) setIsLoading(false)
      }
    }

    async function backgroundLoad() {
      try {
        const result = await fetchPowerHistory(paramsRef.current.stationId!, paramsRef.current.hours)
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
      } catch {
        /* silent */
      }
    }

    setIsLoading(true)
    setError(null)
    const startTimer = setTimeout(() => load(), 0)
    const interval = window.setInterval(() => backgroundLoad(), 30_000)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      abort.abort()
    }
  }, [params.stationId, params.hours, retryCount])

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setRetryCount((c) => c + 1)
  }, [])

  return { data, isLoading, error, retry }
}
