import { useEffect, useState } from 'react'
import { Sidebar } from '../components/Sidebar'
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

function statusOf(station: Station): StationOperationalStatus {
  return station.status?.status ?? 'down'
}

export function DashboardPage() {
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
      acc[statusOf(station)] += 1
      return acc
    },
    { full: 0, partial: 0, down: 0 } as Record<StationOperationalStatus, number>
  )

  return (
    <div className="min-h-screen bg-[#f2f6fa] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <Sidebar />

        <main className="flex-1 px-5 py-5 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">Dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold text-[#1a2332]">Station overview</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-[#0a6ebd]">All stations</span>
              </div>
            </section>

            <div className="space-y-8 px-6 py-6">
              {isLoading && <p className="text-sm text-slate-500">Loading stations…</p>}
              {error && <p className="text-sm text-rose-600">{error}</p>}

              {!isLoading && !error && (
                <>
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

                  <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All stations</div>
                      {stations.length === 0 ? (
                        <p className="text-sm text-slate-500">No stations registered yet.</p>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {stations.map((station) => {
                            const status = statusOf(station)
                            return (
                              <article key={station.station_id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.station_id}</p>
                                    <h3 className="mt-2 text-lg font-semibold text-[#1a2332]">{station.name}</h3>
                                  </div>
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                                    {status === 'full' ? 'Online' : status === 'partial' ? 'Partial' : 'Down'}
                                  </span>
                                </div>
                                <p className="mt-4 text-sm text-slate-500">
                                  {station.status ? `Last update: ${new Date(station.status.last_updated).toLocaleString()}` : 'No data yet'}
                                </p>
                              </article>
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
                      <p className="mt-4 text-sm leading-7 text-slate-600">
                        AI-driven diagnostics and station insights will appear here once the monitoring model is connected.
                      </p>
                    </aside>
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}