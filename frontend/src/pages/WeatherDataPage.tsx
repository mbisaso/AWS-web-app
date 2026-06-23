import { useCallback, useMemo, useState } from 'react'
import type { SensorType } from '../services/api'
import { SENSOR_CONFIG } from '../services/api'
import { useDashboardData } from '../hooks/useDashboardData'
import { useWeatherData } from '../hooks/useWeatherData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StationSensorSelector } from '../components/weatherData/StationSensorSelector'
import { ReadingSummaryCard } from '../components/weatherData/ReadingSummaryCard'
import { HistoricalChart } from '../components/weatherData/HistoricalChart'
import { ReadingsTable } from '../components/weatherData/ReadingsTable'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const SENSOR_TYPES = Object.keys(SENSOR_CONFIG) as SensorType[]

export function WeatherDataPage() {
  const { data: dashData, isLoading: dashLoading } = useDashboardData()

  const [stationId, setStationId] = useState<number | null>(null)
  const [sensorType, setSensorType] = useState<SensorType>('temperature')
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7))
  const [dateTo, setDateTo] = useState(() => today())

  const stations = dashData?.stations ?? []

  const weatherParams = useMemo(
    () => ({ stationId, sensorType, dateFrom, dateTo }),
    [stationId, sensorType, dateFrom, dateTo],
  )

  const { data: weatherData, isLoading: weatherLoading, error, retry } = useWeatherData(weatherParams)

  const currentReadings = useMemo(() => {
    if (!weatherData) return null
    return weatherData.current
  }, [weatherData])

  const readings = weatherData?.readings ?? []

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
              {dashLoading
                ? 'Loading stations...'
                : `${stations.length} stations · ${sensorType} · ${readings.length} readings`}
            </p>
          </div>
        </div>

        {/* ── Station & sensor selector ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <StationSensorSelector
            stations={stations}
            selectedStationId={stationId}
            onStationChange={setStationId}
            selectedSensor={sensorType}
            onSensorChange={setSensorType}
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

        {/* ── Current reading summary cards ── */}
        <section aria-label="Current readings" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {SENSOR_TYPES.map((st) => (
              <ReadingSummaryCard
                key={st}
                sensorType={st}
                reading={currentReadings?.[st] ?? undefined}
                isLoading={weatherLoading && !currentReadings}
              />
            ))}
          </div>
        </section>

        {/* ── Historical chart ── */}
        <section aria-label="Historical chart" className="mb-6">
          <HistoricalChart
            readings={readings}
            sensorType={sensorType}
            isLoading={weatherLoading && !readings.length}
          />
        </section>

        {/* ── Readings table ── */}
        <section aria-label="Readings data table">
          <ReadingsTable
            readings={readings}
            sensorType={sensorType}
            isLoading={weatherLoading && !readings.length}
          />
        </section>
      </main>
    </div>
  )
}
