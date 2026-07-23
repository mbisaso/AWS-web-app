import { useCallback, useEffect, useRef, useState } from 'react'
import type { BenchmarkData, SensorMetricKey } from '../types'
import { fetchBenchmark } from '../api/stations'
import { getCachedData, setCachedData } from '../services/cache'

function cacheKey(params: { stationId: string; hours: number; metric: SensorMetricKey }): string {
  return `benchmark_${params.stationId}_${params.hours}_${params.metric}`
}

export interface UseBenchmarkDataParams {
  stationId: string | null
  hours: number
  metric: SensorMetricKey
}

export interface UseBenchmarkDataResult {
  data: BenchmarkData | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useBenchmarkData(params: UseBenchmarkDataParams): UseBenchmarkDataResult {
  const { stationId, hours, metric } = params
  const ck = stationId ? cacheKey({ stationId, hours, metric }) : null
  const cached = ck ? getCachedData<BenchmarkData>(ck) : null

  const [data, setData] = useState<BenchmarkData | null>(cached ?? null)
  const [isLoading, setIsLoading] = useState(!!stationId && !cached)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    if (!stationId) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    const abort = new AbortController()
    const p = paramsRef.current

    async function load() {
      try {
        const result = await fetchBenchmark(p.stationId as string, p.hours, p.metric)
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        if (ck) setCachedData(ck, result)
      } catch (err) {
        if (abort.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load benchmark data')
      } finally {
        if (!abort.signal.aborted) setIsLoading(false)
      }
    }

    async function backgroundLoad() {
      const cur = paramsRef.current
      if (!cur.stationId) return
      try {
        const result = await fetchBenchmark(cur.stationId, cur.hours, cur.metric)
        if (abort.signal.aborted) return
        setData(result)
        setError(null)
        setCachedData(cacheKey({ stationId: cur.stationId, hours: cur.hours, metric: cur.metric }), result)
      } catch { /* silent */ }
    }

    if (!cached) {
      setIsLoading(true)
      setError(null)
    }
    const startTimer = setTimeout(() => load(), 0)
    const interval = window.setInterval(() => backgroundLoad(), 30_000)

    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      abort.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, hours, metric, retryCount])

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setRetryCount((c) => c + 1)
  }, [])

  return { data, isLoading, error, retry }
}
