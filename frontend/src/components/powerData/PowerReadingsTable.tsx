import { useMemo, useState } from 'react'
import type { PowerChart, PowerMetricKey } from '../../types'
import { POWER_METRIC_CONFIG } from '../../types'

type SortKey = 'timestamp' | 'value'

interface PowerReadingsTableProps {
  readings: PowerChart[]
  metricKey: PowerMetricKey
  isLoading?: boolean
}

export function PowerReadingsTable({ readings, metricKey, isLoading }: PowerReadingsTableProps) {
  const cfg = POWER_METRIC_CONFIG[metricKey]
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(0)
  const PER_PAGE = 25

  const sorted = useMemo(() => {
    const copy = [...readings]
    copy.sort((a, b) => {
      if (sortKey === 'timestamp') {
        return sortAsc
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      const av = a[metricKey] ?? -Infinity
      const bv = b[metricKey] ?? -Infinity
      return sortAsc ? av - bv : bv - av
    })
    return copy
  }, [readings, sortKey, sortAsc, metricKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(key === 'value') }
    setPage(0)
  }

  function exportCSV() {
    const header = `Timestamp,${cfg.label} (${cfg.unit})`
    const rows = sorted.map((r) => `${r.timestamp},${r[metricKey] ?? ''}`)
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `power-${metricKey}-readings.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 w-full rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-midnight font-display">{cfg.label} — Readings</h3>
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
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {cfg.label} — Readings
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
        <table className="w-full text-left text-xs" role="table">
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[35%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100">
              <ThSortable label="Timestamp" col="timestamp" current={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <ThSortable label={cfg.label} col="value" current={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <Th>Unit</Th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r, idx) => {
              const val = r[metricKey]
              return (
                <tr
                  key={r.timestamp + idx}
                  className="border-b border-slate-50 transition-colors hover:bg-slate-50/50"
                >
                  <td className="py-2.5 pr-3 font-medium text-midnight tabular-nums">
                    {new Date(r.timestamp).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold tabular-nums text-midnight">
                    {val ?? <span className="text-storm/30">—</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-storm/40">{cfg.unit}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-[10px] text-storm/40">Page {page + 1} of {totalPages}</p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-50 hover:text-storm disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-sky-soft"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-50 hover:text-storm disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-sky-soft"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-storm/40">
      {children}
    </th>
  )
}

function ThSortable({
  label, col, current, asc, onToggle,
}: {
  label: string
  col: SortKey
  current: SortKey
  asc: boolean
  onToggle: (key: SortKey) => void
}) {
  const isActive = current === col
  return (
    <th className="py-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-storm/40">
      <button
        type="button"
        onClick={() => onToggle(col)}
        className={`inline-flex cursor-pointer items-center transition-colors hover:text-midnight focus:outline-none focus:ring-2 focus:ring-sky-soft rounded-sm ${isActive ? 'text-midnight' : ''}`}
      >
        {label}
        <span className="ml-1 text-storm/20" aria-hidden="true">
          {isActive ? (asc ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}
