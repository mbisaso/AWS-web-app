import { useQuery } from '@tanstack/react-query'
import { fetchPerformanceReport, type ReportPeriod } from '../services/api'

export function usePerformanceReport(stationId: string, period: ReportPeriod | null) {
  return useQuery({
    queryKey: ['performance-report', stationId, period],
    queryFn: () => {
      if (!period) throw new Error('No reporting period selected')
      return fetchPerformanceReport(stationId, period)
    },
    enabled: !!stationId && !!period,
    staleTime: 5 * 60 * 1000,
  })
}
