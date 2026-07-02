import { useEffect, useState } from 'react'
import type { PowerChart, PowerMetricKey } from '../types'
import { POWER_METRIC_CONFIG } from '../types'
import { fetchThingSpeakPower } from '../api/thingspeak'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { PowerHistoricalChart } from '../components/powerData/PowerHistoricalChart'
import { PowerStatusCard } from '../components/powerData/PowerStatusCard'

const DEMO_METRICS: PowerMetricKey[] = ['volt_batt', 'volt_solar', 'volt_3v3', 'volt_5v', 'volt_dc']

export function ThingSpeakDemoPage() {
  const [readings, setReadings] = useState<PowerChart[]>([])
  const [metric, setMetric] = useState<PowerMetricKey>('volt_batt')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    fetchThingSpeakPower()
      .then(setReadings)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const latestReading = readings.length ? readings[readings.length - 1] : null
  const RECENT_COUNT = 100
  const recentReadings = readings.slice(-RECENT_COUNT)

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Live Demo · ThingSpeak</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              AWS Power Rails A
            </h1>
            <p className="text-sm text-white/50">
              {loading
                ? 'Loading readings…'
                : error
                ? 'Failed to load'
                : `Showing ${recentReadings.length} most recent of ${readings.length} readings · Channel 3304681`}
            </p>
          </div>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <svg
              className="h-5 w-5 shrink-0 text-rose-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-700">Failed to load ThingSpeak data</p>
              <p className="text-xs text-rose-500/70">{error}</p>
            </div>
            <button
              type="button"
              onClick={load}
              className="shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Current status cards ── */}
        <section aria-label="Current power status" className="mb-6">
          <PowerStatusCard reading={latestReading} isLoading={loading && !latestReading} />
        </section>

        {/* ── Metric tabs ── */}
        <div className="mb-4 flex flex-wrap gap-2">
          {DEMO_METRICS.map((key) => {
            const cfg = POWER_METRIC_CONFIG[key]
            const active = key === metric
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-midnight text-white shadow-sm'
                    : 'bg-white text-storm/60 border border-slate-200 hover:border-slate-300 hover:text-storm'
                }`}
                style={active ? { backgroundColor: cfg.color } : undefined}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* ── Historical chart ── */}
        <section aria-label="Historical chart" className="mb-6">
          <PowerHistoricalChart
            readings={recentReadings}
            primaryKey={metric}
            isLoading={loading && !readings.length}
          />
        </section>
      </main>
    </div>
  )
}
