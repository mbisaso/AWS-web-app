import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Station, AnalysisMetricKey, TaggedSensorReading, StatsResult } from '../types'
import { fetchBulkHistory } from '../api/stations'

const METRIC_KEYS: AnalysisMetricKey[] = [
  'temperature', 'humidity', 'pressure', 'wind_speed',
  'wind_direction', 'rain', 'solar_radiation', 'soil_moisture',
  'volt_solar', 'curr_solar', 'pv',
  'volt_batt', 'curr_batt', 'battery_temp',
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

  // STANDARD: compare averages of the two halves to avoid extreme volatility between first and last data points
  const percent_change = firstAvg !== 0
    ? parseFloat((((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100).toFixed(1))
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

export function useAnalysisData({ stationIds, allStations, hours }: UseAnalysisDataParams): UseAnalysisDataResult {
  const targetIds = stationIds.length > 0 
    ? stationIds 
    : allStations.map(s => s.station_id)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['analysis', targetIds, hours],
    queryFn: async () => {
      if (targetIds.length === 0) return []
      return fetchBulkHistory(targetIds, hours)
    },
    refetchInterval: 30000,
  })

  const parsed = useMemo(() => {
    if (!data || data.length === 0) return { readings: [], stats: {} }

    const merged: TaggedSensorReading[] = data.map(r => {
      const station = allStations.find(s => s.station_id === r.station_code)
      return {
        ...r,
        stationId: r.station_code,
        stationName: station?.name ?? r.station_code,
        pv: r.volt_solar != null && r.curr_solar != null 
          ? parseFloat((r.volt_solar * r.curr_solar).toFixed(2)) 
          : null
      }
    })

    const newStats: Record<string, StatsResult> = {}
    for (const sid of targetIds) {
      const sr = merged.filter((r) => r.stationId === sid)
      for (const mk of METRIC_KEYS) {
        const values = sr.map((r) => r[mk as keyof typeof r]).filter((v): v is number => v != null)
        if (values.length) {
          newStats[`${sid}:${mk}`] = computeStats(values)
        }
      }
    }

    return { readings: merged, stats: newStats }
  }, [data, targetIds, allStations])

  return { 
    readings: parsed.readings, 
    stats: parsed.stats, 
    isLoading, 
    error: error instanceof Error ? error.message : (error as string | null), 
    retry: () => { refetch() } 
  }
}
