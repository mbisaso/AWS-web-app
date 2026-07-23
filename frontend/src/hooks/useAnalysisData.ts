import { useCallback, useEffect, useRef, useState } from 'react'
import type { Station, SensorMetricKey, TaggedSensorReading, StatsResult } from '../types'
import { fetchSensorHistory } from '../api/stations'
import { getCachedData, setCachedData } from '../services/cache'

const METRIC_KEYS: SensorMetricKey[] = [
  'temperature', 'humidity', 'pressure', 'wind_speed',
  'wind_direction', 'rain', 'light', 'soil_moisture',
]

function computeStats(values: number[]): StatsResult {
  const count = values.length
  const average = values.reduce((a, b) => a + b, 0) / count
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance = values.reduce((sum, v) => sum + (v - average) ** 2, 0) / count
  const std_dev = Math.sqrt(variance)

  const half = Math.floor(count / 2)
  const firstAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(half, 1)
  const secondAvg = values.slice(half).reduce((a, b) => a + b, 0) / Math.max(count - half, 1)
  let trend: 'rising' | 'falling' | 'stable' = 'stable'
  if (firstAvg !== 0) {
    const pct = (secondAvg - firstAvg) / Math.abs(firstAvg)
    if (pct > 0.05) trend = 'rising'
    else if (pct < -0.05) trend = 'falling'
  }

  const firstValue = values[0]
  const lastValue = values[count - 1]
  const percent_change = firstValue !== 0
    ? parseFloat((((lastValue - firstValue) / Math.abs(firstValue)) * 100).toFixed(1))
    : null

  const MAX_SPARK = 20
  const sparkline = values.length <= MAX_SPARK
    ? [...values]
    : Array.from({ length: MAX_SPARK }, (_, i) => values[Math.floor((i / MAX_SPARK) * values.length)])

  return {
    average: parseFloat(average.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    std_dev: parseFloat(std_dev.toFixed(2)),
    count,
    trend,
    percent_change,
    sparkline,
  }
}

interface UseAnalysisDataParams {
  stationIds: string[]
  allStations: Station[]
  hours: number
}

interface UseAnalysisDataResult {
  readings: TaggedSensorReading[]
  stats: Record<string, StatsResult>
  isLoading: boolean
  error: string | null
  retry: () => void
}

interface AnalysisCache {
  readings: TaggedSensorReading[]
  stats: Record<string, StatsResult>
}

function analysisCacheKey(stationIds: string[], hours: number): string {
  return `analysis_${stationIds.slice().sort().join(',')}_${hours}`
}

export function useAnalysisData({ stationIds, allStations, hours }: UseAnalysisDataParams): UseAnalysisDataResult {
  const ack = analysisCacheKey(stationIds, hours)
  const cached = getCachedData<AnalysisCache>(ack)

  const [readings, setReadings] = useState<TaggedSensorReading[]>(cached?.readings ?? [])
  const [stats, setStats] = useState<Record<string, StatsResult>>(cached?.stats ?? {})
  const [isLoading, setIsLoading] = useState(!cached && stationIds.length > 0)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const paramsRef = useRef({ stationIds, allStations, hours })
  paramsRef.current = { stationIds, allStations, hours }

  const load = useCallback(async (signal: AbortSignal) => {
    const { stationIds, allStations, hours } = paramsRef.current
    const targets = stationIds.length
      ? allStations.filter((s) => stationIds.includes(s.station_id))
      : allStations

    if (!targets.length) {
      setReadings([])
      setStats({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const results = await Promise.all(
        targets.map((station) =>
          fetchSensorHistory(station.station_id, hours).then((rows) =>
            rows.map((r) => ({ ...r, stationId: station.station_id, stationName: station.name }))
          )
        )
      )

      if (signal.aborted) return

      const merged: TaggedSensorReading[] = results.flat()

      const newStats: Record<string, StatsResult> = {}
      for (const station of targets) {
        const sr = merged.filter((r) => r.stationId === station.station_id)
        for (const mk of METRIC_KEYS) {
          const values = sr.map((r) => r[mk]).filter((v): v is number => v !== null)
          if (values.length) {
            newStats[`${station.station_id}:${mk}`] = computeStats(values)
          }
        }
      }

      setReadings(merged)
      setStats(newStats)
      setCachedData(analysisCacheKey(stationIds, hours), { readings: merged, stats: newStats })
    } catch (err) {
      if (signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load analysis data')
    } finally {
      if (!signal.aborted) setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const idsKey = stationIds.join(',')
  const stationsKey = allStations.map((s) => s.station_id).join(',')

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    const interval = setInterval(() => load(controller.signal), 30_000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [load, idsKey, stationsKey, hours, retryCount])

  const retry = useCallback(() => setRetryCount((c) => c + 1), [])

  return { readings, stats, isLoading, error, retry }
}
