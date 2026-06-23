import { useMemo } from 'react'
import type { PowerMetricType, PowerReading } from '../../services/api'
import { POWER_METRIC_CONFIG } from '../../services/api'

const BAR_COLORS: Record<string, string> = {
  battery_level: '#22C55E',
  voltage: '#0EA5E9',
  current_draw: '#F97316',
  solar_input: '#F59E0B',
}

interface PowerSummaryChartsProps {
  readings: PowerReading[]
  metric: PowerMetricType
  isLoading?: boolean
}

export function PowerSummaryCharts({ readings, metric, isLoading }: PowerSummaryChartsProps) {
  const cfg = POWER_METRIC_CONFIG[metric]

  const stationAvgs = useMemo(() => {
    const map = new Map<number, { name: string; values: number[] }>()
    for (const r of readings) {
      if (!map.has(r.station_id)) map.set(r.station_id, { name: r.station_name, values: [] })
      map.get(r.station_id)!.values.push(r.value)
    }
    const entries = Array.from(map.entries()).map(([id, { name, values }]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      return { id, name, avg: parseFloat(avg.toFixed(1)), min: parseFloat(min.toFixed(1)), max: parseFloat(max.toFixed(1)) }
    })
    entries.sort((a, b) => b.avg - a.avg)
    return entries
  }, [readings])

  const maxAvg = Math.max(...stationAvgs.map((s) => s.avg), 0)
  const color = BAR_COLORS[metric] ?? '#0EA5E9'

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
          <div className="mb-4 h-4 w-44 rounded-full bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-6 w-full rounded-lg bg-slate-100" />)}
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
          <div className="mb-4 h-4 w-44 rounded-full bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-6 w-full rounded-lg bg-slate-100" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!stationAvgs.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-storm/40 text-center py-8">No summary data available</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Avg by station */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Average by station">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Summary</p>
        <h3 className="mt-1 text-base font-semibold text-midnight font-display">
          Average {cfg.label} by station
        </h3>
        <div className="mt-4 space-y-2">
          {stationAvgs.map((s) => {
            const pct = maxAvg > 0 ? (s.avg / maxAvg) * 100 : 0
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs font-medium text-storm/70" title={s.name}>
                  {s.name}
                </span>
                <div className="relative flex-1">
                  <div className="h-5 bg-slate-100">
                    <div
                      className="h-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      role="progressbar"
                      aria-valuenow={s.avg}
                      aria-valuemin={0}
                      aria-valuemax={maxAvg}
                      aria-label={`${s.name}: avg ${s.avg}${cfg.unit}`}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-midnight">
                  {s.avg}{cfg.unit}
                  <span className="ml-0.5 text-[10px] text-storm/40">({s.min}–{s.max})</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Value range overview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Value range overview">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Overview</p>
        <h3 className="mt-1 text-base font-semibold text-midnight font-display">
          {cfg.label} range per station
        </h3>
        <div className="mt-4 space-y-2">
          {stationAvgs.map((s) => {
            const minPct = maxAvg > 0 ? (s.min / (maxAvg * 1.2)) * 100 : 0
            const maxPct = maxAvg > 0 ? (s.max / (maxAvg * 1.2)) * 100 : 0
            const avgPct = maxAvg > 0 ? (s.avg / (maxAvg * 1.2)) * 100 : 0
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs font-medium text-storm/70" title={s.name}>
                  {s.name}
                </span>
                <div className="relative flex-1">
                  <div className="relative h-4">
                    {/* Range track */}
                    <div
                      className="absolute top-1 h-2 rounded-sm opacity-20"
                      style={{ left: `${minPct}%`, width: `${Math.max(maxPct - minPct, 2)}%`, backgroundColor: color }}
                      aria-hidden="true"
                    />
                    {/* Avg marker */}
                    <div
                      className="absolute top-0 h-4 w-1 rounded-sm"
                      style={{ left: `${avgPct}%`, backgroundColor: color }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-[10px] tabular-nums text-storm/50">
                  {s.min} – {s.max}{cfg.unit}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-storm/40 border-t border-slate-100 pt-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm opacity-20" style={{ backgroundColor: color }} aria-hidden="true" /> Range
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-1 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" /> Average
          </span>
        </div>
      </section>
    </div>
  )
}
