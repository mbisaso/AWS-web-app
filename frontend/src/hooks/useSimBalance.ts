import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordSimBalance, updateSimAccount } from '../services/api'

export function useRecordSimBalance(simId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ remainingMb, checkedAt }: { remainingMb: number; checkedAt?: string }) =>
      recordSimBalance(simId, remainingMb, checkedAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sim-management'] }),
  })
}

/** Changing the load date restarts usage counting from that date. */
export function useUpdateSimLoadDate(simId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dateLoaded: string) => updateSimAccount(simId, { date_loaded: dateLoaded }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sim-management'] }),
  })
}
