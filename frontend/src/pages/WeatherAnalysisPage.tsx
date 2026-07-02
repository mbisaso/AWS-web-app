import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SensorMetricKey, Station, MetricReading } from '../types'
import { SENSOR_METRIC_CONFIG } from '../types'
import { fetchStations } from '../api/stations'
import { useAnalysisData } from '../hooks/useAnalysisData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { AnalysisControls } from '../components/analysis/AnalysisControls'
import { StatSummaryCard } from '../components/analysis/StatSummaryCard'
import { TrendChart } from '../components/analysis/TrendChart'
import { ComparisonChart } from '../components/analysis/ComparisonChart'
import { CorrelationView } from '../components/analysis/CorrelationView'
import { DistributionChart } from '../components/analysis/DistributionChart'

type ViewMode = 'trends' | 'comparison' | 'correlation' | 'distribution'
const VIEW_MODES: ViewMode[] = ['trends', 'comparison', 'correlation', 'distribution']

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeatherAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stations, setStations] = useState<Station[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .finally(() => setStationsLoading(false))
  }, [])

  const urlStations = searchParams.get('stations')
  const urlMetric = searchParams.get('metric') as SensorMetricKey | null
  const urlCorrB = searchParams.get('corrB') as SensorMetricKey | null
  const urlDateFrom = searchParams.get('from')
  const urlDateTo = searchParams.get('to')
  const urlView = searchParams.get('view') as ViewMode | null
  const urlMovAvg = searchParams.get('movAvg')

  const [stationIds, setStationIds] = useState<string[]>(
    urlStations ? urlStations.split(',').filter(Boolean) : [],
  )
  const [metricKey, setMetricKey] = useState<SensorMetricKey>(
    urlMetric && urlMetric in SENSOR_METRIC_CONFIG ? urlMetric : 'temperature',
  )
  const [correlationMetricB, setCorrelationMetricB] = useState<SensorMetricKey>(
    urlCorrB && urlCorrB in SENSOR_METRIC_CONFIG ? urlCorrB : 'humidity',
  )
  const [dateFrom, setDateFrom] = useState(urlDateFrom ?? daysAgo(7))
  const [dateTo, setDateTo] = useState(urlDateTo ?? today())
  const [viewMode, setViewMode] = useState<ViewMode>(
    urlView && VIEW_MODES.includes(urlView) ? urlView : 'trends',
  )
  const [showMovingAverage, setShowMovingAverage] = useState(urlMovAvg === '1')

  const hours = useMemo(
    () => Math.max(1, Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 3600000)),
    [dateFrom, dateTo],
  )

  /* ── Sync state to URL ── */
  useEffect(() => {
    const next = new URLSearchParams()
    if (stationIds.length > 0) next.set('stations', stationIds.join(','))
    if (metricKey !== 'temperature') next.set('metric', metricKey)
    if (correlationMetricB !== 'humidity') next.set('corrB', correlationMetricB)
    if (dateFrom !== daysAgo(7)) next.set('from', dateFrom)
    if (dateTo !== today()) next.set('to', dateTo)
    if (viewMode !== 'trends') next.set('view', viewMode)
    if (showMovingAverage) next.set('movAvg', '1')
    setSearchParams(next, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationIds.join(','), metricKey, correlationMetricB, dateFrom, dateTo, viewMode, showMovingAverage])

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const { readings, stats, isLoading, error, retry } = useAnalysisData({
    stationIds,
    allStations: stations,
    hours,
  })

  const metricReadings = useMemo<MetricReading[]>(() => {
    const out: MetricReading[] = []
    for (const r of readings) {
      const v = r[metricKey]
      if (v !== null) {
        out.push({ station_id: r.stationId, station_name: r.stationName, timestamp: r.timestamp, value: v })
      }
    }
    return out
  }, [readings, metricKey])

  const visibleStations = stationIds.length
    ? stations.filter((s) => stationIds.includes(s.station_id))
    : stations

  const dataLoading = isLoading && !readings.length
  const viewPanels: ViewMode[] = ['trends', 'comparison', 'correlation', 'distribution']

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Weather Analysis</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              Patterns &amp; comparisons
            </h1>
            <p className="text-sm text-white/50">
              {stationsLoading
                ? 'Loading stations...'
                : `${visibleStations.length} stations · ${SENSOR_METRIC_CONFIG[metricKey].label} · ${readings.length} readings`}
            </p>
          </div>
        </div>

        {/* ── Controls ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <AnalysisControls
            stations={stations}
            selectedStationIds={stationIds}
            onStationIdsChange={setStationIds}
            selectedMetricKey={metricKey}
            onMetricKeyChange={setMetricKey}
            correlationMetricB={correlationMetricB}
            onCorrelationMetricBChange={setCorrelationMetricB}
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
            {visibleStations.map((station) => {
              const key = `${station.station_id}:${metricKey}`
              return (
                <StatSummaryCard
                  key={key}
                  stats={stats[key] ?? null}
                  metricKey={metricKey}
                  stationName={station.name}
                  isLoading={dataLoading && !stats[key]}
                />
              )
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
                      readings={metricReadings}
                      metricKey={metricKey}
                      showMovingAverage={showMovingAverage}
                      onToggleMovingAverage={() => setShowMovingAverage((s) => !s)}
                      isLoading={dataLoading}
                    />
                  )}
                  {mode === 'comparison' && (
                    <ComparisonChart
                      readings={metricReadings}
                      metricKey={metricKey}
                      isLoading={dataLoading}
                    />
                  )}
                  {mode === 'correlation' && (
                    <CorrelationView
                      readings={readings}
                      metricKeyA={metricKey}
                      metricKeyB={correlationMetricB}
                      isLoading={dataLoading}
                    />
                  )}
                  {mode === 'distribution' && (
                    <DistributionChart
                      readings={metricReadings}
                      metricKey={metricKey}
                      isLoading={dataLoading}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <div className="sr-only" role="status" aria-live="polite">
          Showing {viewMode} view for {SENSOR_METRIC_CONFIG[metricKey].label} across {visibleStations.length} stations
        </div>
      </main>
    </div>
  )
}
