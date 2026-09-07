import { useMemo, useState } from 'react'
import type { PowerChart, PowerMetricKey } from '../../types'
import { POWER_METRIC_CONFIG } from '../../types'
import { formatDecimal } from '../../utils/formatters'

type SortKey = 'timestamp' | 'value' | 'volt_batt' | 'curr_batt' | 'battery_temp' | 'volt_solar' | 'curr_solar'

interface PowerReadingsTableProps {
  readings: PowerChart[]
  metricKey: PowerMetricKey
  stationName?: string
  isLoading?: boolean
}

function toLocalDate(ts: string): string {
  const d = new Date(ts)
  return isNaN(d.getTime())
    ? ts
    : d.toLocaleString(undefined, {
        timeZone: 'Africa/Kampala',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

export function PowerReadingsTable({ readings, metricKey, stationName, isLoading }: PowerReadingsTableProps) {
  const cfg = POWER_METRIC_CONFIG[metricKey]
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(0)
  const PER_PAGE = 25

  const isBatteryDynamics = metricKey === 'battery_dynamics'
  const isSolarDynamics = metricKey === 'solar_dynamics'

  const sorted = useMemo(() => {
    const copy = [...readings]
    copy.sort((a, b) => {
      if (sortKey === 'timestamp') {
        return sortAsc
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      if (sortKey === 'volt_batt') {
        const av = a.volt_batt ?? -Infinity, bv = b.volt_batt ?? -Infinity
        return sortAsc ? av - bv : bv - av
      }
      if (sortKey === 'curr_batt') {
        const av = a.curr_batt ?? -Infinity, bv = b.curr_batt ?? -Infinity
        return sortAsc ? av - bv : bv - av
      }
      if (sortKey === 'battery_temp') {
        const av = a.battery_temp ?? -Infinity, bv = b.battery_temp ?? -Infinity
        return sortAsc ? av - bv : bv - av
      }
      if (sortKey === 'volt_solar') {
        const av = a.volt_solar ?? -Infinity, bv = b.volt_solar ?? -Infinity
        return sortAsc ? av - bv : bv - av
      }
      if (sortKey === 'curr_solar') {
        const av = a.curr_solar ?? -Infinity, bv = b.curr_solar ?? -Infinity
        return sortAsc ? av - bv : bv - av
      }
      const av = a[metricKey] ?? -Infinity
      const bv = b[metricKey] ?? -Infinity
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return copy
  }, [readings, sortKey, sortAsc, metricKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(key === 'timestamp' ? false : true) }
    setPage(0)
  }

  function exportCSV() {
    let header = `Timestamp,${cfg.label} (${cfg.unit})`
    let rows: string[] = []

    if (isBatteryDynamics) {
      header = 'Timestamp,Battery Voltage (V),Battery Current (A),Battery Temp (°C)'
      rows = sorted.map((r) => `${r.timestamp},${r.volt_batt ?? ''},${r.curr_batt ?? ''},${r.battery_temp ?? ''}`)
    } else if (isSolarDynamics) {
      header = 'Timestamp,Solar Voltage (V),Solar Current (A)'
      rows = sorted.map((r) => `${r.timestamp},${r.volt_solar ?? ''},${r.curr_solar ?? ''}`)
    } else {
      rows = sorted.map((r) => `${r.timestamp},${r[metricKey] ?? ''}`)
    }

    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `power-${metricKey}-readings.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tableTitle = stationName
    ? `${cfg.label} readings of ${stationName}`
    : `${cfg.label} — Readings`

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200 skeleton-shimmer" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 w-full rounded-lg bg-slate-100 skeleton-shimmer" />
          ))}
        </div>
      </div>
    )
  }

  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-midnight font-display">{tableTitle}</h3>
        </div>
        <div className="flex flex-col items-center py-12">
          <svg className="mb-3 h-10 w-10 text-storm/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="M9 15l3-3 3 3" />
          </svg>
          <p className="text-sm font-medium text-storm/40">No readings match the current filters</p>
          <p className="mt-1 text-xs text-storm/30">Select a station and date range to load data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {tableTitle}
          <span className="ml-1.5 text-xs font-normal text-storm/40">({readings.length})</span>
        </h3>
        <button
          type="button"
          onClick={exportCSV}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-50 hover:text-storm focus:outline-none focus:ring-2 focus:ring-sky-soft"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left" aria-label={`${cfg.label} readings`}>
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-storm/40">
              <th scope="col" className="pb-2.5 pl-5 pr-2">
                <button
                  type="button"
                  onClick={() => toggleSort('timestamp')}
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors"
                >
                  Timestamp
                  {sortKey === 'timestamp' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </button>
              </th>

              {isBatteryDynamics ? (
                <>
                  <th scope="col" className="pb-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('volt_batt')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors"
                    >
                      Battery Voltage (V)
                      {sortKey === 'volt_batt' && <span>{sortAsc ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th scope="col" className="pb-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('curr_batt')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors"
                    >
                      Battery Current (A)
                      {sortKey === 'curr_batt' && <span>{sortAsc ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th scope="col" className="pb-2.5 pr-5 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('battery_temp')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors ml-auto"
                    >
                      Battery Temp (°C)
                      {sortKey === 'battery_temp' && <span>{sortAsc ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                </>
              ) : isSolarDynamics ? (
                <>
                  <th scope="col" className="pb-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => toggleSort('volt_solar')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors"
                    >
                      Solar Voltage (V)
                      {sortKey === 'volt_solar' && <span>{sortAsc ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th scope="col" className="pb-2.5 pr-5 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('curr_solar')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors ml-auto"
                    >
                      Solar Current (A)
                      {sortKey === 'curr_solar' && <span>{sortAsc ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                </>
              ) : (
                <th scope="col" className="pb-2.5 pr-5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('value')}
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-storm transition-colors ml-auto"
                  >
                    {cfg.label} ({cfg.unit})
                    {sortKey === 'value' && <span>{sortAsc ? '▲' : '▼'}</span>}
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, idx) => {
              if (isBatteryDynamics) {
                return (
                  <tr key={r.timestamp + idx} className="border-b border-slate-50 text-sm transition-colors hover:bg-slate-50/50">
                    <td className="py-3 pl-5 pr-2 text-xs text-storm/70">{toLocalDate(r.timestamp)}</td>
                    <td className="px-2 py-3 text-xs font-semibold tabular-nums text-midnight font-display">
                      {r.volt_batt != null ? `${formatDecimal(r.volt_batt)} V` : <span className="text-storm/30">—</span>}
                    </td>
                    <td className="px-2 py-3 text-xs font-semibold tabular-nums text-midnight font-display">
                      {r.curr_batt != null ? `${formatDecimal(r.curr_batt)} A` : <span className="text-storm/30">—</span>}
                    </td>
                    <td className="px-2 py-3 pr-5 text-right text-xs font-semibold tabular-nums text-midnight font-display">
                      {r.battery_temp != null ? `${formatDecimal(r.battery_temp)} °C` : <span className="text-storm/30">—</span>}
                    </td>
                  </tr>
                )
              }

              if (isSolarDynamics) {
                return (
                  <tr key={r.timestamp + idx} className="border-b border-slate-50 text-sm transition-colors hover:bg-slate-50/50">
                    <td className="py-3 pl-5 pr-2 text-xs text-storm/70">{toLocalDate(r.timestamp)}</td>
                    <td className="px-2 py-3 text-xs font-semibold tabular-nums text-midnight font-display">
                      {r.volt_solar != null ? `${formatDecimal(r.volt_solar)} V` : <span className="text-storm/30">—</span>}
                    </td>
                    <td className="px-2 py-3 pr-5 text-right text-xs font-semibold tabular-nums text-midnight font-display">
                      {r.curr_solar != null ? `${formatDecimal(r.curr_solar)} A` : <span className="text-storm/30">—</span>}
                    </td>
                  </tr>
                )
              }

              const val = r[metricKey]
              return (
                <tr key={r.timestamp + idx} className="border-b border-slate-50 text-sm transition-colors hover:bg-slate-50/50">
                  <td className="py-3 pl-5 pr-2 text-xs text-storm/70">{toLocalDate(r.timestamp)}</td>
                  <td className="py-3 pr-5 text-right text-xs font-semibold tabular-nums text-midnight font-display">
                    {val != null ? `${formatDecimal(val as number)} ${cfg.unit}` : <span className="text-storm/30">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-storm/50">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
