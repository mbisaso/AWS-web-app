import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SimManagementData, SimFleetSummary } from '../services/api'
import {
  clearAllDismissedAlerts,
  dismissAlert,
  fetchSimManagementData,
  generateSimAlerts,
  loadDismissedAlertIds,
  publishSimAlertCount,
  sendSimEmailAlert,
  topUpSim,
} from '../services/api'
import { usePollingData } from '../hooks/usePollingData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { SimFleetSummaryCard } from '../components/simManagement/SimFleetSummaryCard'
import { SimTable } from '../components/simManagement/SimTable'
import { SimDetailPanel } from '../components/simManagement/SimDetailPanel'
import { TopUpForm } from '../components/simManagement/TopUpForm'

export function SimManagementPage() {
  /* ── URL-synced filter ── */
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFilter = searchParams.get('filter') as 'all' | 'expiring' | 'expired' | null

  const [activeFilter, setActiveFilter] = useState<'all' | 'expiring' | 'expired'>(
    urlFilter ?? 'all',
  )

  /* ── Data fetching ── */
  const { data, isLoading, error, retry } = usePollingData(
    () => fetchSimManagementData(),
    ['sim-management'],
    30_000,
  )

  const sims = data?.sims ?? []
  const summary: SimFleetSummary = data?.summary ?? {
    total_active: 0,
    expiring_soon_count: 0,
    expiring_soon_threshold_days: 7,
    expired_count: 0,
    total_remaining_mb: 0,
  }

  /* ── SIM alerts ── */
  const simAlerts = useMemo(() => generateSimAlerts(sims), [sims])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(loadDismissedAlertIds)
  const [emailLog, setEmailLog] = useState<{ alert_id: number; sent_at: string }[]>([])

  /* Only count alerts that haven't been dismissed */
  const undismissedCount = useMemo(
    () => simAlerts.filter((a) => !dismissedAlerts.has(a.id)).length,
    [simAlerts, dismissedAlerts],
  )

  const visibleAlerts = useMemo(
    () => simAlerts.filter((a) => !dismissedAlerts.has(a.id)),
    [simAlerts, dismissedAlerts],
  )

  /* Publish badge count for the sidebar — only undismissed alerts */
  useEffect(() => {
    publishSimAlertCount(undismissedCount)
  }, [undismissedCount])

  const handleDismissAlert = useCallback((alertId: number) => {
    const updated = dismissAlert(alertId)
    setDismissedAlerts(new Set(updated))
  }, [])

  const handleDismissAll = useCallback(() => {
    clearAllDismissedAlerts()
    setDismissedAlerts(new Set())
  }, [])

  const handleSendEmail = useCallback(async (alertId: number) => {
    const alert = simAlerts.find((a) => a.id === alertId)
    if (!alert) return
    sendSimEmailAlert(alert)
    setEmailLog((prev) => [...prev, { alert_id: alertId, sent_at: new Date().toISOString() }])
  }, [simAlerts])

  /* ── Detail panel state ── */
  const [selectedSim, setSelectedSim] = useState<SimManagementData | null>(null)

  const handleSelectSim = useCallback((s: SimManagementData) => {
    setSelectedSim(s)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedSim(null)
  }, [])

  /* ── Top-up state ── */
  const [topUpTarget, setTopUpTarget] = useState<SimManagementData | null>(null)
  const [topUpResult, setTopUpResult] = useState<{ simId: number; newRemaining: number } | null>(null)

  const handleTopUp = useCallback(async (amountMb: number, note: string) => {
    if (!topUpTarget) return
    const updated = await topUpSim(topUpTarget.sim.id, amountMb, note)
    setTopUpResult({ simId: updated.sim.id, newRemaining: updated.sim.bundle_size_mb - updated.sim.usage_mb })
    setTopUpTarget(null)
    /* Update selected SIM if it was the one topped up */
    if (selectedSim?.sim.id === updated.sim.id) {
      setSelectedSim(updated)
    }
    /* Clear success toast after a few seconds */
    setTimeout(() => setTopUpResult(null), 4000)
  }, [topUpTarget, selectedSim])

  /* ── Filter from URL ── */
  const handleFilterChange = useCallback((filter: 'all' | 'expiring' | 'expired') => {
    const next = activeFilter === filter ? 'all' : filter
    setActiveFilter(next)
    setSearchParams(next === 'all' ? {} : { filter: next }, { replace: true })
  }, [activeFilter, setSearchParams])

  /* ── Sync filter from URL on mount ── */
  useEffect(() => {
    if (urlFilter && ['all', 'expiring', 'expired'].includes(urlFilter)) {
      setActiveFilter(urlFilter)
    }
  }, [urlFilter])

  const dataLoading = isLoading && !sims.length

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight via-[#1a2a4a] to-sky-deep/30 p-6 shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-sky-primary/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-emerald-400/8 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <svg className="h-5 w-5 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="7" width="16" height="10" rx="2" />
                <path d="M4 11h16" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Connectivity</p>
            </div>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              SIM &amp; Data Bundle Management
            </h1>
            <p className="text-sm text-white/50">
              Monitor data usage, projected depletion, and top up bundles across the fleet
            </p>
          </div>
          <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-sky-400/20 to-transparent" aria-hidden="true" />
        </div>

        {/* ── Fleet summary cards ── */}
        <section aria-label="Fleet summary" className="mb-6">
          <SimFleetSummaryCard
            summary={summary}
            isLoading={dataLoading}
            activeFilter={activeFilter}
            onFilter={handleFilterChange}
          />
        </section>

        {/* ── Success toast ── */}
        {topUpResult && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 shadow-xs animate-fade-in-up motion-reduce:animate-none" role="status" aria-live="polite">
            <svg className="h-5 w-5 shrink-0 text-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
            <p className="text-sm font-medium text-emerald-700">
              Top-up successful. Remaining: {topUpResult.newRemaining.toLocaleString()} MB.
            </p>
            <button
              type="button"
              onClick={() => setTopUpResult(null)}
              className="ml-auto cursor-pointer rounded-lg p-1 text-emerald-600 transition-colors hover:bg-emerald-100"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="ml-auto shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── SIM alert notifications ── */}
        {visibleAlerts.length > 0 && (
          <section aria-label="SIM alerts" className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
                {undismissedCount} unhandled SIM notification{undismissedCount !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={handleDismissAll}
                className="cursor-pointer rounded-lg bg-white px-3 py-1 text-[10px] font-semibold text-storm/50 shadow-xs transition-colors hover:bg-slate-100 hover:text-storm/70"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-3">
            {visibleAlerts.map((alert) => {
              const isCritical = alert.severity === 'critical'
              const isExpiry = alert.type === 'sim_expiry'
              const emailSent = emailLog.find((e) => e.alert_id === alert.id)

              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 shadow-xs animate-fade-in-up motion-reduce:animate-none ${
                    isCritical
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                  role="alert"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-xs">
                    {isExpiry ? (
                      <svg className={`h-4 w-4 ${isCritical ? 'text-rose' : 'text-amber'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    ) : (
                      <svg className={`h-4 w-4 ${isCritical ? 'text-rose' : 'text-amber'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <path d="M12 9v4" />
                        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${isCritical ? 'text-rose-800' : 'text-amber-800'}`}>
                      {alert.station_name}
                    </p>
                    <p className={`mt-0.5 text-xs ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
                      {alert.message}
                    </p>
                    {alert.explanation && (
                      <p className={`mt-1 text-[11px] ${isCritical ? 'text-rose-600/60' : 'text-amber-600/60'}`}>
                        {alert.explanation}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDismissAlert(alert.id)}
                        className="cursor-pointer rounded-lg bg-white px-3 py-1 text-[10px] font-semibold text-storm/60 shadow-xs transition-colors hover:bg-slate-100 hover:text-storm/80"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendEmail(alert.id)}
                        className="cursor-pointer rounded-lg bg-white px-3 py-1 text-[10px] font-semibold text-sky-deep shadow-xs transition-colors hover:bg-sky-soft"
                      >
                        {emailSent ? 'Email sent' : 'Send email alert'}
                      </button>
                      {alert.related_url && (
                        <a
                          href={alert.related_url}
                          className="text-[10px] font-medium text-sky-deep underline underline-offset-2 transition-colors hover:text-sky-primary"
                        >
                          View in Alerts Center →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isCritical
                        ? 'bg-rose-200 text-rose-700'
                        : 'bg-amber-200 text-amber-700'
                    }`}>
                      {isExpiry ? 'Expiry' : 'Low Data'}
                    </span>
                    {emailSent && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Notified
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
          </section>
        )}

        {/* ── SIM table ── */}
        <section aria-label="SIM list" className="mb-6">
          <SimTable
            sims={sims}
            isLoading={dataLoading}
            activeFilter={activeFilter}
            selectedSimId={selectedSim?.sim.id ?? null}
            onSelect={handleSelectSim}
            onTopUp={(s) => setTopUpTarget(s)}
            onRefresh={retry}
          />
        </section>

        {/* ── Detail panel ── */}
        {selectedSim && (
          <section aria-label="SIM detail" className="mb-6">
            <SimDetailPanel
              data={selectedSim}
              isLoading={dataLoading}
              onTopUp={() => setTopUpTarget(selectedSim)}
              onClose={handleCloseDetail}
            />
          </section>
        )}

        {/* ── Scroll anchor for new data ── */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {sims.length > 0 && `Loaded ${sims.length} SIM${sims.length !== 1 ? 's' : ''}`}
        </div>
      </main>

      {/* ── Top-up modal ── */}
      <TopUpForm
        open={!!topUpTarget}
        onConfirm={handleTopUp}
        onCancel={() => setTopUpTarget(null)}
      />
    </div>
  )
}
