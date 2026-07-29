import { useQuery } from '@tanstack/react-query'
import { fetchStationDetail } from '../api/stations'

export function useStationDetail(stationId: string | undefined) {
  return useQuery({
    queryKey: ['station-detail', stationId],
    queryFn: () => fetchStationDetail(stationId!),
    enabled: !!stationId,
    refetchInterval: 30_000,
  })
}
