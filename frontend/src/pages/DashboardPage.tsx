import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { SummaryCharts } from '../components/dashboard/SummaryCharts'
import { RecentAlertsPreview } from '../components/dashboard/RecentAlertsPreview'
import { useDashboardData } from '../hooks/useDashboardData'
import { fetchStations } from '../api/stations'
import type { Station, StationOperationalStatus } from '../types'
import type { StationReading as DashStationReading } from '../services/api'

const STATUS_LABELS: Record<StationOperationalStatus, { title: string; tone: string; description: string }> = {
  full: { title: 'Fully transmitting', tone: 'bg-emerald-50 text-emerald-700', description: 'Stations reporting on schedule' },
  partial: { title: 'Partial transmission', tone: 'bg-amber-50 text-amber-700', description: 'Stations with delayed readings' },
  down: { title: 'Totally down', tone: 'bg-rose-50 text-rose-700', description: 'Stations without recent data' },
}

const STATUS_BADGE: Record<StationOperationalStatus, string> = {
  full: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  down: 'bg-rose-50 text-rose-700',
}

const PREDICTION_BADGE: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700',
  at_risk: 'bg-rose-50 text-rose-700',
  unknown: 'bg-slate-100 text-slate-500',
}

function statusOf(station: Station): StationOperationalStatus {
  return station.status?.status ?? 'down'
}

function predictionOf(station: Station): string {
  return station.status?.details?.prediction ?? 'unknown'
}

function StationDetailDialog({
  station,
  onClose,
}: {
  station: Station
  onClose: () => void
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const opStatus = statusOf(station)
  const prediction = predictionOf(station)
  const details = station.status?.details
  const proba = details ? (details.at_risk_proba * 100).toFixed(1) : null
  const threshold = details ? (details.threshold_used * 100).toFixed(1) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-dialog-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.station_id}</p>
            <h2 id="detail-dialog-title" className="mt-1 text-lg font-semibold text-midnight">{station.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm/70"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[opStatus]}`}>
              {opStatus === 'full' ? 'Online' : opStatus === 'partial' ? 'Partial' : 'Down'}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PREDICTION_BADGE[prediction] ?? PREDICTION_BADGE.unknown}`}>
              {prediction === 'healthy' ? 'Healthy' : prediction === 'at_risk' ? 'At Risk' : 'Unknown'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Location</p>
              <p className="mt-1 text-sm text-midnight">{station.location || '—'}</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Coordinates</p>
              <p className="mt-1 text-sm text-midnight">
                {station.latitude != null && station.longitude != null
                  ? `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Expected Interval</p>
              <p className="mt-1 text-sm text-midnight">{station.expected_interval_minutes} min</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Last Update</p>
              <p className="mt-1 text-sm text-midnight">
                {station.status?.last_updated
                  ? new Date(station.status.last_updated).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>

          {station.status && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">AI Model Analytics</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Prediction</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight capitalize">{details?.prediction ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">At-Risk Probability</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{proba ? `${proba}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Threshold</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{threshold ? `${threshold}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Computed By</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{station.status.computed_by || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Reading ID</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{details?.last_reading_id ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Operational Status</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight capitalize">{station.status.status}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: dashData, isLoading: dashLoading } = useDashboardData()
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .catch(() => setError('Could not load stations. Is the backend running?'))
      .finally(() => setIsLoading(false))
  }, [])

  const counts = stations.reduce(
    (acc, station) => {
      acc[statusOf(station)] += 1;
      return acc;
    },
    { full: 0, partial: 0, down: 0 } as Record<StationOperationalStatus, number>
  )

  const dashStations = dashData?.stations ?? []
  const alerts = dashData?.alerts ?? []
  const summary = dashData?.summary

  const sensorAvg = useMemo(() => {
    const calc = (key: 'temperature' | 'humidity' | 'pressure' | 'wind_speed') => {
      const withVal = dashStations.filter((s) => s[key])
      if (!withVal.length) return null
      return withVal.reduce((a, s) => a + s[key]!.value, 0) / withVal.length
    }
    return {
      temperature: calc('temperature'),
      humidity: calc('humidity'),
      pressure: calc('pressure'),
      windSpeed: calc('wind_speed'),
    }
  }, [dashStations])

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row lg:overflow-hidden">
      <DashboardSidebar />

      <main className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#1a2332]">Station overview</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-[#0a6ebd]">All stations</span>
            </div>
          </div>

          <div className="space-y-8 px-6 py-6">
            {isLoading && <p className="text-sm text-slate-500">Loading stations…</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}

            {!isLoading && !error && (
              <>
                {/* ── All stations + Insights panel (top) ── */}
                <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All stations</div>
                    {stations.length === 0 ? (
                      <p className="text-sm text-slate-500">No stations registered yet.</p>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {stations.map((station) => {
                          const status = statusOf(station)
                          const prediction = predictionOf(station)
                          return (
                            <button
                              key={station.station_id}
                              type="button"
                              onClick={() => setSelectedStation(station)}
                              className="cursor-pointer rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm text-left transition hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#0a6ebd] w-full"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.station_id}</p>
                                  <h3 className="mt-1 text-lg font-semibold text-[#1a2332] truncate">{station.name}</h3>
                                </div>
                                <div className="flex shrink-0 gap-1.5">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                                    {status === 'full' ? 'Online' : status === 'partial' ? 'Partial' : 'Down'}
                                  </span>
                                </div>
                              </div>
                              <p className="mt-2 text-sm text-slate-500 truncate">{station.location || '—'}</p>
                              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                                {station.status?.last_updated && (
                                  <span>Updated: {new Date(station.status.last_updated).toLocaleString()}</span>
                                )}
                                <span className={`rounded-full px-2 py-0.5 font-medium ${PREDICTION_BADGE[prediction] ?? PREDICTION_BADGE.unknown}`}>
                                  {prediction === 'healthy' ? 'Healthy' : prediction === 'at_risk' ? 'At Risk' : 'Unknown'}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <aside className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-5">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">AI Model Analytics</p>
                      <h2 className="mt-2 text-xl font-semibold text-[#1a2332]">Insights panel</h2>
                    </div>
                    <div className="mt-5 space-y-4">
                      {stations.length > 0 && (() => {
                        const atRisk = stations.filter((s) => predictionOf(s) === 'at_risk').length
                        const healthy = stations.filter((s) => predictionOf(s) === 'healthy').length
                        const unknown = stations.filter((s) => predictionOf(s) === 'unknown').length
                        const atRiskPct = Math.round((atRisk / stations.length) * 100)
                        return (
                          <>
                            <div className="flex items-center justify-center">
                              <div className="relative flex h-24 w-24 items-center justify-center">
                                <svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-90" role="img" aria-label={`${atRiskPct}% at risk`}>
                                  <circle cx="60" cy="60" r="48" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                                  <circle
                                    cx="60" cy="60" r="48"
                                    fill="none" stroke="#E11D48"
                                    strokeWidth="10"
                                    strokeDasharray={`${atRiskPct * 3.016} ${(100 - atRiskPct) * 3.016}`}
                                    strokeLinecap="round"
                                    className="transition-all duration-700"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-midnight font-display">{atRiskPct}%</p>
                                    <p className="text-[10px] font-medium text-storm/40">at risk</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-storm/60">
                                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Healthy
                                </span>
                                <span className="font-semibold tabular-nums text-midnight">{healthy}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-storm/60">
                                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" /> At risk
                                </span>
                                <span className="font-semibold tabular-nums text-midnight">{atRisk}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-storm/60">
                                  <span className="inline-block h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" /> Unknown
                                </span>
                                <span className="font-semibold tabular-nums text-midnight">{unknown}</span>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                      <p className="text-xs leading-relaxed text-slate-500">
                        Click a station card to view detailed AI diagnostics, including health predictions and risk probabilities.
                      </p>
                    </div>
                  </aside>
                </section>

                {/* ── Station summary ── */}
                <section>
                  <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Station summary</div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {(Object.keys(STATUS_LABELS) as StationOperationalStatus[]).map((status) => (
                      <article key={status} className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-5">
                        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_LABELS[status].tone}`}>
                          {String(counts[status]).padStart(2, '0')}
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-[#1a2332]">{STATUS_LABELS[status].title}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{STATUS_LABELS[status].description}</p>
                      </article>
                    ))}
                  </div>
                </section>

                {/* ── Charts row: network health donut + temperature bars ── */}
                {dashStations.length > 0 && (
                  <SummaryCharts
                    stations={dashStations}
                    onlineCount={counts.full}
                    offlineCount={counts.down}
                    partialCount={counts.partial}
                  />
                )}

                {/* ── Charts row: alert severity + sensor averages ── */}
                {(summary || dashStations.length > 0) && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    {summary && (
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Alert severity">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Alerts</p>
                        <h3 className="mt-1 text-base font-semibold text-midnight font-display">By severity</h3>
                        <div className="mt-4 space-y-3">
                          {[
                            { label: 'Critical', count: summary.critical_alerts, color: '#E11D48' },
                            { label: 'Warning', count: summary.warning_alerts, color: '#F59E0B' },
                            { label: 'Info', count: summary.info_alerts, color: '#0EA5E9' },
                          ].map((item) => {
                            const total = summary.critical_alerts + summary.warning_alerts + summary.info_alerts
                            const pct = total > 0 ? (item.count / total) * 100 : 0
                            if (total === 0) return null
                            return (
                              <div key={item.label}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1.5 font-medium text-storm/70">
                                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                                    {item.label}
                                  </span>
                                  <span className="font-semibold tabular-nums text-midnight">
                                    {item.count}
                                    <span className="text-storm/40"> ({Math.round(pct)}%)</span>
                                  </span>
                                </div>
                                <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                                    role="progressbar"
                                    aria-valuenow={item.count}
                                    aria-valuemin={0}
                                    aria-valuemax={total}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )}
                    {dashStations.length > 0 && (
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Sensor averages">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Live sensors</p>
                        <h3 className="mt-1 text-base font-semibold text-midnight font-display">Average readings</h3>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {[
                            { label: 'Temperature', value: sensorAvg.temperature, unit: '°C', color: '#F97316', bg: 'bg-orange-50' },
                            { label: 'Humidity', value: sensorAvg.humidity, unit: '%', color: '#0EA5E9', bg: 'bg-sky-50' },
                            { label: 'Pressure', value: sensorAvg.pressure, unit: 'hPa', color: '#8B5CF6', bg: 'bg-purple-50' },
                            { label: 'Wind Speed', value: sensorAvg.windSpeed, unit: 'm/s', color: '#22C55E', bg: 'bg-emerald-50' },
                          ].map((card) => (
                            <div key={card.label} className={`rounded-xl ${card.bg} p-3.5`}>
                              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: card.color }}>{card.label}</p>
                              <p className="mt-1 text-xl font-bold text-midnight font-display">
                                {card.value !== null ? card.value.toFixed(1) : '—'}
                                <span className="ml-0.5 text-sm font-normal text-storm/40">{card.unit}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {/* ── Recent alerts ── */}
                {alerts.length > 0 && (
                  <RecentAlertsPreview alerts={alerts} />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {selectedStation && (
        <StationDetailDialog
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  )
}
