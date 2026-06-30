import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { SummaryCharts } from '../components/dashboard/SummaryCharts'
import { RecentAlertsPreview } from '../components/dashboard/RecentAlertsPreview'
import { useDashboardData } from '../hooks/useDashboardData'
import { fetchStations } from '../api/stations'
import type { Station, StationOperationalStatus } from '../types'
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

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: dashData, isLoading: dashLoading } = useDashboardData()
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

                {/* ── All stations (list) + Insights panel ── */}
                <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All stations</div>
                    {stations.length === 0 ? (
                      <p className="text-sm text-slate-500">No stations registered yet.</p>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Station</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Location</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Status</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Prediction</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stations.map((station) => {
                              const status = statusOf(station)
                              const prediction = predictionOf(station)
                              return (
                                <tr
                                  key={station.station_id}
                                  onClick={() => navigate(`/dashboard/weather-data?station=${station.station_id}`)}
                                  className="cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
                                >
                                  <td className="px-4 py-3.5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.station_id}</p>
                                    <p className="mt-0.5 font-semibold text-midnight">{station.name}</p>
                                  </td>
                                  <td className="px-4 py-3.5 text-sm text-slate-500">{station.location || '—'}</td>
                                  <td className="px-4 py-3.5">
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                                      {status === 'full' ? 'Online' : status === 'partial' ? 'Partial' : 'Down'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PREDICTION_BADGE[prediction] ?? PREDICTION_BADGE.unknown}`}>
                                      {prediction === 'healthy' ? 'Healthy' : prediction === 'at_risk' ? 'At Risk' : 'Unknown'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-xs text-slate-400">
                                    {station.status?.last_updated
                                      ? new Date(station.status.last_updated).toLocaleString()
                                      : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
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
                        Click a station row to view its detailed weather readings, charts, and AI diagnostics.
                      </p>
                    </div>
                  </aside>
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

    </div>
  )
}
