import { useMemo, useState } from 'react'
import type { PowerMetricType, PowerReading } from '../../services/api'
import { POWER_METRIC_CONFIG } from '../../services/api'

type SortKey = 'timestamp' | 'value'

interface PowerReadingsTableProps {
  readings: PowerReading[]
  metric: PowerMetricType
  isLoading?: boolean
}

export function PowerReadingsTable({ readings, metric, isLoading }: PowerReadingsTableProps) {
  const cfg = POWER_METRIC_CONFIG[metric]
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
      return sortAsc ? a.value - b.value : b.value - a.value
    })
    return copy
  }, [readings, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(key === 'value')
    }
    setPage(0)
  }

  function exportCSV() {
    const header = 'Timestamp,Station,Metric,Value,Unit,Flagged,Reason'
    const rows = readings.map((r) =>
      [
        r.timestamp,
        r.station_name,
        r.metric,
        r.value,
        r.unit,
        r.is_anomaly ? 'Yes' : '',
        r.is_anomaly ? (r.anomaly_reason ?? '') : '',
      ].join(','),
    )
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `power-${metric}-readings.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ── Loading skeleton ── */
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

  /* ── Empty state ── */
  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-midnight font-display">
            {cfg.label} — Readings
          </h3>
        </div>
        <div className="flex flex-col items-center py-12">
          <svg className="mb-3 h-10 w-10 text-storm/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="M9 15l3-3 3 3" />
          </svg>
          <p className="text-sm font-medium text-storm/40">No readings match the current filters</p>
          <p className="mt-1 text-xs text-storm/30">Try adjusting the station, metric, or date range.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Header + CSV export */}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" role="table">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100">
              <ThSortable label="Timestamp" col="timestamp" current={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <Th>Station</Th>
              <Th>Metric</Th>
              <ThSortable label="Value" col="value" current={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <Th>Unit</Th>
              <Th>Flags</Th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${r.is_anomaly ? 'bg-amber-50/40' : ''}`}
              >
                <td className="py-2.5 pr-3 font-medium text-midnight tabular-nums">
                  {new Date(r.timestamp).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="py-2.5 pr-3 text-storm/70">{r.station_name}</td>
                <td className="py-2.5 pr-3 text-storm/70">{POWER_METRIC_CONFIG[r.metric]?.label ?? r.metric}</td>
                <td className={`py-2.5 pr-3 font-semibold tabular-nums ${r.is_anomaly ? 'text-amber-700' : 'text-midnight'}`}>
                  {r.value}
                </td>
                <td className="py-2.5 pr-3 text-storm/40">{r.unit}</td>
                <td className="py-2.5">
                  {r.is_anomaly && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700" title={r.anomaly_reason}>
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="12,2 2,22 22,22" />
                      </svg>
                      Flagged
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-[10px] text-storm/40">
          Page {page + 1} of {totalPages}
        </p>
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

/* ── Sub-components ── */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-storm/40">
      {children}
    </th>
  )
}

function ThSortable({
  label,
  col,
  current,
  asc,
  onToggle,
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
          {isActive ? (asc ? '\u2191' : '\u2193') : '\u2195'}
        </span>
      </button>
    </th>
  )
}
