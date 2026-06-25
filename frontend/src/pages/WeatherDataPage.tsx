import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SensorMetricKey, SensorReadingChart, Station } from '../types'
import { SENSOR_METRIC_CONFIG } from '../types'
import { fetchStations } from '../api/stations'
import { useWeatherData } from '../hooks/useWeatherData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StationSensorSelector } from '../components/weatherData/StationSensorSelector'
import { ReadingSummaryCard } from '../components/weatherData/ReadingSummaryCard'
import { HistoricalChart } from '../components/weatherData/HistoricalChart'
import { ReadingsTable } from '../components/weatherData/ReadingsTable'

const SENSOR_METRICS = Object.keys(SENSOR_METRIC_CONFIG) as SensorMetricKey[]

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ── Sub-component: rendered only when a station is selected ── */
function WeatherContent({
  stationId,
  metricKey,
  hours,
}: {
  stationId: string
  metricKey: SensorMetricKey
  hours: number
}) {
  const { data: readings, isLoading, error, retry } = useWeatherData({ stationId, hours })
  const lastReading: SensorReadingChart | null = readings.length ? readings[readings.length - 1] : null
  const chartIsLoading = isLoading && !readings.length

  return (
    <>
      {/* ── Error state ── */}
      {error && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-rose-700">Failed to load readings</p>
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

      {/* ── Summary cards — one per sensor field ── */}
      <section aria-label="Current readings" className="mb-6">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {SENSOR_METRICS.map((mk) => (
            <ReadingSummaryCard
              key={mk}
              metricKey={mk}
              value={lastReading?.[mk] ?? null}
              isLoading={isLoading && !lastReading}
            />
          ))}
        </div>
      </section>

      {/* ── Historical chart ── */}
      <section aria-label="Historical chart" className="mb-6">
        <HistoricalChart
          readings={readings}
          metricKey={metricKey}
          isLoading={chartIsLoading}
        />
      </section>

      {/* ── Readings table ── */}
      <section aria-label="Readings data table">
        <ReadingsTable
          readings={readings}
          metricKey={metricKey}
          isLoading={chartIsLoading}
        />
      </section>
    </>
  )
}

/* ── Main page ── */
export function WeatherDataPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .finally(() => setStationsLoading(false))
  }, [])

  const [stationId, setStationId] = useState<string | null>(null)
  const [metricKey, setMetricKey] = useState<SensorMetricKey>('temperature')
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7))
  const [dateTo, setDateTo] = useState(() => today())

  const hours = useMemo(
    () => Math.max(1, Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 3600000)),
    [dateFrom, dateTo],
  )

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Weather Data</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Detailed readings
            </h1>
            <p className="text-sm text-white/50">
              {stationsLoading ? 'Loading stations...' : `${stations.length} stations · ${SENSOR_METRIC_CONFIG[metricKey].label}`}
            </p>
          </div>
        </div>

        {/* ── Station & sensor selector ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <StationSensorSelector
            stations={stations}
            selectedStationId={stationId}
            onStationChange={setStationId}
            selectedMetric={metricKey}
            onMetricChange={setMetricKey}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
          />
        </section>

        {/* ── Data or prompt ── */}
        {stationId ? (
          <WeatherContent
            stationId={stationId}
            metricKey={metricKey}
            hours={hours}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20">
            <svg className="mb-4 h-12 w-12 text-storm/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <p className="text-sm font-semibold text-storm/50">Select a station to view readings</p>
            <p className="mt-1 text-xs text-storm/30">Choose a station from the dropdown above to load sensor data.</p>
          </div>
        )}
      </main>
    </div>
  )
}
