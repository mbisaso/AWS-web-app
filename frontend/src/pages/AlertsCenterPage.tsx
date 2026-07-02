import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Alert, AlertFilterParams, AlertSeverity, AlertType } from '../services/api'
import { fetchAlertsData } from '../services/api'
import { useDashboardData } from '../hooks/useDashboardData'
import { usePollingData } from '../hooks/usePollingData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { AlertSummaryCards } from '../components/alertsCenter/AlertSummaryCards'
import { AlertFilterBar } from '../components/alertsCenter/AlertFilterBar'
import type { AlertFilters } from '../components/alertsCenter/AlertFilterBar'
import { AlertListItem } from '../components/alertsCenter/AlertListItem'
import { BulkActionBar } from '../components/alertsCenter/BulkActionBar'

const PAGE_SIZE = 15

function parseFiltersFromParams(params: URLSearchParams): AlertFilters {
  return {
    severity: (params.get('severity') as AlertSeverity | 'all') || 'all',
    type: (params.get('type') as AlertType | 'all') || 'all',
    station_id: params.get('station_id') ? Number(params.get('station_id')) : null,
    status: (params.get('status') as 'unresolved' | 'resolved' | 'all') || 'all',
    search: params.get('search') || '',
    date_from: params.get('date_from') || '',
    date_to: params.get('date_to') || '',
  }
}

function filtersToParams(filters: AlertFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.severity && filters.severity !== 'all') p.set('severity', filters.severity)
  if (filters.type && filters.type !== 'all') p.set('type', filters.type)
  if (filters.station_id) p.set('station_id', String(filters.station_id))
  if (filters.status && filters.status !== 'all') p.set('status', filters.status)
  if (filters.search) p.set('search', filters.search)
  if (filters.date_from) p.set('date_from', filters.date_from)
  if (filters.date_to) p.set('date_to', filters.date_to)
  return p
}

function hasActiveFilters(filters: AlertFilters): boolean {
  return (
    filters.severity !== 'all' ||
    filters.type !== 'all' ||
    filters.station_id !== null ||
    filters.status !== 'all' ||
    filters.search !== '' ||
    filters.date_from !== '' ||
    filters.date_to !== ''
  )
}

export function AlertsCenterPage() {
  const { data: dashData, isLoading: dashLoading } = useDashboardData()
  const stations = dashData?.stations ?? []

  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<AlertFilters>(() => parseFiltersFromParams(searchParams))
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>(filters.severity)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(searchParams.get('selected')?.split(',').map(Number).filter(Boolean) ?? []),
  )
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  const [newIds, setNewIds] = useState<Set<number>>(new Set())
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([])
  const prevAlertIdsRef = useRef<string>('')

  const apiParams = useMemo<AlertFilterParams>(
    () => ({
      severity: filters.severity,
      type: filters.type,
      station_id: filters.station_id,
      status: filters.status,
      search: filters.search || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    }),
    [filters.severity, filters.type, filters.station_id, filters.status, filters.search, filters.date_from, filters.date_to],
  )

  const cacheKey = useMemo(
    () => `alerts_${[
      apiParams.severity ?? '',
      apiParams.type ?? '',
      apiParams.station_id ?? '',
      apiParams.status ?? '',
      apiParams.search ?? '',
      apiParams.date_from ?? '',
      apiParams.date_to ?? '',
    ].join('|')}`,
    [apiParams],
  )

  const { data, isLoading, error, retry } = usePollingData(
    () => fetchAlertsData(apiParams),
    [
      apiParams.severity ?? '',
      apiParams.type ?? '',
      apiParams.station_id ?? '',
      apiParams.status ?? '',
      apiParams.search ?? '',
      apiParams.date_from ?? '',
      apiParams.date_to ?? '',
    ],
    30_000,
    cacheKey,
  )

  const allAlerts = data?.alerts ?? []

  /* ── Sync data to local state (for resolve/reopen mutations) ── */
  useEffect(() => {
    if (allAlerts.length) {
      setLocalAlerts(allAlerts)
    }
  }, [allAlerts])

  /* ── Detect new alerts across polls ── */
  useEffect(() => {
    if (!localAlerts.length) return
    const currentIds = localAlerts.map((a) => a.id).join(',')
    if (currentIds === prevAlertIdsRef.current) return

    if (prevAlertIdsRef.current) {
      const prevIds = new Set(prevAlertIdsRef.current.split(',').map(Number))
      const newlyArrived = localAlerts.filter((a) => !prevIds.has(a.id)).map((a) => a.id)
      if (newlyArrived.length) {
        setNewIds(new Set(newlyArrived))
        setTimeout(() => setNewIds(new Set()), 3000)
      }
    }

    prevAlertIdsRef.current = currentIds
  }, [localAlerts])

  /* ── Sync filters ↔ URL ── */
  const updateFilters = useCallback(
    (newFilters: AlertFilters) => {
      setFilters(newFilters)
      setSearchParams(filtersToParams(newFilters), { replace: true })
      setPage(1)
      setSelectedIds(new Set())
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    const cleared: AlertFilters = { severity: 'all', type: 'all', station_id: null, status: 'all', search: '', date_from: '', date_to: '' }
    setFilters(cleared)
    setSeverityFilter('all')
    setSearchParams(new URLSearchParams(), { replace: true })
    setPage(1)
    setSelectedIds(new Set())
  }, [setSearchParams])

  /* ── Sync page and selectedIds to URL ── */
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (page > 1) next.set('page', String(page))
      else next.delete('page')
      const sel = Array.from(selectedIds)
      if (sel.length > 0) next.set('selected', sel.join(','))
      else next.delete('selected')
      return next
    }, { replace: true })
  }, [page, selectedIds, setSearchParams])

  /* ── Severity summary card filter ── */
  const handleSeverityFilter = useCallback(
    (severity: AlertSeverity | 'all') => {
      setSeverityFilter(severity)
      updateFilters({ ...filters, severity })
    },
    [filters, updateFilters],
  )

  /* ── Bulk resolve ── */
  const handleResolveSelected = useCallback(
    (note?: string) => {
      setLocalAlerts((prev) =>
        prev.map((a) =>
          selectedIds.has(a.id)
            ? { ...a, is_resolved: true, resolved_at: new Date().toISOString(), resolved_note: note }
            : a,
        ),
      )
      setSelectedIds(new Set())
    },
    [selectedIds],
  )

  /* ── Toggle single-select ── */
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /* ── Pagination ── */
  const paginatedAlerts = localAlerts.slice(0, PAGE_SIZE * page)

  const hasMore = localAlerts.length > PAGE_SIZE * page

  const dataLoading = isLoading && !localAlerts.length

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight via-[#1a1a3e] to-red-950/40 p-6 shadow-lg sm:p-8">
          {/* Decorative glow orbs */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-red-500/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-yellow-400/8 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300/80">Alerts Center</p>
            </div>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Alert management
            </h1>
            <p className="text-sm text-white/50">
              {dashLoading
                ? 'Loading stations...'
                : `${localAlerts.length} alert${localAlerts.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Subtle bottom accent line */}
          <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-red-400/20 to-transparent" aria-hidden="true" />
        </div>

        {/* ── Summary cards ── */}
        <section aria-label="Alert summary" className="mb-6">
          <AlertSummaryCards
            alerts={localAlerts}
            isLoading={dataLoading}
            activeSeverity={severityFilter}
            onSeverityFilter={handleSeverityFilter}
          />
        </section>

        {/* ── Filters ── */}
        <section aria-label="Filters" className="mb-6">
          <AlertFilterBar
            stations={stations}
            filters={filters}
            onFilterChange={updateFilters}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters(filters)}
          />
        </section>

        {/* ── Error state ── */}
        {error && (
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-700">Failed to load alerts</p>
              <p className="text-xs text-rose-500/70">{error}</p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty states ── */}
        {!dataLoading && localAlerts.length === 0 && !error && (
          <div className="mb-6 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-xs">
            {hasActiveFilters(filters) ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky-bright">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <circle cx="12" cy="8" r="0.5" fill="currentColor" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-midnight">No alerts match your filters</p>
                <p className="mt-1 text-xs text-storm/40">Try adjusting the filters or search term above.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 cursor-pointer rounded-full bg-sky-soft px-4 py-2 text-xs font-semibold text-sky-deep transition-colors hover:bg-sky-mist"
                >
                  Clear all filters
                </button>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4 12 14.01l-3-3" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-midnight">All clear — no active alerts</p>
                <p className="mt-1 text-xs text-storm/40">All stations are operating normally.</p>
              </>
            )}
          </div>
        )}

        {/* ── Skeleton loading ── */}
        {dataLoading && (
          <section aria-label="Loading alerts" className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-48 animate-pulse rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Alert list ── */}
        {localAlerts.length > 0 && (
          <>
            <section aria-label="Alert list" role="list" className="space-y-2.5">
              {paginatedAlerts.map((alert) => (
                <AlertListItem
                  key={alert.id}
                  alert={alert}
                  isSelected={selectedIds.has(alert.id)}
                  onSelect={() => toggleSelect(alert.id)}
                  isNew={newIds.has(alert.id)}
                />
              ))}
            </section>

            {/* ── Load more / pagination ── */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-storm/40">
                Showing {Math.min(PAGE_SIZE * page, localAlerts.length)} of {localAlerts.length} alerts
              </p>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  className="cursor-pointer rounded-full bg-white border border-slate-200 px-5 py-2 text-xs font-semibold text-storm/60 transition-colors hover:bg-slate-100 hover:text-storm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
                >
                  Load more
                </button>
              )}
            </div>

            {/* ── Bulk action bar (sticky at bottom) ── */}
            <BulkActionBar
              selectedCount={selectedIds.size}
              onResolveSelected={handleResolveSelected}
              onClearSelection={() => setSelectedIds(new Set())}
            />
          </>
        )}

        {/* ── Screen reader live region for new alerts ── */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {newIds.size > 0 && `${newIds.size} new alert${newIds.size !== 1 ? 's' : ''} arrived`}
        </div>
      </main>
    </div>
  )
}
