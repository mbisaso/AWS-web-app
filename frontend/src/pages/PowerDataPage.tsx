import { useCallback, useMemo, useState } from 'react'
import type { PowerMetricType } from '../services/api'
import { POWER_METRIC_CONFIG } from '../services/api'
import { useDashboardData } from '../hooks/useDashboardData'
import { usePowerData } from '../hooks/usePowerData'
import { Sidebar } from '../components/Sidebar'
import { PowerStationSelector } from '../components/powerData/PowerStationSelector'
import { PowerStatusCard } from '../components/powerData/PowerStatusCard'
import { PowerHistoricalChart } from '../components/powerData/PowerHistoricalChart'
import { PowerReadingsTable } from '../components/powerData/PowerReadingsTable'
import { PowerSummaryCharts } from '../components/powerData/PowerSummaryCharts'

const SECONDARY_MAP: Partial<Record<PowerMetricType, PowerMetricType>> = {
  battery_level: 'voltage',
  voltage: 'solar_input',
  current_draw: 'solar_input',
  solar_input: 'voltage',
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
  const { data: dashData, isLoading: dashLoading } = useDashboardData()

  const [stationId, setStationId] = useState<number | null>(null)
  const [metric, setMetric] = useState<PowerMetricType>('battery_level')
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7))
  const [dateTo, setDateTo] = useState(() => today())
  const [showSecondary, setShowSecondary] = useState(false)

  const stations = dashData?.stations ?? []

  const primaryParams = useMemo(
    () => ({ stationId, metric, dateFrom, dateTo }),
    [stationId, metric, dateFrom, dateTo],
  )

  const secondaryMetric = SECONDARY_MAP[metric]

  const secondaryParams = useMemo(
    () => secondaryMetric ? { stationId, metric: secondaryMetric, dateFrom, dateTo } : null,
    [stationId, secondaryMetric, dateFrom, dateTo],
  )

  const { data: powerData, isLoading, error, retry } = usePowerData(primaryParams)
  const { data: secondaryData } = usePowerData(secondaryParams ?? primaryParams)

  const currentReading = powerData?.current ?? null
  const readings = powerData?.readings ?? []
  const secondaryReadings = showSecondary && secondaryData ? secondaryData.readings : []

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const secondaryConfig = secondaryMetric ? POWER_METRIC_CONFIG[secondaryMetric] : null

  const chartIsLoading = isLoading && !readings.length

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <Sidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Power Data</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Power system telemetry
            </h1>
            <p className="text-sm text-white/50">
              {dashLoading
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

        {/* ── Error state (scoped) ── */}
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

        {/* ── Current power status summary cards ── */}
        <section aria-label="Current power status" className="mb-6">
          <PowerStatusCard
            reading={currentReading}
            isLoading={isLoading && !currentReading}
          />
        </section>

        {/* ── Historical chart ── */}
        <section aria-label="Historical chart" className="mb-6">
          <PowerHistoricalChart
            primary={{ metric, readings: readings as any, color: POWER_METRIC_CONFIG[metric].color }}
            secondary={secondaryConfig && secondaryReadings.length ? {
              metric: secondaryMetric!,
              readings: secondaryReadings as any,
              color: secondaryConfig.color,
            } : null}
            showSecondary={showSecondary}
            onToggleSecondary={() => setShowSecondary((s) => !s)}
            isLoading={chartIsLoading}
          />
        </section>

        {/* ── Readings table ── */}
        <section aria-label="Power readings data table">
          <PowerReadingsTable
            readings={readings}
            metric={metric}
            isLoading={chartIsLoading}
          />
        </section>

        {/* ── Summary charts (cross-station overview) ── */}
        <section aria-label="Power summary" className="mt-6">
          <PowerSummaryCharts
            readings={readings}
            metric={metric}
            isLoading={chartIsLoading}
          />
        </section>
      </main>
    </div>
  )
}
