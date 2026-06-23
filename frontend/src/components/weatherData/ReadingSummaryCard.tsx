import type { CurrentSensorReading, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

interface ReadingSummaryCardProps {
  sensorType: SensorType
  reading: CurrentSensorReading | null | undefined
  isLoading?: boolean
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Trending up">
        <path d="M2 10l4-4 3 3 4-5" />
        <path d="M10 4h3v3" />
      </svg>
    )
  }
  if (trend === 'down') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Trending down">
        <path d="M2 4l4 4 3-3 4 5" />
        <path d="M10 10h3V7" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" aria-label="Stable">
      <path d="M2 7h10" />
    </svg>
  )
}

export function ReadingSummaryCard({
  sensorType,
  reading,
  isLoading,
}: ReadingSummaryCardProps) {
  const cfg = SENSOR_CONFIG[sensorType]

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-3 h-3 w-16 rounded-full bg-slate-200" />
        <div className="mb-2 h-8 w-20 rounded-lg bg-slate-200" />
        <div className="h-3 w-24 rounded-full bg-slate-100" />
      </div>
    )
  }

  if (!reading) {
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
      {/* Color accent bar */}
      <span
        className="absolute top-0 left-0 h-1 w-full rounded-t-2xl"
        style={{ backgroundColor: cfg.color }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">{cfg.label}</p>
        <TrendArrow trend={reading.trend} />
      </div>

      <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
        {reading.value}
        <span className="ml-0.5 text-sm font-medium text-storm/50">{reading.unit}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(reading.is_stale || reading.is_out_of_range) && (
          <>
            {reading.is_stale && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Stale
              </span>
            )}
            {reading.is_out_of_range && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                Out of range
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
