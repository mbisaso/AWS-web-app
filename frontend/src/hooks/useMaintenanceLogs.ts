import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMaintenanceLog,
  deleteMaintenanceLog,
  fetchMaintenanceLogs,
  updateMaintenanceLog,
  type MaintenanceLogInput,
} from '../services/api'

export function useMaintenanceLogs(stationId: string, start?: string, end?: string) {
  return useQuery({
    queryKey: ['maintenance-logs', stationId, start, end],
    queryFn: () => fetchMaintenanceLogs({ stationId, start, end }),
    enabled: !!stationId,
  })
}

// Maintenance entries appear in performance reports, so changes refresh both.
export function useMaintenanceLogMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance-logs'] })
    queryClient.invalidateQueries({ queryKey: ['performance-report'] })
  }

  return {
    create: useMutation({
      mutationFn: (data: MaintenanceLogInput) => createMaintenanceLog(data),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<MaintenanceLogInput> }) =>
        updateMaintenanceLog(id, data),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => deleteMaintenanceLog(id),
      onSuccess,
    }),
  }
}
