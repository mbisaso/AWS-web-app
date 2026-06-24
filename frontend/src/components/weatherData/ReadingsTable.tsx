import { useMemo, useState } from 'react'
import type { HistoricalReading, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

type SortKey = 'timestamp' | 'value'
type SortDir = 'asc' | 'desc'

interface ReadingsTableProps {
  readings: HistoricalReading[]
  sensorType: SensorType
  isLoading?: boolean
}

function toLocalDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function exportCSV(readings: HistoricalReading[], sensorLabel: string) {
  const headers = ['Timestamp', 'Station', 'Sensor', 'Value', 'Unit', 'Anomaly', 'Reason']
  const rows = readings.map((r) => [
    r.timestamp,
    r.station_name,
    r.sensor_type,
    String(r.value),
    r.unit,
    r.is_anomaly ? 'Yes' : 'No',
    r.anomaly_reason || '',
  ])
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sensorLabel.toLowerCase().replace(/\s+/g, '-')}-readings.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ReadingsTable({ readings, sensorType, isLoading }: ReadingsTableProps) {
  const cfg = SENSOR_CONFIG[sensorType]
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
      return sortDir === 'asc' ? a.value - b.value : b.value - a.value
    })
    return arr
  }, [readings, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * perPage, (safePage + 1) * perPage)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-3">
            <div className="h-3 w-24 rounded-full bg-slate-200" />
            <div className="h-3 w-16 rounded-full bg-slate-200" />
            <div className="h-3 w-12 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{cfg.label} — Readings</h3>
        <div className="flex flex-col items-center py-10 text-center">
          <p className="text-sm text-storm/40">No readings match the current filters</p>
          <p className="mt-1 text-xs text-storm/30">Try adjusting the date range or station selection</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-midnight font-display">{cfg.label} — Readings</h3>
          <p className="text-xs text-storm/40">{readings.length} total</p>
        </div>
        <button
          type="button"
          onClick={() => exportCSV(readings, cfg.label)}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto" role="table" aria-label={`${cfg.label} readings`}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <SortHeader label="Timestamp" sortKey="timestamp" current={sortKey} dir={sortDir} onSort={handleSort} className="pl-5 pr-2" />
              <SortHeader label="Station" className="px-2" />
              <SortHeader label="Value" sortKey="value" current={sortKey} dir={sortDir} onSort={handleSort} className="px-2" />
              <SortHeader label="Unit" className="px-2" />
              <SortHeader label="Flags" className="pr-5 pl-2" />
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-slate-50 text-sm transition-colors hover:bg-slate-50/50 ${
                  r.is_anomaly ? 'bg-amber-50/30' : ''
                }`}
              >
                <td className="py-3 pl-5 pr-2 text-xs text-storm/70">{toLocalDate(r.timestamp)}</td>
                <td className="px-2 py-3 text-xs font-medium text-midnight">{r.station_name}</td>
                <td className={`px-2 py-3 text-xs font-semibold tabular-nums ${r.is_anomaly ? 'text-amber-700' : 'text-midnight'}`}>
                  {r.value}
                </td>
                <td className="px-2 py-3 text-xs text-storm/40">{r.unit}</td>
                <td className="px-2 py-3 pr-5">
                  {r.is_anomaly && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                      title={r.anomaly_reason || 'Flagged reading'}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
                        <polygon points="4,0 8,8 0,8" />
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
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-storm/40">
          Page {safePage + 1} of {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <PaginateButton
            label="Previous"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          />
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
            const pageNum = i
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPage(pageNum)}
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  safePage === pageNum
                    ? 'bg-midnight text-white'
                    : 'text-storm/50 hover:bg-slate-100 hover:text-storm'
                }`}
                aria-current={safePage === pageNum ? 'page' : undefined}
              >
                {pageNum + 1}
              </button>
            )
          })}
          <PaginateButton
            label="Next"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </div>
      </div>
    </div>
  )
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = '',
}: {
  label: string
  sortKey?: SortKey
  current?: SortKey
  dir?: SortDir
  onSort?: (k: SortKey) => void
  className?: string
}) {
  const isSortable = !!sortKey
  const isActive = current === sortKey
  const Wrapper = isSortable ? 'button' : 'span'
  const props = isSortable
    ? { onClick: () => onSort!(sortKey!), type: 'button' as const, className: 'inline-flex items-center gap-1 cursor-pointer' }
    : {}

  return (
    <th scope="col" className={`py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40 ${className}`}>
      <Wrapper {...props}>
        {label}
        {isSortable && (
          <span className="inline-flex flex-col leading-none" aria-hidden="true">
            <svg
              width="6"
              height="4"
              viewBox="0 0 6 4"
              fill="currentColor"
              className={isActive && dir === 'asc' ? 'text-midnight' : 'text-storm/20'}
            >
              <path d="M3 0l3 4H0z" />
            </svg>
            <svg
              width="6"
              height="4"
              viewBox="0 0 6 4"
              fill="currentColor"
              className={isActive && dir === 'desc' ? 'text-midnight' : 'text-storm/20'}
            >
              <path d="M3 4L0 0h6z" />
            </svg>
          </span>
        )}
      </Wrapper>
    </th>
  )
}

function PaginateButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex cursor-pointer items-center rounded-lg px-2 py-1 text-xs font-medium text-storm/50 transition-colors hover:bg-slate-100 hover:text-storm disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label={label}
    >
      {label === 'Previous' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 3L4 6l3 3" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 3l3 3-3 3" />
        </svg>
      )}
    </button>
  )
}
