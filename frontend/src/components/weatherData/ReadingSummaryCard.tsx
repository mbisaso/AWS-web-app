import type { SensorMetricKey } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'

interface ReadingSummaryCardProps {
  metricKey: SensorMetricKey
  value: number | null | undefined
  isLoading?: boolean
}

export function ReadingSummaryCard({ metricKey, value, isLoading }: ReadingSummaryCardProps) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-3 h-3 w-16 rounded-full bg-slate-200" />
        <div className="mb-2 h-8 w-20 rounded-lg bg-slate-200" />
        <div className="h-3 w-24 rounded-full bg-slate-100" />
      </div>
    )
  }

  if (value == null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">{cfg.label}</p>
        <p className="mt-2 text-2xl font-bold text-storm/30 font-display">—</p>
        <p className="mt-1 text-xs text-storm/30">No data</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <span
        className="absolute top-0 left-0 h-1 w-full rounded-t-2xl"
        style={{ backgroundColor: cfg.color }}
        aria-hidden="true"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">{cfg.label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
        {value}
        <span className="ml-0.5 text-sm font-medium text-storm/50">{cfg.unit}</span>
      </p>
    </div>
  )
}
