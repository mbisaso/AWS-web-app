import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { SummaryCharts } from '../components/dashboard/SummaryCharts'
import { RecentAlertsPreview } from '../components/dashboard/RecentAlertsPreview'
import { useDashboardData } from '../hooks/useDashboardData'
import { fetchStations } from '../api/stations'
import type { Station, StationOperationalStatus } from '../types'
import type { SimFleetSummary } from '../services/api'
import { fetchSimManagementData } from '../services/api'
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

  /* ── Prediction counts (added below) ── */
  const predCounts = useMemo(() => {
    const atRisk = stations.filter((s) => predictionOf(s) === 'at_risk').length
    const healthy = stations.filter((s) => predictionOf(s) === 'healthy').length
    const unknown = stations.filter((s) => predictionOf(s) === 'unknown').length
    return { atRisk, healthy, unknown }
  }, [stations])

  /* ── SIM fleet data (single fetch) ── */
  const [simSummary, setSimSummary] = useState<SimFleetSummary | null>(null)
  const [simSparklines, setSimSparklines] = useState<{ name: string; usage: number[] }[]>([])
  const simFetched = useRef(false)
  useEffect(() => {
    if (simFetched.current) return
    simFetched.current = true
    fetchSimManagementData().then((d) => {
      setSimSummary(d.summary)
      const top = d.sims.slice(0, 4)
      setSimSparklines(top.map((s) => ({
        name: s.station_name ?? `SIM #${s.sim.id}`,
        usage: s.daily_usage.map((u) => u.usage_mb),
      })))
    }).catch(() => {})
  }, [])

  /* ── Trend helper ── */
  function trendIcon(current: number | null | undefined, baseline: number | null | undefined): { icon: string; color: string } {
    if (current == null || baseline == null || baseline === 0) return { icon: '→', color: 'text-storm/30' }
    const diff = (current - baseline) / Math.abs(baseline)
    if (diff > 0.03) return { icon: '↑', color: 'text-rose' }
    if (diff < -0.03) return { icon: '↓', color: 'text-emerald' }
    return { icon: '→', color: 'text-storm/30' }
  }

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
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-primary border-t-transparent" />
                  <p className="text-sm font-medium text-storm/50">Loading stations…</p>
                </div>
              </div>
            )}
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

        {/* ════════════════════════════════════════════════ */}
        {/*  ADDED SECTIONS (SIM, Power, Weather Analysis)  */}
        {/* ════════════════════════════════════════════════ */}

        <div className="mt-6 space-y-6">

            {/* ── Quick stat cards ── */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="SIM fleet"
                value={simSummary?.total_active ?? 0}
                sub={`${simSummary?.expiring_soon_count ?? 0} expiring · ${((simSummary?.total_remaining_mb ?? 0) / 1024).toFixed(1)} GB left`}
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="7" width="16" height="10" rx="2" /><path d="M4 11h16" />
                  </svg>
                }
                accent="bg-purple-50 text-purple-600"
                valueColor="text-purple-700"
              />
              <StatCard
                label="At-risk stations"
                value={predCounts.atRisk}
                sub={`${predCounts.healthy} healthy · ${predCounts.unknown} unknown`}
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <path d="M12 9v4" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
                  </svg>
                }
                accent={predCounts.atRisk > 0 ? 'bg-rose-50 text-rose' : 'bg-emerald-50 text-emerald'}
                valueColor={predCounts.atRisk > 0 ? 'text-rose' : 'text-emerald'}
              />
              <StatCard
                label="Active alerts"
                value={summary?.active_alerts ?? 0}
                sub={`${summary?.critical_alerts ?? 0} critical · ${summary?.warning_alerts ?? 0} warning`}
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                }
                accent={(summary?.active_alerts ?? 0) > 0 ? 'bg-rose-50 text-rose' : 'bg-emerald-50 text-emerald'}
                valueColor={(summary?.active_alerts ?? 0) > 0 ? 'text-rose' : 'text-emerald'}
              />
              <StatCard
                label="Data usage"
                value={simSparklines.length > 0 ? `${simSparklines.reduce((a, s) => a + s.usage.reduce((x, y) => x + y, 0), 0).toFixed(0)} MB` : '—'}
                sub="Fleet daily total (top 4 SIMs)"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
                accent="bg-amber-50 text-amber-600"
                valueColor="text-amber-700"
              />
            </section>

            {/* ── Charts row: SIM fleet + Power + Sensor bars + Trends ── */}
            <section className="grid gap-4 lg:grid-cols-2">
              {/* SIM fleet donut */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">SIM fleet</p>
                <h3 className="mt-1 text-base font-semibold text-midnight font-display">
                  {simSummary?.total_active ?? 0} active SIMs
                  <span className="ml-2 text-xs font-normal text-storm/40">
                    {(simSummary?.total_remaining_mb ?? 0) >= 1024
                      ? `${(simSummary!.total_remaining_mb / 1024).toFixed(1)} GB remaining`
                      : `${simSummary?.total_remaining_mb ?? 0} MB remaining`}
                  </span>
                </h3>
                <div className="mt-4 flex items-center gap-6">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                    {(() => {
                      const t = simSummary?.total_active ?? 0
                      const e = simSummary?.expiring_soon_count ?? 0
                      const x = simSummary?.expired_count ?? 0
                      const h = Math.max(t - e - x, 0)
                      const d = t || 1
                      return (
                        <svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-90">
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                          <DonutArc r={48} ratio={h / d} offset={0} color="#22C55E" />
                          <DonutArc r={48} ratio={e / d} offset={h / d} color="#F59E0B" />
                          <DonutArc r={48} ratio={x / d} offset={(h + e) / d} color="#E11D48" />
                        </svg>
                      )
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                      <p className="text-lg font-bold text-midnight font-display">{simSummary?.total_active ?? 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {(() => {
                      const t = simSummary?.total_active ?? 0
                      const e = simSummary?.expiring_soon_count ?? 0
                      const x = simSummary?.expired_count ?? 0
                      const h = Math.max(t - e - x, 0)
                      return (<>
                        <LegendItem color="#22C55E" label="Healthy" count={h} pct={t > 0 ? Math.round((h / t) * 100) : 0} />
                        <LegendItem color="#F59E0B" label={`Expiring ≤${simSummary?.expiring_soon_threshold_days ?? 7}d`} count={e} pct={t > 0 ? Math.round((e / t) * 100) : 0} />
                        <LegendItem color="#E11D48" label="Expired" count={x} pct={t > 0 ? Math.round((x / t) * 100) : 0} />
                      </>)
                    })()}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button type="button" onClick={() => navigate('/dashboard/sim-management')}
                    className="cursor-pointer text-xs font-medium text-sky-primary transition-colors hover:text-sky-deep">
                    Manage SIMs →
                  </button>
                </div>
              </div>

              {/* Power overview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Power system</p>
                <h3 className="mt-1 text-base font-semibold text-midnight font-display">Station power overview</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-storm/60">Stations tracked</span>
                    <span className="text-sm font-semibold text-midnight">{stations.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-storm/60">Healthy (AI prediction)</span>
                    <span className="text-sm font-semibold text-emerald">{predCounts.healthy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-storm/60">Stations at risk</span>
                    <span className={`text-sm font-semibold ${predCounts.atRisk > 0 ? 'text-rose' : 'text-emerald'}`}>
                      {predCounts.atRisk}
                      <span className="text-storm/40 text-xs"> / {stations.length}</span>
                    </span>
                  </div>
                  {(() => {
                    const barPct = stations.length > 0 ? ((stations.length - predCounts.atRisk) / stations.length) * 100 : 0
                    return (
                      <div>
                        <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald transition-all duration-700" style={{ width: `${barPct}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] text-storm/40">{Math.round(barPct)}% of stations healthy</p>
                      </div>
                    )
                  })()}
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button type="button" onClick={() => navigate('/dashboard/power-data')}
                    className="cursor-pointer text-xs font-medium text-sky-primary transition-colors hover:text-sky-deep">
                    Power telemetry →
                  </button>
                </div>
              </div>

              {/* Sensor vertical bars */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Weather sensors</p>
                <h3 className="mt-1 text-base font-semibold text-midnight font-display">Live averages across fleet</h3>
                <div className="mt-4 flex items-center justify-around gap-2">
                  {[
                    { label: 'Temperature', value: sensorAvg.temperature, max: 50, color: '#F97316', unit: '°C' },
                    { label: 'Humidity', value: sensorAvg.humidity, max: 100, color: '#0EA5E9', unit: '%' },
                    { label: 'Pressure', value: sensorAvg.pressure, max: 1050, color: '#8B5CF6', unit: 'hPa' },
                    { label: 'Wind', value: sensorAvg.windSpeed, max: 20, color: '#22C55E', unit: 'm/s' },
                  ].map((s) => (
                    <SensorBar key={s.label} label={s.label} value={s.value} max={s.max} color={s.color} unit={s.unit} />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button type="button" onClick={() => navigate('/dashboard/weather-data')}
                    className="cursor-pointer text-xs font-medium text-sky-primary transition-colors hover:text-sky-deep">
                    View weather data →
                  </button>
                </div>
              </div>

              {/* Weather analysis trends */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Weather analysis</p>
                <h3 className="mt-1 text-base font-semibold text-midnight font-display">Trend summary</h3>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Temperature', current: sensorAvg.temperature, baseline: 25, unit: '°C' },
                    { label: 'Humidity', current: sensorAvg.humidity, baseline: 60, unit: '%' },
                    { label: 'Pressure', current: sensorAvg.pressure, baseline: 1013, unit: 'hPa' },
                    { label: 'Wind Speed', current: sensorAvg.windSpeed, baseline: 5, unit: 'm/s' },
                  ].map((m) => {
                    const trend = trendIcon(m.current, m.baseline)
                    return (
                      <div key={m.label} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${trend.color}`}>{trend.icon}</span>
                          <span className="text-xs font-medium text-storm/70">{m.label}</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-midnight">
                          {m.current !== null ? `${m.current.toFixed(1)} ${m.unit}` : '—'}
                          <span className="text-storm/30 text-[10px] ml-1">vs {m.baseline} {m.unit}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button type="button" onClick={() => navigate('/dashboard/weather-analysis')}
                    className="cursor-pointer text-xs font-medium text-sky-primary transition-colors hover:text-sky-deep">
                    Full analysis →
                  </button>
                </div>
              </div>
            </section>

            {/* ── SIM usage sparklines ── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Data usage</p>
              <h3 className="mt-1 text-base font-semibold text-midnight font-display">SIM daily usage (top 4)</h3>
              <div className="mt-4 space-y-4">
                {simSparklines.length === 0
                  ? <p className="py-6 text-center text-xs text-storm/30">No SIM data</p>
                  : simSparklines.map((s, i) => {
                      const avg = s.usage.length > 0 ? Math.round(s.usage.reduce((a, b) => a + b, 0) / s.usage.length) : 0
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-24 truncate text-xs font-medium text-storm/70" title={s.name}>{s.name}</span>
                          <Sparkline values={s.usage} color="#0EA5E9" height={28} />
                          <span className="w-16 text-right text-[10px] tabular-nums text-storm/50">{avg} MB/d</span>
                        </div>
                      )
                    })
                }
              </div>
              <div className="mt-3 flex items-center justify-end">
                <button type="button" onClick={() => navigate('/dashboard/sim-management')}
                  className="cursor-pointer text-xs font-medium text-sky-primary transition-colors hover:text-sky-deep">
                  SIM management →
                </button>
              </div>
            </section>

          </div>
      </main>

    </div>
  )
}

/* ── Stat card (added) ── */
function StatCard({ label, value, sub, icon, accent, valueColor }: {
  label: string; value: number | string; sub: string; icon: React.ReactNode; accent: string; valueColor: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-storm/50">{label}</p>
        <p className={`text-xl font-bold font-display tabular-nums ${valueColor}`}>{value}</p>
        <p className="truncate text-[10px] text-storm/40">{sub}</p>
      </div>
    </div>
  )
}

/* ── Mini donut arc (added) ── */
function DonutArc({ r, ratio, offset, color }: { r: number; ratio: number; offset: number; color: string }) {
  if (ratio === 0) return null
  const circumference = 2 * Math.PI * r
  const dashLength = ratio * circumference
  const gap = circumference - dashLength
  const dashOffset = -offset * circumference
  return (
    <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
      strokeDasharray={`${Math.max(dashLength, 1)} ${Math.max(gap, 1)}`}
      strokeDashoffset={dashOffset} strokeLinecap="round"
      className="transition-all duration-700" />
  )
}

/* ── Colored dot legend item (added) ── */
function LegendItem({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs font-medium text-storm/60">{label}</span>
      <span className="ml-auto text-xs font-semibold tabular-nums text-midnight">{count}<span className="text-storm/40"> ({pct}%)</span></span>
    </div>
  )
}

/* ── Inline sparkline (added) ── */
function Sparkline({ values, color, height = 28 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />
  const svgH = height
  const svgW = 80
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * svgW},${svgH - ((v - min) / range) * (svgH - 4) - 2}`).join(' ')
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="shrink-0" style={{ width: svgW, height: svgH }} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ── Vertical sensor bar (added) ── */
function SensorBar({ label, value, unit, max, color }: { label: string; value: number | null; unit: string; max: number; color: string }) {
  const pct = value !== null && max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-24 w-8 items-end justify-center">
        <div className="absolute bottom-0 w-full rounded-t-md bg-slate-100" style={{ height: '100%' }}>
          <div className="w-full rounded-t-md transition-all duration-700" style={{ height: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <p className="text-xs font-semibold tabular-nums text-midnight">{value !== null ? value.toFixed(1) : '—'}</p>
      <p className="text-[10px] font-medium text-storm/40">{unit}</p>
      <p className="text-[10px] font-medium text-storm/40 truncate max-w-20 text-center">{label}</p>
    </div>
  )
}
