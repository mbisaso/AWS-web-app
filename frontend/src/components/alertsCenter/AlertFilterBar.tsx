import { useState } from 'react'
import type { AlertSeverity, AlertType, StationReading } from '../../services/api'
import { ALERT_TYPE_LABELS } from '../../services/api'

export interface AlertFilters {
  severity: AlertSeverity | 'all'
  type: AlertType | 'all'
  station_id: number | null
  status: 'unresolved' | 'resolved' | 'all'
  search: string
  date_from: string
  date_to: string
}

interface AlertFilterBarProps {
  stations: StationReading[]
  filters: AlertFilters
  onFilterChange: (filters: AlertFilters) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function AlertFilterBar({ stations, filters, onFilterChange, onClearFilters, hasActiveFilters }: AlertFilterBarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const update = (patch: Partial<AlertFilters>) => {
    onFilterChange({ ...filters, ...patch })
  }

  const filterContent = (
    <div className="flex flex-wrap items-end gap-3">
      {/* ── Search ── */}
      <div className="min-w-[180px] flex-1">
        <label htmlFor="alert-search" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          Search
        </label>
        <input
          id="alert-search"
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Station name or message…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Search alerts by station name or message"
        />
      </div>

      {/* ── Severity ── */}
      <div className="min-w-[120px]">
        <label htmlFor="alert-severity" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          Severity
        </label>
        <select
          id="alert-severity"
          value={filters.severity}
          onChange={(e) => update({ severity: e.target.value as AlertSeverity | 'all' })}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter by severity"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* ── Type ── */}
      <div className="min-w-[140px]">
        <label htmlFor="alert-type" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          Type
        </label>
        <select
          id="alert-type"
          value={filters.type}
          onChange={(e) => update({ type: e.target.value as AlertType | 'all' })}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter by alert type"
        >
          <option value="all">All types</option>
          {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map((t) => (
            <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* ── Station ── */}
      <div className="min-w-[150px]">
        <label htmlFor="alert-station" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          Station
        </label>
        <select
          id="alert-station"
          value={filters.station_id ?? ''}
          onChange={(e) => update({ station_id: e.target.value ? Number(e.target.value) : null })}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter by station"
        >
          <option value="">All stations</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>{s.station_code} · {s.name}</option>
          ))}
        </select>
      </div>

      {/* ── Status ── */}
      <div className="min-w-[120px]">
        <label htmlFor="alert-status" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          Status
        </label>
        <select
          id="alert-status"
          value={filters.status}
          onChange={(e) => update({ status: e.target.value as 'unresolved' | 'resolved' | 'all' })}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter by resolution status"
        >
          <option value="all">All statuses</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* ── Date range ── */}
      <div className="min-w-[130px]">
        <label htmlFor="alert-date-from" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          From
        </label>
        <input
          id="alert-date-from"
          type="date"
          value={filters.date_from}
          onChange={(e) => update({ date_from: e.target.value })}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter alerts from date"
        />
      </div>
      <div className="min-w-[130px]">
        <label htmlFor="alert-date-to" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
          To
        </label>
        <input
          id="alert-date-to"
          type="date"
          value={filters.date_to}
          onChange={(e) => update({ date_to: e.target.value })}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter alerts to date"
        />
      </div>

      {/* ── Clear ── */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          aria-label="Clear all filters"
        >
          Clear filters
        </button>
      )}
    </div>
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Alert filters">
      {/* ── Mobile toggle ── */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="flex w-full items-center justify-between sm:hidden cursor-pointer"
        aria-expanded={isMobileOpen}
        aria-controls="alert-filter-content"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
          Filters {hasActiveFilters ? `(${Object.entries(filters).filter(([k, v]) => v !== '' && v !== 'all' && v !== null && k !== 'date_from' && k !== 'date_to').length})` : ''}
        </span>
        <svg className={`h-4 w-4 text-storm/40 transition-transform duration-200 ${isMobileOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* ── Filter content ── */}
      <div
        id="alert-filter-content"
        className={`mt-3 sm:mt-0 ${isMobileOpen ? 'block' : 'hidden'} sm:block`}
      >
        {filterContent}
      </div>
    </section>
  )
}
