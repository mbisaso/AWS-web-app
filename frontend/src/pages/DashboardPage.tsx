import { useState } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { formatRelativeTime } from '../services/api'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { SummaryCard, AlertsBreakdown } from '../components/dashboard/SummaryCard'
import { SummaryCharts } from '../components/dashboard/SummaryCharts'
import { StationStatusRow } from '../components/dashboard/StationStatusRow'
import { CompactMapPreview } from '../components/dashboard/CompactMapPreview'
import { RecentAlertsPreview } from '../components/dashboard/RecentAlertsPreview'
import { SkeletonCard, SkeletonTableRows } from '../components/dashboard/SkeletonCard'
import {
  MapPinIcon,
  SignalIcon,
  ShieldIcon,
  BellIcon,
  CloseIcon,
} from '../components/landing/Icons'

type StationFilter = 'all' | 'online' | 'offline' | 'alerts'

const FILTER_LABELS: Record<StationFilter, string> = {
  all: 'All stations',
  online: 'Online',
  offline: 'Offline',
  alerts: 'With alerts',
}

export function DashboardPage() {
  const { data, isLoading, error, retry } = useDashboardData()
  const [activeFilter, setActiveFilter] = useState<StationFilter>('all')

  /* ── Filtered stations ── */
  const filteredStations =
    data?.stations.filter((s) => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'online') return s.status === 'online'
      if (activeFilter === 'offline') return s.status !== 'online'
      if (activeFilter === 'alerts') return s.status === 'offline'
      return true
    }) ?? []

  /* ── Error state ── */
  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-mist to-sky-soft p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <ShieldIcon className="h-7 w-7 text-rose" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-midnight font-display">
            Unable to load dashboard
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-storm/60">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-midnight px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-storm"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  /* ── Empty state ── */
  if (data && data.stations.length === 0) {
    return (
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardSidebar />
        <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-mist to-sky-soft p-6">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-soft">
              <SignalIcon className="h-8 w-8 text-sky-primary" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-midnight font-display">
              No stations registered
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-storm/60">
              Your weather network is empty. Add your first station to start monitoring
              temperature, humidity, rainfall, and wind data in real time.
            </p>
            <a
              href="#"
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-sky-primary to-sky-deep px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-110"
            >
              Add your first station
            </a>
          </div>
        </main>
      </div>
    )
  }

  /* ── Main dashboard ── */
  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header with subtle gradient ── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                Dashboard
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold text-white font-display sm:text-3xl">
                Station overview
              </h1>
              <p className="mt-1 text-sm text-white/50">
                {data
                  ? `${data.summary.total_stations} stations · ${data.summary.online_stations} online · ${data.summary.active_alerts} alerts`
                  : 'Loading...'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm">
                  Last sync{' '}
                  {formatRelativeTime(
                    data.stations.reduce((a, b) =>
                      new Date(a.last_seen) > new Date(b.last_seen) ? a : b
                    ).last_seen
                  )}
                </span>
              )}
              {isLoading && !data && (
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-300" />
                  <span className="text-xs text-white/50">Loading...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Loading state (skeletons) ── */}
        {isLoading && !data && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div>
              <div className="mb-3 h-4 w-36 rounded-full bg-slate-200 animate-pulse" />
              <SkeletonTableRows count={6} />
            </div>
          </div>
        )}

        {/* ── Actual data sections ── */}
        {data && (
          <div className="space-y-8">
            {/* ── Summary cards row ── */}
            <section aria-label="Station summary">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  title="Total stations"
                  value={data.summary.total_stations}
                  subtext="Registered in the network"
                  accent="default"
                  icon={<MapPinIcon className="h-5 w-5" />}
                  onClick={() => setActiveFilter('all')}
                  isActive={activeFilter === 'all'}
                />

                <SummaryCard
                  title="Online"
                  value={data.summary.online_stations}
                  subtext={`${data.summary.online_percentage}% of total`}
                  accent="success"
                  icon={<SignalIcon className="h-5 w-5" />}
                  onClick={() => setActiveFilter('online')}
                  isActive={activeFilter === 'online'}
                />

                <SummaryCard
                  title="Offline"
                  value={data.summary.offline_stations}
                  subtext={`${data.summary.offline_percentage}% of total`}
                  accent={data.summary.offline_percentage > 30 ? 'danger' : 'warning'}
                  icon={<ShieldIcon className="h-5 w-5" />}
                  onClick={() => setActiveFilter('offline')}
                  isActive={activeFilter === 'offline'}
                />

                <SummaryCard
                  title="Active alerts"
                  value={data.summary.active_alerts}
                  subtext={
                    data.summary.critical_alerts > 0
                      ? `${data.summary.critical_alerts} critical`
                      : 'Requires attention'
                  }
                  accent={
                    data.summary.critical_alerts > 0
                      ? 'danger'
                      : data.summary.warning_alerts > 0
                        ? 'warning'
                        : 'default'
                  }
                  icon={<BellIcon className="h-5 w-5" />}
                  onClick={() => setActiveFilter('alerts')}
                  isActive={activeFilter === 'alerts'}
                >
                  <AlertsBreakdown
                    critical={data.summary.critical_alerts}
                    warning={data.summary.warning_alerts}
                    info={data.summary.info_alerts}
                  />
                </SummaryCard>
              </div>
            </section>

            {/* ── Summary charts ── */}
            <SummaryCharts
              stations={data.stations}
              onlineCount={data.summary.online_stations}
              offlineCount={data.summary.offline_stations}
              partialCount={
                data.summary.offline_stations -
                data.stations.filter((s) => s.status === 'offline').length
              }
            />

            {/* ── Latest readings table ── */}
            <section aria-label="Latest station readings">
              {/* Filter bar */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-storm/40">
                    Latest readings
                  </h2>
                  {activeFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-soft px-3 py-1 text-xs font-semibold text-sky-deep">
                      {FILTER_LABELS[activeFilter]}
                      <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className="inline-flex cursor-pointer rounded-full p-0.5 text-sky-deep/60 hover:text-sky-deep transition-colors"
                        aria-label="Clear filter"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-storm/40">
                    Showing {filteredStations.length} of {data.stations.length} stations
                  </span>
                  {data.stations.filter((s) => s.is_stale).length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      {data.stations.filter((s) => s.is_stale).length} stale
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs max-md:hidden">
                <table className="w-full table-fixed" role="table" aria-label="Station readings">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th
                        scope="col"
                        className="py-3.5 pl-5 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Station
                      </th>
                      <th
                        scope="col"
                        className="py-3.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="py-3.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Temp
                      </th>
                      <th
                        scope="col"
                        className="py-3.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Humidity
                      </th>
                      <th
                        scope="col"
                        className="py-3.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Rainfall
                      </th>
                      <th
                        scope="col"
                        className="py-3.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Wind
                      </th>
                      <th
                        scope="col"
                        className="py-3.5 pl-2 pr-5 text-left text-[11px] font-semibold uppercase tracking-wider text-storm/40"
                      >
                        Last seen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStations.map((station) => (
                      <StationStatusRow key={station.id} station={station} />
                    ))}
                  </tbody>
                </table>

                {/* Empty filter state */}
                {filteredStations.length === 0 && (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft">
                      <SignalIcon className="h-6 w-6 text-sky-primary" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-midnight">
                      No stations match this filter
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className="mt-2 text-xs font-medium text-sky-primary hover:text-sky-deep transition-colors cursor-pointer"
                    >
                      Show all stations
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredStations.map((station) => (
                  <StationStatusRow key={station.id} station={station} />
                ))}

                {filteredStations.length === 0 && (
                  <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-10 text-center">
                    <p className="text-sm font-medium text-midnight">No stations match</p>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className="mt-1 text-xs font-medium text-sky-primary hover:text-sky-deep transition-colors cursor-pointer"
                    >
                      Show all
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ── Bottom row: map + alerts ── */}
            <div className="grid gap-6 lg:grid-cols-2">
              <CompactMapPreview stations={data.stations} />
              <RecentAlertsPreview alerts={data.alerts} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
