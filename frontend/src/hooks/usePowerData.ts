import { useCallback, useEffect, useRef, useState } from 'react'
import type { PowerMetricType, PowerDataResponse } from '../services/api'
import { fetchPowerData } from '../services/api'

export interface UsePowerDataResult {
  data: PowerDataResponse | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function usePowerData(params: {
  stationId: number | null
  metric: PowerMetricType
  dateFrom: string
  dateTo: string
}): UsePowerDataResult {
  const [data, setData] = useState<PowerDataResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const hasDataRef = useRef(false)
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const abort = new AbortController()
    const p = paramsRef.current

    async function load() {
      try {
        const result = await fetchPowerData(p)
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        hasDataRef.current = true
      } catch (err) {
        if (abort.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load power data')
      } finally {
        if (!abort.signal.aborted) setIsLoading(false)
      }
    }

    async function backgroundLoad() {
      try {
        const result = await fetchPowerData(paramsRef.current)
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

    const interval = window.setInterval(() => backgroundLoad(), 30_000)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      abort.abort()
    }
  }, [params.stationId, params.metric, params.dateFrom, params.dateTo, retryCount])

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setRetryCount((c) => c + 1)
  }, [])

  return { data, isLoading, error, retry }
}
