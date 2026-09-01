import { useQuery } from '@tanstack/react-query'
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
  hours?: number
  dateFrom?: string
  dateTo?: string
}): UseWeatherDataResult {
  const query = useQuery({
    queryKey: ['weather', params.stationId, params.dateFrom, params.dateTo, params.hours],
    queryFn: () => fetchSensorHistory(params.stationId, params.hours, 5000, params.dateFrom, params.dateTo),
    refetchInterval: 30000,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    retry: query.refetch as () => void,
  }
}
