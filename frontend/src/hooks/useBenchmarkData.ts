import { useQuery } from '@tanstack/react-query'
import type { BenchmarkData, SensorMetricKey } from '../types'
import { fetchBenchmark } from '../api/stations'

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
  const query = useQuery({
    queryKey: ['benchmark', params.stationId, params.hours, params.metric],
    queryFn: () => fetchBenchmark(params.stationId!, params.hours, params.metric),
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
