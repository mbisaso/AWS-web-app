import { useQuery } from '@tanstack/react-query'
import { type DashboardData, fetchDashboardData } from '../services/api'

export interface UseDashboardDataResult {
  data: DashboardData | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useDashboardData(): UseDashboardDataResult {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    refetchInterval: 30000,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    retry: query.refetch as () => void,
  }
}
