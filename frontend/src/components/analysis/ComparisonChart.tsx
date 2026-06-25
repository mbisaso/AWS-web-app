import { useMemo, useState } from 'react'
import type { MetricReading, SensorMetricKey } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'

const BAR_COLORS = ['#0EA5E9', '#22C55E', '#F59E0B']

type SortBy = 'station' | 'avg' | 'min' | 'max'

interface ComparisonChartProps {
  readings: MetricReading[]
  metricKey: SensorMetricKey
  isLoading?: boolean
}

function groupReadings(readings: MetricReading[]): Map<string, { name: string; values: number[] }> {
  const map = new Map<string, { name: string; values: number[] }>()
  for (const r of readings) {
    if (!map.has(r.station_id)) map.set(r.station_id, { name: r.station_name, values: [] })
    map.get(r.station_id)!.values.push(r.value)
  }
  return map
}

function computeBarStats(values: number[]) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return { avg: parseFloat(avg.toFixed(1)), min: parseFloat(Math.min(...values).toFixed(1)), max: parseFloat(Math.max(...values).toFixed(1)) }
}

export function ComparisonChart({ readings, metricKey, isLoading }: ComparisonChartProps) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]
  const [sortBy, setSortBy] = useState<SortBy>('avg')
  const [sortAsc, setSortAsc] = useState(false)

  const bars = useMemo(() => {
    const grouped = groupReadings(readings)
    const entries = Array.from(grouped.entries()).map(([id, { name, values }]) => {
      const s = computeBarStats(values)
      return { id, name, avg: s.avg, min: s.min, max: s.max, count: values.length }
    })
    entries.sort((a, b) => {
      const valA = sortBy === 'station' ? a.name : a[sortBy]
      const valB = sortBy === 'station' ? b.name : b[sortBy]
      if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA)
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
    })
    return entries
  }, [readings, sortBy, sortAsc])

  const maxVal = useMemo(() => Math.max(...bars.map((b) => b.max), 0), [bars])

  function toggleSort(by: SortBy) {
    if (sortBy === by) setSortAsc((a) => !a)
    else { setSortBy(by); setSortAsc(by === 'station') }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-40 rounded-full bg-slate-200" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-12 w-full rounded-lg bg-slate-100" />)}
        </div>
      </div>
    )
  }

  if (!bars.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{cfg.label} — Station Comparison</h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">Select multiple stations to compare</p>
        </div>
      </div>
    )
  }

  if (bars.length === 1) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-midnight font-display">{cfg.label} — Station Comparison</h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">Select 2+ stations to enable comparison</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {cfg.label} — Station Comparison{' '}
          <span className="text-xs font-normal text-storm/40">({bars.length} stations)</span>
        </h3>
        <div className="flex gap-1" role="group" aria-label="Sort by">
          {(['station', 'avg', 'min', 'max'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key)}
              className={`cursor-pointer rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
                sortBy === key
                  ? 'bg-midnight text-white'
                  : 'text-storm/50 hover:text-storm border border-slate-200'
              }`}
              aria-pressed={sortBy === key}
            >
              {key === 'station' ? 'Name' : key === 'avg' ? 'Avg' : key.charAt(0).toUpperCase() + key.slice(1)}
              {sortBy === key && <span className="ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-4 text-[10px] text-storm/50">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLORS[0] }} aria-hidden="true" /> Avg</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLORS[1] }} aria-hidden="true" /> Min</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLORS[2] }} aria-hidden="true" /> Max</span>
      </div>

      <div className="overflow-x-auto">
        <div className="space-y-3" style={{ minWidth: 480 }}>
          {bars.map((bar) => {
            const avgW = maxVal > 0 ? (bar.avg / maxVal) * 100 : 0
            const minW = maxVal > 0 ? (bar.min / maxVal) * 100 : 0
            const maxW = maxVal > 0 ? (bar.max / maxVal) * 100 : 0
            return (
              <div key={bar.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs font-medium text-storm/70" title={bar.name}>{bar.name}</span>
                <div className="relative flex-1">
                  <div className="flex h-7 items-center gap-0.5">
                    <div className="h-full rounded-l-sm opacity-80" style={{ width: `${minW}%`, backgroundColor: BAR_COLORS[1], minWidth: minW > 0 ? 2 : 0 }} role="progressbar" aria-valuenow={bar.min} aria-valuemin={0} aria-valuemax={maxVal} aria-label={`${bar.name} min: ${bar.min}${cfg.unit}`} />
                    <div className="h-full opacity-90" style={{ width: `${avgW - minW}%`, backgroundColor: BAR_COLORS[0], minWidth: avgW > minW ? 2 : 0 }} role="progressbar" aria-valuenow={bar.avg} aria-valuemin={0} aria-valuemax={maxVal} aria-label={`${bar.name} avg: ${bar.avg}${cfg.unit}`} />
                    <div className="h-full rounded-r-sm" style={{ width: `${maxW - avgW}%`, backgroundColor: BAR_COLORS[2], minWidth: maxW > avgW ? 2 : 0 }} role="progressbar" aria-valuenow={bar.max} aria-valuemin={0} aria-valuemax={maxVal} aria-label={`${bar.name} max: ${bar.max}${cfg.unit}`} />
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right">
                  <span className="text-xs font-semibold tabular-nums text-midnight">{bar.avg}{cfg.unit}</span>
                  <span className="ml-1 text-[10px] text-storm/40">({bar.min}–{bar.max})</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
