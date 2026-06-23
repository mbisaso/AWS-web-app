import { apiClient } from './client'
import type { ApiEnvelope, Station } from '../types'

export async function fetchStations(): Promise<Station[]> {
  const res = await apiClient.get<ApiEnvelope<Station[]>>('/api/stations/')
  return res.data.data
}