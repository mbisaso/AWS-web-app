import { apiClient } from './client'
import type { ApiEnvelope, BenchmarkData, PowerChart, SensorReadingChart, Station } from '../types'

export async function fetchStations(): Promise<Station[]> {
  const res = await apiClient.get<ApiEnvelope<Station[]>>('/api/stations/')
  return res.data.data
}

interface PowerHistoryData {
  station_id: string
  hours: number
  count: number
  readings: PowerChart[]
}

export async function fetchPowerHistory(
  stationId: string,
  hours: number,
  limit = 200,
): Promise<PowerChart[]> {
  const res = await apiClient.get<ApiEnvelope<PowerHistoryData>>(
    `/api/stations/${stationId}/history/`,
    { params: { type: 'power', hours, limit } },
  )
  return res.data.data.readings
}

interface SensorHistoryData {
  station_id: string
  hours: number
  count: number
  readings: SensorReadingChart[]
}

export async function fetchSensorHistory(
  stationId: string,
  hours: number,
  limit = 200,
): Promise<SensorReadingChart[]> {
  const res = await apiClient.get<ApiEnvelope<SensorHistoryData>>(
    `/api/stations/${stationId}/history/`,
    { params: { type: 'sensor', hours, limit } },
  )
  return res.data.data.readings
}

export async function fetchBenchmark(
  stationId: string,
  hours: number,
  metric: string,
  source?: string,
): Promise<BenchmarkData> {
  const params: Record<string, string | number> = { station_id: stationId, hours, metric }
  if (source) params.source = source
  const res = await apiClient.get<ApiEnvelope<BenchmarkData>>('/api/benchmark/', { params })
  return res.data.data
}
