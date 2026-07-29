import { useQuery } from '@tanstack/react-query'
import { exportDataJson, getExportCsvUrl } from '../services/api'
import type { ExportConfig } from '../services/api'

export function useExportDataPreview(config: ExportConfig) {
  return useQuery({
    queryKey: ['export-preview', config],
    queryFn: () => exportDataJson(config),
    staleTime: 60000,
  })
}

export function useExportCsvUrl(config: ExportConfig) {
  return getExportCsvUrl(config)
}
