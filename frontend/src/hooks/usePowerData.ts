import { useQuery } from '@tanstack/react-query'
import type { PowerChart } from '../types'
import { fetchPowerHistory } from '../api/stations'

export interface UsePowerDataResult {
  data: PowerChart[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function usePowerData(params: {
  stationId: string | null
  hours?: number
  dateFrom?: string
  dateTo?: string
}): UsePowerDataResult {
  const query = useQuery({
    queryKey: ['power', params.stationId, params.dateFrom, params.dateTo, params.hours],
    queryFn: () => fetchPowerHistory(params.stationId!, params.hours, 5000, params.dateFrom, params.dateTo),
    enabled: !!params.stationId,
    refetchInterval: 30000,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    retry: query.refetch as () => void,
  }
}
