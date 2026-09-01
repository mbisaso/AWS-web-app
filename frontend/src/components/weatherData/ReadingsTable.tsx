import { useMemo, useState } from 'react'
import type { SensorMetricKey, SensorReadingChart } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'

type SortKey =
  | 'timestamp'
  | 'value'
  | 'rain_tips'
  | 'wind_pulses'
  | 'wind_knots'
  | 'temperature'
  | 'humidity'

type SortDir = 'asc' | 'desc'

interface ReadingsTableProps {
  readings: SensorReadingChart[]
  metricKey: SensorMetricKey
  stationName?: string
  isLoading?: boolean
}

function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function ReadingsTable({ readings, metricKey, stationName, isLoading }: ReadingsTableProps) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]
  const isAtmospheric = metricKey === 'atmospheric'
  const isRain = metricKey === 'rain'
  const isWind = metricKey === 'wind_speed'

  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)
  const perPage = 25

  const sorted = useMemo(() => {
    const arr = [...readings]
    arr.sort((a, b) => {
      if (sortKey === 'timestamp') {
        const cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'rain_tips') {
        const av = a.rain_tips ?? a.rain_tips_total ?? -Infinity
        const bv = b.rain_tips ?? b.rain_tips_total ?? -Infinity
        return sortDir === 'asc' ? av - bv : bv - av
      }
      if (sortKey === 'wind_pulses') {
        const av = a.wind_pulses_total ?? -Infinity
        const bv = b.wind_pulses_total ?? -Infinity
        return sortDir === 'asc' ? av - bv : bv - av
      }
      if (sortKey === 'wind_knots') {
        const av = a.wind_speed_knots ?? -Infinity
        const bv = b.wind_speed_knots ?? -Infinity
        return sortDir === 'asc' ? av - bv : bv - av
      }
      if (sortKey === 'temperature') {
        const av = a.temperature ?? -Infinity
        const bv = b.temperature ?? -Infinity
        return sortDir === 'asc' ? av - bv : bv - av
      }
      if (sortKey === 'humidity') {
        const av = a.humidity ?? -Infinity
        const bv = b.humidity ?? -Infinity
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const av = (metricKey !== 'atmospheric' ? a[metricKey] : null) ?? -Infinity
      const bv = (metricKey !== 'atmospheric' ? b[metricKey] : null) ?? -Infinity
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [readings, sortKey, sortDir, metricKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * perPage, (safePage + 1) * perPage)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  function exportCSV() {
    let headers: string[]
    if (isAtmospheric) {
      headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)']
    } else if (isRain) {
      headers = ['Timestamp', 'Rain Tips', `${cfg.label} (${cfg.unit})`]
    } else if (isWind) {
      headers = ['Timestamp', 'Wind Pulses Total', `${cfg.label} (${cfg.unit})`, 'Wind Speed (knots)']
    } else {
      headers = ['Timestamp', `${cfg.label} (${cfg.unit})`]
    }

    const rows = sorted.map((r) => {
      if (isAtmospheric) {
        return [r.timestamp, String(r.temperature ?? ''), String(r.humidity ?? '')]
      }
      const val = r[metricKey] ?? ''
      if (isRain) {
        const tips = r.rain_tips ?? r.rain_tips_total ?? ''
        return [r.timestamp, String(tips), String(val)]
      }
      if (isWind) {
        const pulses = r.wind_pulses_total ?? ''
        const knots = r.wind_speed_knots ?? ''
        return [r.timestamp, String(pulses), String(val), String(knots)]
      }
      return [r.timestamp, String(val)]
    })
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${cfg.label.toLowerCase().replace(/\s+/g, '-')}-readings.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tableTitle = stationName
    ? `${cfg.label} readings of ${stationName}`
    : `${cfg.label} — Readings`

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-48 rounded-full bg-slate-200 skeleton-shimmer" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-3">
            <div className="h-3 w-24 rounded-full bg-slate-200 skeleton-shimmer" />
            {(isRain || isWind || isAtmospheric) && (
              <div className="h-3 w-16 rounded-full bg-slate-200 skeleton-shimmer" />
            )}
            <div className="h-3 w-20 rounded-full bg-slate-200 skeleton-shimmer" />
            {isWind && (
              <div className="h-3 w-16 rounded-full bg-slate-200 skeleton-shimmer" />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{tableTitle}</h3>
        <div className="flex flex-col items-center py-10 text-center">
          <p className="text-sm text-storm/40">No readings match the current filters</p>
          <p className="mt-1 text-xs text-storm/30">Try adjusting the date range</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-midnight font-display">{tableTitle}</h3>
          <p className="text-xs text-storm/40">{readings.length} total readings</p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-50 hover:text-storm"
          aria-label="Export readings as CSV"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 10V2M4 7l3 3 3-3" />
            <path d="M2 11v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto" role="table" aria-label={`${cfg.label} readings`}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <SortHeader label="Timestamp" sortKey="timestamp" current={sortKey} dir={sortDir} onSort={handleSort} className="pl-5 pr-2" />
              {isAtmospheric ? (
                <>
                  <SortHeader label="Temperature (°C)" sortKey="temperature" current={sortKey} dir={sortDir} onSort={handleSort} className="px-2" />
                  <SortHeader label="Humidity (%)" sortKey="humidity" current={sortKey} dir={sortDir} onSort={handleSort} className="px-2 pr-5" />
                </>
              ) : (
                <>
                  {isRain && (
                    <SortHeader label="Rain Tips" sortKey="rain_tips" current={sortKey} dir={sortDir} onSort={handleSort} className="px-2" />
                  )}
                  {isWind && (
                    <SortHeader label="Wind Pulses Total" sortKey="wind_pulses" current={sortKey} dir={sortDir} onSort={handleSort} className="px-2" />
                  )}
                  <SortHeader
                    label={`${cfg.label} (${cfg.unit})`}
                    sortKey="value"
                    current={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                    className={`px-2 ${!isWind ? 'pr-5' : ''}`}
                  />
                  {isWind && (
                    <SortHeader label="Wind Speed (knots)" sortKey="wind_knots" current={sortKey} dir={sortDir} onSort={handleSort} className="px-2 pr-5" />
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, idx) => {
              if (isAtmospheric) {
                return (
                  <tr key={r.timestamp + idx} className="border-b border-slate-50 text-sm transition-colors hover:bg-slate-50/50">
                    <td className="py-3 pl-5 pr-2 text-xs text-storm/70">{toLocalDate(r.timestamp)}</td>
                    <td className="px-2 py-3 text-xs font-semibold tabular-nums text-midnight">
                      {r.temperature != null ? `${r.temperature} °C` : <span className="text-storm/30">—</span>}
                    </td>
                    <td className="px-2 py-3 pr-5 text-xs font-semibold tabular-nums text-midnight">
                      {r.humidity != null ? `${r.humidity} %` : <span className="text-storm/30">—</span>}
                    </td>
                  </tr>
                )
              }

              const val = r[metricKey]
              const tips = r.rain_tips ?? r.rain_tips_total
              const pulses = r.wind_pulses_total
              const knots = r.wind_speed_knots

              return (
                <tr key={r.timestamp + idx} className="border-b border-slate-50 text-sm transition-colors hover:bg-slate-50/50">
                  <td className="py-3 pl-5 pr-2 text-xs text-storm/70">{toLocalDate(r.timestamp)}</td>
                  {isRain && (
                    <td className="px-2 py-3 text-xs font-semibold tabular-nums text-midnight">
                      {tips != null ? tips : <span className="text-storm/30">—</span>}
                    </td>
                  )}
                  {isWind && (
                    <td className="px-2 py-3 text-xs font-semibold tabular-nums text-midnight">
                      {pulses != null ? pulses : <span className="text-storm/30">—</span>}
                    </td>
                  )}
                  <td className={`px-2 py-3 text-xs font-semibold tabular-nums text-midnight ${!isWind ? 'pr-5' : ''}`}>
                    {val ?? <span className="text-storm/30">—</span>}
                  </td>
                  {isWind && (
                    <td className="px-2 py-3 pr-5 text-xs font-semibold tabular-nums text-midnight">
                      {knots != null ? knots : <span className="text-storm/30">—</span>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-storm/40">Page {safePage + 1} of {totalPages}</p>
        <div className="flex items-center gap-1">
          <PaginateButton label="Previous" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className={`inline-flex cursor-pointer items-center justify-center rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                safePage === i ? 'bg-midnight text-white' : 'text-storm/50 hover:bg-slate-100 hover:text-storm'
              }`}
              aria-current={safePage === i ? 'page' : undefined}
            >
              {i + 1}
            </button>
          ))}
          <PaginateButton label="Next" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} />
        </div>
      </div>
    </div>
  )
}

function SortHeader({
  label, sortKey, current, dir, onSort, className = '',
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const isActive = current === sortKey
  return (
    <th scope="col" className={`py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40 ${className}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex cursor-pointer items-center gap-1">
        {label}
        <span className="inline-flex flex-col leading-none" aria-hidden="true">
          <svg width="6" height="4" viewBox="0 0 6 4" fill="currentColor" className={isActive && dir === 'asc' ? 'text-midnight' : 'text-storm/20'}>
            <path d="M3 0l3 4H0z" />
          </svg>
          <svg width="6" height="4" viewBox="0 0 6 4" fill="currentColor" className={isActive && dir === 'desc' ? 'text-midnight' : 'text-storm/20'}>
            <path d="M3 4L0 0h6z" />
          </svg>
        </span>
      </button>
    </th>
  )
}

function PaginateButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex cursor-pointer items-center rounded-lg px-2 py-1 text-xs font-medium text-storm/50 transition-colors hover:bg-slate-100 hover:text-storm disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label={label}
    >
      {label === 'Previous' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3L4 6l3 3" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3l3 3-3 3" /></svg>
      )}
    </button>
  )
}
