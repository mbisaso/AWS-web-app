import { useCallback, useMemo, useState } from 'react'
import type { SensorType, ViewMode } from '../services/api'
import { SENSOR_CONFIG } from '../services/api'
import { useDashboardData } from '../hooks/useDashboardData'
import { fetchAnalysisData } from '../services/api'
import type { AnalysisDataResponse } from '../services/api'
import { usePollingData } from '../hooks/usePollingData'
import { Sidebar } from '../components/Sidebar'
import { AnalysisControls } from '../components/analysis/AnalysisControls'
import { StatSummaryCard } from '../components/analysis/StatSummaryCard'
import { TrendChart } from '../components/analysis/TrendChart'
import { ComparisonChart } from '../components/analysis/ComparisonChart'
import { CorrelationView } from '../components/analysis/CorrelationView'
import { DistributionChart } from '../components/analysis/DistributionChart'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function useAnalysisData(params: {
  sensorTypes: SensorType[]
  stationIds: number[]
  dateFrom: string
  dateTo: string
}) {
  return usePollingData<AnalysisDataResponse>(
    () => fetchAnalysisData(params),
    [params.sensorTypes.join(','), params.stationIds.join(','), params.dateFrom, params.dateTo],
  )
}

export function WeatherAnalysisPage() {
  const { data: dashData, isLoading: dashLoading } = useDashboardData()

  const [stationIds, setStationIds] = useState<number[]>([])
  const [sensorTypes, setSensorTypes] = useState<SensorType[]>(['temperature', 'humidity'])
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7))
  const [dateTo, setDateTo] = useState(() => today())
  const [viewMode, setViewMode] = useState<ViewMode>('trends')
  const [showMovingAverage, setShowMovingAverage] = useState(false)

  const stations = dashData?.stations ?? []

  const params = useMemo(
    () => ({ sensorTypes, stationIds, dateFrom, dateTo }),
    [sensorTypes, stationIds, dateFrom, dateTo],
  )

  const { data, isLoading, error, retry } = useAnalysisData(params)
  const readings = data?.readings ?? []
  const stats = data?.stats ?? {}

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const readingsBySensor = useMemo(() => {
    const map = new Map<SensorType, typeof readings>()
    for (const st of sensorTypes) {
      map.set(st, readings.filter((r) => r.sensor_type === st))
    }
    return map
  }, [readings, sensorTypes])

  const primarySensor = sensorTypes[0]
  const secondarySensor = sensorTypes.length > 1 ? sensorTypes[1] : sensorTypes[0]
  const primaryReadings = readingsBySensor.get(primarySensor) ?? []
  const secondaryReadings = readingsBySensor.get(secondarySensor) ?? []

  const viewPanels: ViewMode[] = ['trends', 'comparison', 'correlation', 'distribution']

  const dataLoading = isLoading && !readings.length

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <Sidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Weather Analysis</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Patterns &amp; comparisons
            </h1>
            <p className="text-sm text-white/50">
              {dashLoading
                ? 'Loading stations...'
                : `${stations.length} stations · ${sensorTypes.map((st) => SENSOR_CONFIG[st].label).join(', ')} · ${readings.length} readings`}
            </p>
          </div>
        </div>

        {/* ── Controls ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <AnalysisControls
            stations={stations}
            selectedStationIds={stationIds}
            onStationIdsChange={setStationIds}
            selectedSensorTypes={sensorTypes}
            onSensorTypesChange={setSensorTypes}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
              <p className="text-sm font-medium text-rose-700">Failed to load analysis data</p>
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

        {/* ── Summary stats cards ── */}
        <section aria-label="Summary statistics" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sensorTypes.map((st) => {
              const stationList = stationIds.length ? stationIds : stations.map((s) => s.id)
              return stationList.map((sid) => {
                const key = `${sid}:${st}`
                const stationName = stations.find((s) => s.id === sid)?.name ?? `Station ${sid}`
                return (
                  <StatSummaryCard
                    key={key}
                    stats={stats[key] ?? null}
                    sensorType={st}
                    stationName={stationName}
                    isLoading={dataLoading && !stats[key]}
                  />
                )
              })
            })}
          </div>
        </section>

        {/* ── Animated view panels ── */}
        <section aria-label="Analysis charts">
          <div className="relative">
            {viewPanels.map((mode) => {
              const isActive = mode === viewMode
              return (
                <div
                  key={mode}
                  className="transition-all duration-300 motion-reduce:transition-none"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateY(0)' : 'translateY(12px)',
                    pointerEvents: isActive ? 'auto' : 'none',
                    position: isActive ? 'relative' : 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: isActive ? 1 : 0,
                  }}
                  aria-hidden={!isActive}
                >
                  {mode === 'trends' && (
                    <TrendChart
                      readings={primaryReadings}
                      sensorType={primarySensor}
                      showMovingAverage={showMovingAverage}
                      onToggleMovingAverage={() => setShowMovingAverage((s) => !s)}
                      isLoading={dataLoading}
                    />
                  )}
                  {mode === 'comparison' && (
                    <ComparisonChart
                      readings={primaryReadings}
                      sensorType={primarySensor}
                      isLoading={dataLoading}
                    />
                  )}
                  {mode === 'correlation' && (
                    <CorrelationView
                      readingsA={readingsBySensor.get(sensorTypes[0]) ?? []}
                      readingsB={secondaryReadings}
                      sensorTypeA={sensorTypes[0]}
                      sensorTypeB={secondarySensor}
                      isLoading={dataLoading}
                    />
                  )}
                  {mode === 'distribution' && (
                    <DistributionChart
                      readings={primaryReadings}
                      sensorType={primarySensor}
                      isLoading={dataLoading}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── View-mode indicator (visually hidden description for screen readers) ── */}
        <div className="sr-only" role="status" aria-live="polite">
          Showing {viewMode} view with {sensorTypes.length} sensor type{sensorTypes.length !== 1 ? 's' : ''} across {stationIds.length || stations.length} stations
        </div>
      </main>
    </div>
  )
}
