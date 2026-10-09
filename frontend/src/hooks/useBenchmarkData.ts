import { useQuery } from '@tanstack/react-query'
import type { BenchmarkData, SensorMetricKey } from '../types'
import { fetchBenchmark } from '../api/stations'

export interface UseBenchmarkDataParams {
  stationId: string | null
  metric: SensorMetricKey
  datasetId?: number | string | null
  location?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  hours?: number
}

export interface UseBenchmarkDataResult {
  data: BenchmarkData | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useBenchmarkData(params: UseBenchmarkDataParams): UseBenchmarkDataResult {
  const query = useQuery({
    queryKey: ['benchmark', params.stationId, params.metric, params.datasetId, params.location, params.dateFrom, params.dateTo, params.hours],
    queryFn: () =>
      fetchBenchmark({
        stationId: params.stationId!,
        metric: params.metric,
        datasetId: params.datasetId,
        location: params.location,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        hours: params.hours,
      }),
    enabled: !!params.stationId,
    refetchInterval: 30000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    retry: query.refetch as () => void,
  }
}
