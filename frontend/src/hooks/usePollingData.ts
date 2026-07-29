import { useQuery } from '@tanstack/react-query'
import React from 'react'

export interface UsePollingDataResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function usePollingData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  intervalMs = 30_000,
  cacheKey?: string,
): UsePollingDataResult<T> {
  const query = useQuery({
    queryKey: cacheKey ? [cacheKey, ...deps] : ['pollingData', ...deps],
    queryFn: fetcher,
    refetchInterval: intervalMs,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    retry: query.refetch as () => void,
  }
}
