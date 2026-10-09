import { apiClient } from './client'
import type { ApiEnvelope, BenchmarkData, BenchmarkDataset, PowerChart, SensorReadingChart, Station, StationDetailResponse } from '../types'

export async function fetchStations(): Promise<Station[]> {
  const res = await apiClient.get<ApiEnvelope<Station[]>>('/api/stations/')
  return res.data.data
}

export async function fetchStationDetail(id: string | number): Promise<StationDetailResponse> {
  const res = await apiClient.get<ApiEnvelope<StationDetailResponse>>(`/api/stations/${id}/`)
  return res.data.data
}

export async function createStation(data: Partial<Station>): Promise<Station> {
  const res = await apiClient.post<ApiEnvelope<Station>>('/api/stations/', data)
  return res.data.data
}

export async function updateStation(id: number | string, data: Partial<Station>): Promise<Station> {
  const res = await apiClient.put<ApiEnvelope<Station>>(`/api/stations/${id}/`, data)
  return res.data.data
}

export async function deleteStation(id: number | string): Promise<void> {
  await apiClient.delete(`/api/stations/${id}/`)
}

interface PowerHistoryData {
  station_id: string
  hours: number
  count: number
  readings: PowerChart[]
}

function computePowerReadings<T extends PowerChart>(readings: T[]): T[] {
  return readings.map((r) => ({
    ...r,
    power_solar:
      r.curr_solar != null && r.volt_solar != null
        ? Math.round(r.curr_solar * r.volt_solar * 100) / 100
        : null,
    power_batt:
      r.curr_batt != null && r.volt_batt != null
        ? Math.round(r.curr_batt * r.volt_batt * 100) / 100
        : null,
  }))
}

export async function fetchPowerHistory(
  stationId: string,
  hours?: number,
  limit = 5000,
  dateFrom?: string,
  dateTo?: string,
): Promise<PowerChart[]> {
  const params: Record<string, string | number> = { type: 'power', limit }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  if (hours && !dateFrom) params.hours = hours

  const res = await apiClient.get<ApiEnvelope<PowerHistoryData>>(
    `/api/stations/${stationId}/history/`,
    { params },
  )
  return computePowerReadings(res.data.data.readings)
}

interface SensorHistoryData {
  station_id: string
  hours: number
  count: number
  readings: SensorReadingChart[]
}

export async function fetchSensorHistory(
  stationId: string,
  hours?: number,
  limit = 5000,
  dateFrom?: string,
  dateTo?: string,
): Promise<SensorReadingChart[]> {
  const params: Record<string, string | number> = { type: 'sensor', limit }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  if (hours && !dateFrom) params.hours = hours

  const res = await apiClient.get<ApiEnvelope<SensorHistoryData>>(
    `/api/stations/${stationId}/history/`,
    { params },
  )
  return res.data.data.readings
}

export interface BulkHistoryData {
  hours: number
  count: number
  readings: (SensorReadingChart & PowerChart & { station_code: string })[]
}

export async function fetchBulkHistory(
  stationIds: string[],
  hours: number,
  limit = 5000,
): Promise<BulkHistoryData['readings']> {
  const res = await apiClient.get<ApiEnvelope<BulkHistoryData>>(
    `/api/stations/bulk-history/`,
    { params: { station_ids: stationIds.join(','), hours, limit } },
  )
  return computePowerReadings(res.data.data.readings)
}

export async function fetchBenchmarkDatasets(): Promise<BenchmarkDataset[]> {
  const res = await apiClient.get<ApiEnvelope<BenchmarkDataset[]>>('/api/benchmark/datasets/')
  return res.data.data
}

export interface FetchBenchmarkParams {
  stationId: string
  metric: string
  hours?: number
  datasetId?: number | string | null
  location?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  source?: string | null
}

export async function fetchBenchmark(params: FetchBenchmarkParams): Promise<BenchmarkData> {
  const query: Record<string, string | number> = {
    station_id: params.stationId,
    metric: params.metric,
  }
  if (params.hours) query.hours = params.hours
  if (params.datasetId) query.dataset_id = params.datasetId
  if (params.location) query.location = params.location
  if (params.dateFrom) query.date_from = params.dateFrom
  if (params.dateTo) query.date_to = params.dateTo
  if (params.source) query.source = params.source

  const res = await apiClient.get<ApiEnvelope<BenchmarkData>>('/api/benchmark/', { params: query })
  return res.data.data
}

export async function importBenchmarkCSV(
  file: File,
  location: string,
  source = 'UNMA',
  name?: string,
): Promise<{ dataset: BenchmarkDataset; imported: number; skipped: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('location', location)
  formData.append('source', source)
  if (name) formData.append('name', name)
  const res = await apiClient.post<ApiEnvelope<{ dataset: BenchmarkDataset; imported: number; skipped: number }>>(
    '/api/benchmark/import/',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data.data
}

export async function deleteBenchmarkDataset(datasetId: number): Promise<void> {
  await apiClient.delete(`/api/benchmark/datasets/${datasetId}/`)
}
