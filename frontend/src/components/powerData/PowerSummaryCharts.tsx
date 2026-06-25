import { useMemo } from 'react'
import type { PowerChart, PowerMetricKey } from '../../types'
import { POWER_METRIC_CONFIG } from '../../types'

interface PowerSummaryChartsProps {
  readings: PowerChart[]
  metricKey: PowerMetricKey
  isLoading?: boolean
}

export function PowerSummaryCharts({ readings, metricKey, isLoading }: PowerSummaryChartsProps) {
  const cfg = POWER_METRIC_CONFIG[metricKey]

  const stats = useMemo(() => {
    const values = readings
      .map((r) => r[metricKey])
      .filter((v): v is number => v !== null)
    if (!values.length) return null
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    return {
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      count: values.length,
    }
  }, [readings, metricKey])

  const color = cfg.color

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
          <div className="mb-4 h-4 w-44 rounded-full bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-6 w-full rounded-lg bg-slate-100" />)}
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
          <div className="mb-4 h-4 w-44 rounded-full bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-6 w-full rounded-lg bg-slate-100" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-storm/40 text-center py-8">No summary data available</p>
      </div>
    )
  }

  const range = stats.max - stats.min || 1
  const avgFraction = (stats.avg - stats.min) / range

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Avg bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Average">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Summary</p>
        <h3 className="mt-1 text-base font-semibold text-midnight font-display">
          Average {cfg.label}
        </h3>
        <div className="mt-4 space-y-2">
          {[
            { label: 'Minimum', value: stats.min },
            { label: 'Average', value: stats.avg },
            { label: 'Maximum', value: stats.max },
          ].map(({ label, value }) => {
            const pct = stats.max > 0 ? (value / stats.max) * 100 : 0
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium text-storm/70">{label}</span>
                <div className="relative flex-1">
                  <div className="h-5 rounded bg-slate-100">
                    <div
                      className="h-full rounded transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      role="progressbar"
                      aria-valuenow={value}
                      aria-valuemin={0}
                      aria-valuemax={stats.max}
                      aria-label={`${label}: ${value}${cfg.unit}`}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-midnight">
                  {value}{cfg.unit}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[10px] text-storm/40">{stats.count} readings analysed</p>
      </section>

      {/* Range overview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Value range">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Overview</p>
        <h3 className="mt-1 text-base font-semibold text-midnight font-display">
          {cfg.label} range
        </h3>
        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between text-[10px] text-storm/40">
            <span>{stats.min}{cfg.unit}</span>
            <span>Range ({stats.max - stats.min > 0 ? (stats.max - stats.min).toFixed(2) : '0'}{cfg.unit})</span>
            <span>{stats.max}{cfg.unit}</span>
          </div>
          <div className="relative h-3 w-full overflow-visible rounded-full bg-slate-100">
            <div className="absolute inset-y-0 left-0 h-full w-full rounded-full" style={{ backgroundColor: `${color}25` }} />
            <div
              className="absolute -top-0.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow-md"
              style={{ left: `${avgFraction * 100}%`, backgroundColor: color }}
              aria-label={`Average: ${stats.avg}${cfg.unit}`}
            />
          </div>
          <p className="mt-3 text-center text-xs font-semibold" style={{ color }}>
            {stats.avg}{cfg.unit}
            <span className="ml-1 text-[10px] font-normal text-storm/40">average</span>
          </p>
        </div>
        <div className="mt-4 flex items-center gap-4 text-[10px] text-storm/40 border-t border-slate-100 pt-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: `${color}25` }} aria-hidden="true" /> Range
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" /> Average
          </span>
        </div>
      </section>
    </div>
  )
}
