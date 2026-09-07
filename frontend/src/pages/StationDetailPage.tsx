import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  PowerMetricKey,
  SensorMetricKey,
  SensorReadingChart,
  SensorReadingLatest,
  Station,
  StationOperationalStatus,
} from '../types'
import { POWER_METRIC_CONFIG, SENSOR_METRIC_CONFIG } from '../types'
import { deriveHealth, healthBadge, reasonMeta } from '../utils/sensorHealth'
import { useStationDetail } from '../hooks/useStationDetail'
import { useWeatherData } from '../hooks/useWeatherData'
import { usePowerData } from '../hooks/usePowerData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { ReadingSummaryCard } from '../components/weatherData/ReadingSummaryCard'
import { HistoricalChart } from '../components/weatherData/HistoricalChart'
import { ReadingsTable } from '../components/weatherData/ReadingsTable'
import { PowerStatusCard } from '../components/powerData/PowerStatusCard'
import { PowerHistoricalChart } from '../components/powerData/PowerHistoricalChart'
import { PowerReadingsTable } from '../components/powerData/PowerReadingsTable'
import { PowerSummaryCharts } from '../components/powerData/PowerSummaryCharts'
import { DateRangePicker } from '../components/shared/DateRangePicker'

type DetailTab = 'overview' | 'weather' | 'power'

const SENSOR_METRICS = Object.keys(SENSOR_METRIC_CONFIG) as SensorMetricKey[]
const POWER_METRICS = Object.keys(POWER_METRIC_CONFIG) as PowerMetricKey[]

const STATUS_BADGE: Record<StationOperationalStatus, string> = {
  full: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  down: 'bg-rose-50 text-rose-700',
}

const STATUS_LABEL: Record<StationOperationalStatus, string> = {
  full: 'Online',
  partial: 'Partial',
  down: 'Down',
}

const POWER_SECONDARY: Partial<Record<PowerMetricKey, PowerMetricKey>> = {
  volt_batt:    'volt_solar',
  volt_solar:   'curr_solar',
  curr_batt:    'curr_solar',
  curr_solar:   'volt_solar',
  battery_temp: 'volt_batt',
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatValue(value: number | null | undefined, unit: string, digits = 1): string {
  if (value == null) return '—'
  return `${value.toFixed(digits)}${unit}`
}

function DetailTabBar({
  active,
  onChange,
}: {
  active: DetailTab
  onChange: (tab: DetailTab) => void
}) {
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'weather', label: 'Weather data' },
    { id: 'power', label: 'Power data' },
  ]

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-px" role="tablist" aria-label="Station detail sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`cursor-pointer rounded-t-xl px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tab.id
              ? 'border border-b-white border-slate-200 bg-white text-midnight -mb-px'
              : 'text-storm/50 hover:text-midnight hover:bg-slate-50'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function OverviewTab({
  station,
  latest,
  onNavigateTab,
}: {
  station: Station
  latest: SensorReadingLatest | null
  onNavigateTab: (tab: DetailTab) => void
}) {
  const status = station.status?.status ?? 'down'
  const health = deriveHealth(station)
  const badge = healthBadge(health)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.tone}`}>
          {badge.label}
        </span>
        {station.status?.computed_by && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            via {station.status.computed_by.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Location" value={station.location || '—'} />
        <InfoCard
          label="Coordinates"
          value={
            station.latitude != null && station.longitude != null
              ? `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`
              : '—'
          }
        />
        <InfoCard label="Expected interval" value={`${station.expected_interval_minutes} min`} />
        <InfoCard label="Phone number" value={station.phone_number || '—'} />
        <InfoCard
          label="Registered"
          value={new Date(station.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        />
        <InfoCard
          label="Last updated"
          value={
            station.status?.last_updated
              ? new Date(station.status.last_updated).toLocaleString()
              : '—'
          }
        />
      </div>

      {station.sensors.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Installed sensors</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {station.sensors.map((sensor) => (
              <span
                key={sensor}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-storm/70"
              >
                {sensor}
              </span>
            ))}
          </div>
        </section>
      )}

      {station.notes && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Notes</h3>
          <p className="mt-2 text-sm leading-relaxed text-storm/80">{station.notes}</p>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Sensor health</h3>
          {health.asOf && (
            <span className="text-[11px] text-slate-400">
              analysed {new Date(health.asOf).toLocaleString()}
            </span>
          )}
        </div>

        {!health.hasData ? (
          <p className="mt-3 text-sm text-storm/50">
            No sensor diagnosis yet — the detector needs about 6 hours of recent
            readings before it can score this station.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-storm/70">
              {health.summary === 'ok'
                ? `All ${health.scoredCount} monitored sensors are transmitting normally.`
                : `${health.faultyCount} of ${health.scoredCount} sensors need attention.`}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {health.sensors.map((s) => {
                const meta = reasonMeta(s.reason)
                return (
                  <div
                    key={s.key}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                      s.ok ? 'border-slate-200 bg-[#f8fafc]' : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <span className="text-sm font-medium text-midnight">{s.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
                      {s.ok ? 'OK' : meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Latest readings</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('weather')}
              className="cursor-pointer text-xs font-semibold text-sky-primary hover:text-sky-deep"
            >
              View weather data →
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('power')}
              className="cursor-pointer text-xs font-semibold text-sky-primary hover:text-sky-deep"
            >
              View power data →
            </button>
          </div>
        </div>

        {latest ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReadingItem label="Temperature" value={formatValue(latest.temperature, '°C')} />
            <ReadingItem label="Humidity" value={formatValue(latest.humidity, '%', 0)} />
            <ReadingItem label="Pressure" value={formatValue(latest.pressure, ' hPa')} />
            <ReadingItem label="Wind speed" value={formatValue(latest.wind_speed, ' m/s')} />
            <ReadingItem label="Rainfall" value={formatValue(latest.rain, ' mm')} />
            <ReadingItem label="Solar radiation" value={formatValue(latest.solar_radiation, ' W/m²', 1)} />
            <ReadingItem label="Soil moisture" value={formatValue(latest.soil_moisture, '%', 0)} />
            <ReadingItem label="Battery voltage" value={formatValue(latest.volt_batt, ' V')} />
            <ReadingItem label="Solar voltage" value={formatValue(latest.volt_solar, ' V')} />
            <ReadingItem label="Battery current" value={formatValue(latest.curr_batt, ' A')} />
            <ReadingItem label="Solar current" value={formatValue(latest.curr_solar, ' A')} />
            <ReadingItem
              label="Reading time"
              value={new Date(latest.timestamp).toLocaleString()}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-storm/50">No readings received yet.</p>
        )}
      </section>
    </div>
  )
}

function WeatherTab({ stationId, stationName }: { stationId: string; stationName?: string }) {
  const [metricKey, setMetricKey] = useState<SensorMetricKey>('temperature')
  const [dateFrom, setDateFrom] = useState(daysAgo(7))
  const [dateTo, setDateTo] = useState(today())

  const hours = useMemo(
    () => Math.max(1, Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 3600000)),
    [dateFrom, dateTo],
  )

  const { data: readings, isLoading, error, retry } = useWeatherData({ stationId, dateFrom, dateTo, hours })
  const lastReading: SensorReadingChart | null = readings.length ? readings[readings.length - 1] : null
  const chartIsLoading = isLoading && !readings.length
  const physicalMetrics = SENSOR_METRICS.filter((mk) => mk !== 'atmospheric')

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="space-y-4">
          <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to) }} />
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sensor type">
            {SENSOR_METRICS.map((metric) => {
              const cfg = SENSOR_METRIC_CONFIG[metric]
              const isActive = metricKey === metric
              return (
                <button
                  key={metric}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setMetricKey(metric)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-midnight text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-storm/60 hover:bg-slate-100 hover:text-storm'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {error && (
        <ErrorBanner message={error} onRetry={retry} />
      )}

      <section aria-label="Current readings">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {physicalMetrics.map((mk) => (
            <ReadingSummaryCard
              key={mk}
              metricKey={mk}
              value={lastReading?.[mk] ?? null}
              isLoading={isLoading && !lastReading}
            />
          ))}
        </div>
      </section>

      <HistoricalChart readings={readings} metricKey={metricKey} stationName={stationName} isLoading={chartIsLoading} />
      <ReadingsTable readings={readings} metricKey={metricKey} stationName={stationName} isLoading={chartIsLoading} />
    </div>
  )
}

function PowerTab({ stationId, stationName }: { stationId: string; stationName?: string }) {
  const [metric, setMetric] = useState<PowerMetricKey>('volt_batt')
  const [dateFrom, setDateFrom] = useState(daysAgo(7))
  const [dateTo, setDateTo] = useState(today())
  const [showSecondary, setShowSecondary] = useState(false)

  const hours = useMemo(
    () => Math.max(1, Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 3600000)),
    [dateFrom, dateTo],
  )

  const { data: readings, isLoading, error, retry } = usePowerData({ stationId, dateFrom, dateTo, hours })
  const currentReading = readings.length ? readings[readings.length - 1] : null
  const secondaryKey = POWER_SECONDARY[metric] ?? null
  const chartIsLoading = isLoading && !readings.length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="space-y-4">
          <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to) }} />
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Power metric">
            {POWER_METRICS.map((mk) => {
              const cfg = POWER_METRIC_CONFIG[mk]
              const isActive = metric === mk
              return (
                <button
                  key={mk}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { setMetric(mk); setShowSecondary(false) }}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-midnight text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-storm/60 hover:bg-slate-100 hover:text-storm'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {error && (
        <ErrorBanner message={error} onRetry={retry} />
      )}

      <PowerStatusCard reading={currentReading} isLoading={isLoading && !currentReading} />
      <PowerHistoricalChart
        readings={readings}
        primaryKey={metric}
        secondaryKey={secondaryKey}
        showSecondary={showSecondary}
        onToggleSecondary={() => setShowSecondary((s) => !s)}
        stationName={stationName}
        isLoading={chartIsLoading}
      />
      <PowerReadingsTable readings={readings} metricKey={metric} stationName={stationName} isLoading={chartIsLoading} />
      <PowerSummaryCharts readings={readings} metricKey={metric} isLoading={chartIsLoading} />
    </div>
  )
}

export function StationDetailPage() {
  const { stationId } = useParams<{ stationId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const rawTab = searchParams.get('tab')
  const activeTab: DetailTab =
    rawTab === 'weather' || rawTab === 'power' ? rawTab : 'overview'

  const { data, isLoading, error, refetch } = useStationDetail(stationId)

  const setTab = useCallback(
    (tab: DetailTab) => {
      const next = new URLSearchParams(searchParams)
      if (tab === 'overview') next.delete('tab')
      else next.set('tab', tab)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const station = data?.station
  const resolvedStationId = station?.station_id ?? stationId ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-storm/50 transition-colors hover:text-midnight"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {isLoading && (
          <div className="space-y-4" aria-label="Loading station">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="mt-6 h-64 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/50 px-5 py-16 text-center">
            <p className="text-sm font-medium text-rose-700">Failed to load station</p>
            <p className="mt-1 text-xs text-rose-500/70">{error instanceof Error ? error.message : String(error)}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {station && !isLoading && (
          <>
            <header className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.station_id}</p>
              <h1 className="mt-1 text-2xl font-semibold text-midnight font-display">{station.name}</h1>
              <p className="mt-1 text-sm text-storm/60">{station.location || 'No location set'}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <Link
                  to={`/stations/map`}
                  className="font-medium text-sky-primary hover:text-sky-deep"
                >
                  View on map
                </Link>
                <Link
                  to={`/dashboard/weather-data?station=${station.station_id}`}
                  className="font-medium text-sky-primary hover:text-sky-deep"
                >
                  Open in weather data
                </Link>
                <Link
                  to={`/dashboard/power-data?station=${station.station_id}`}
                  className="font-medium text-sky-primary hover:text-sky-deep"
                >
                  Open in power data
                </Link>
              </div>
            </header>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="px-5 pt-4">
                <DetailTabBar active={activeTab} onChange={setTab} />
              </div>
              <div className="p-5">
                {activeTab === 'overview' && (
                  <OverviewTab
                    station={station}
                    latest={data.latest_reading}
                    onNavigateTab={setTab}
                  />
                )}
                {activeTab === 'weather' && <WeatherTab stationId={resolvedStationId} stationName={station?.name} />}
                {activeTab === 'power' && <PowerTab stationId={resolvedStationId} stationName={station?.name} />}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8fafc] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-midnight">{value}</p>
    </div>
  )
}

function ReadingItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-midnight">{value}</p>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
      <p className="flex-1 text-sm font-medium text-rose-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200"
      >
        Retry
      </button>
    </div>
  )
}
