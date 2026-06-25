import { useCallback, useEffect, useRef, useState } from 'react'
import type { SensorReadingChart } from '../types'
import { fetchSensorHistory } from '../api/stations'

export interface UseWeatherDataResult {
  data: SensorReadingChart[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useWeatherData(params: {
  stationId: string
  hours: number
}): UseWeatherDataResult {
  const [data, setData] = useState<SensorReadingChart[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const abort = new AbortController()
    const p = paramsRef.current

    async function load() {
      try {
        const result = await fetchSensorHistory(p.stationId, p.hours)
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
      } catch (err) {
        if (abort.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load weather data')
      } finally {
        if (!abort.signal.aborted) setIsLoading(false)
      }
    }

    async function backgroundLoad() {
      try {
        const result = await fetchSensorHistory(paramsRef.current.stationId, paramsRef.current.hours)
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
