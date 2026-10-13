import { useQuery } from '@tanstack/react-query'
import { fetchPerformanceReport } from '../services/api'

export function usePerformanceReport(stationId: string, days: number) {
  return useQuery({
    queryKey: ['performance-report', stationId, days],
    queryFn: () => fetchPerformanceReport(stationId, days),
    enabled: !!stationId,
    staleTime: 5 * 60 * 1000,
  })
}
