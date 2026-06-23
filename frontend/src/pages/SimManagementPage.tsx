import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SimManagementData, SimFleetSummary } from '../services/api'
import { fetchSimManagementData, topUpSim, fetchAlertsData } from '../services/api'
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

  /* ── Detail panel state ── */
  const [selectedSim, setSelectedSim] = useState<SimManagementData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
              isLoading={detailLoading}
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
