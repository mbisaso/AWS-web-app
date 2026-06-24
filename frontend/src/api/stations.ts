import { apiClient } from './client'
import type { ApiEnvelope, PowerChart, Station } from '../types'

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
