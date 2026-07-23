import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PowerMetricKey, Station } from '../types'
import { POWER_METRIC_CONFIG } from '../types'
import { fetchStations } from '../api/stations'
import { usePowerData } from '../hooks/usePowerData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { PowerStationSelector } from '../components/powerData/PowerStationSelector'
import { PowerStatusCard } from '../components/powerData/PowerStatusCard'
import { PowerHistoricalChart } from '../components/powerData/PowerHistoricalChart'
import { PowerReadingsTable } from '../components/powerData/PowerReadingsTable'
import { PowerSummaryCharts } from '../components/powerData/PowerSummaryCharts'

const SECONDARY_MAP: Partial<Record<PowerMetricKey, PowerMetricKey>> = {
  volt_batt:  'volt_solar',
  volt_solar: 'curr_solar',
  curr_batt:  'curr_solar',
  curr_solar: 'volt_solar',
  volt_3v3:   'volt_5v',
  volt_5v:    'volt_3v3',
  volt_dc:    'volt_batt',
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PowerDataPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stations, setStations] = useState<Station[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .finally(() => setStationsLoading(false))
  }, [])

  const urlStation = searchParams.get('station')
  const urlMetric = searchParams.get('metric') as PowerMetricKey | null
  const urlDateFrom = searchParams.get('from')
  const urlDateTo = searchParams.get('to')
  const urlSecondary = searchParams.get('secondary')

  const [stationId, setStationId] = useState<string | null>(urlStation)
  const [metric, setMetric] = useState<PowerMetricKey>(
    urlMetric && urlMetric in POWER_METRIC_CONFIG ? urlMetric : 'volt_batt',
  )
  const [dateFrom, setDateFrom] = useState(urlDateFrom ?? daysAgo(7))
  const [dateTo, setDateTo] = useState(urlDateTo ?? today())
  const [showSecondary, setShowSecondary] = useState(urlSecondary === '1')

  const hours = useMemo(
    () => Math.max(1, Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 3600000)),
    [dateFrom, dateTo],
  )

  const { data: readings, isLoading, error, retry } = usePowerData({ stationId, hours })

  const currentReading = readings.length ? readings[readings.length - 1] : null
  const secondaryKey = SECONDARY_MAP[metric] ?? null

  /* ── Sync state to URL ── */
  useEffect(() => {
    const next = new URLSearchParams()
    if (stationId) next.set('station', stationId)
    if (metric !== 'volt_batt') next.set('metric', metric)
    if (dateFrom !== daysAgo(7)) next.set('from', dateFrom)
    if (dateTo !== today()) next.set('to', dateTo)
    if (showSecondary) next.set('secondary', '1')
    setSearchParams(next, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, metric, dateFrom, dateTo, showSecondary])

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const chartIsLoading = isLoading && !readings.length

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Power Data</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Power system telemetry
            </h1>
            <p className="text-sm text-white/50">
              {stationsLoading
                ? 'Loading stations...'
                : `${stations.length} stations · ${POWER_METRIC_CONFIG[metric].label} · ${readings.length} readings`}
            </p>
          </div>
        </div>

        {/* ── Station & metric selector ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <PowerStationSelector
            stations={stations}
            selectedStationId={stationId}
            onStationChange={setStationId}
            selectedMetric={metric}
            onMetricChange={(m) => { setMetric(m); setShowSecondary(false) }}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
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
              <p className="text-sm font-medium text-rose-700">Failed to load power data</p>
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

        {/* ── Current status cards ── */}
        <section aria-label="Current power status" className="mb-6">
          <PowerStatusCard
            reading={currentReading}
            isLoading={isLoading && !currentReading}
          />
        </section>

        {/* ── Historical chart ── */}
        <section aria-label="Historical chart" className="mb-6">
          <PowerHistoricalChart
            readings={readings}
            primaryKey={metric}
            secondaryKey={secondaryKey}
            showSecondary={showSecondary}
            onToggleSecondary={() => setShowSecondary((s) => !s)}
            isLoading={chartIsLoading}
          />
        </section>

        {/* ── Readings table ── */}
        <section aria-label="Power readings data table">
          <PowerReadingsTable
            readings={readings}
            metricKey={metric}
            isLoading={chartIsLoading}
          />
        </section>

        {/* ── Summary charts ── */}
        <section aria-label="Power summary" className="mt-6">
          <PowerSummaryCharts
            readings={readings}
            metricKey={metric}
            isLoading={chartIsLoading}
          />
        </section>
      </main>
    </div>
  )
}
