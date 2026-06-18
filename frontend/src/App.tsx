import { useMemo, useState } from 'react'

type StationStatus = 'online' | 'partial' | 'down'
type StationFilter = StationStatus | 'all'

type Metric = {
  label: string
  value: string
  delta: string
}

type Station = {
  code: string
  name: string
  location: string
  status: StationStatus
  battery: number
  humidity: number
  temperature: number
  lastSync: string
}

type Alert = {
  title: string
  detail: string
  time: string
  tone: 'emerald' | 'amber' | 'rose'
}

const metrics: Metric[] = [
  {
    label: 'Stations online',
    value: '12',
    delta: '+2 since 08:00 UTC',
  },
  {
    label: 'Partial signal',
    value: '03',
    delta: 'Sensors need attention',
  },
  {
    label: 'Fresh data stream',
    value: '98%',
    delta: 'Average packet health',
  },
  {
    label: 'Active alerts',
    value: '05',
    delta: 'Two are auto-resolving',
  },
]

const stations: Station[] = [
  {
    code: 'AWS-001',
    name: 'Rukungiri Ridge',
    location: 'Western uplands',
    status: 'online',
    battery: 94,
    humidity: 61,
    temperature: 22,
    lastSync: '2 min ago',
  },
  {
    code: 'AWS-014',
    name: 'Lake Victoria East',
    location: 'Lakeshore corridor',
    status: 'partial',
    battery: 48,
    humidity: 77,
    temperature: 24,
    lastSync: '11 min ago',
  },
  {
    code: 'AWS-027',
    name: 'Karamoja Basin',
    location: 'Northern plains',
    status: 'down',
    battery: 12,
    humidity: 35,
    temperature: 29,
    lastSync: '42 min ago',
  },
  {
    code: 'AWS-031',
    name: 'Mount Elgon Gate',
    location: 'High-altitude station',
    status: 'online',
    battery: 88,
    humidity: 69,
    temperature: 18,
    lastSync: '5 min ago',
  },
]

const alerts: Alert[] = [
  {
    title: 'Battery decay detected',
    detail: 'AWS-027 has dropped below 15% and should be flagged for service.',
    time: '04 min ago',
    tone: 'amber',
  },
  {
    title: 'Sensor drift normalized',
    detail: 'AWS-014 temperature variance has stabilized after the last sync.',
    time: '17 min ago',
    tone: 'emerald',
  },
  {
    title: 'Packet loss threshold hit',
    detail: 'Three consecutive retries were recorded on the northern uplink.',
    time: '29 min ago',
    tone: 'rose',
  },
]

const integrationSteps = [
  'Expose Django station data through a JSON endpoint or DRF serializer.',
  'Replace the mock arrays with fetch calls and cache the response state.',
  'Keep the status palette and layout tokens so the UI stays visually consistent.',
]

const filterLabels: Array<{ value: StationFilter; label: string }> = [
  { value: 'all', label: 'All stations' },
  { value: 'online', label: 'Online' },
  { value: 'partial', label: 'Partial' },
  { value: 'down', label: 'Down' },
]

const statusCopy: Record<StationStatus, { label: string; tone: string }> = {
  online: { label: 'Healthy', tone: 'from-emerald-400 to-cyan-400' },
  partial: { label: 'Needs review', tone: 'from-amber-300 to-orange-400' },
  down: { label: 'Offline', tone: 'from-rose-400 to-fuchsia-500' },
}

function App() {
  const [activeFilter, setActiveFilter] = useState<StationFilter>('all')

  const visibleStations = useMemo(() => {
    if (activeFilter === 'all') {
      return stations
    }

    return stations.filter((station) => station.status === activeFilter)
  }, [activeFilter])

  const coverage = Math.round((stations.filter((station) => station.status === 'online').length / stations.length) * 100)

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),_rgba(2,6,23,1))]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30 [mask-image:linear-gradient(to_bottom,white,transparent_92%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-emerald-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/30">
              AW
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200/80">AWS Monitor</p>
              <p className="text-sm text-slate-300">React + Tailwind dashboard concept for station operations</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <a className="rounded-full border border-white/10 px-4 py-2 transition hover:border-cyan-300/40 hover:text-white" href="#stations">
              Stations
            </a>
            <a className="rounded-full border border-white/10 px-4 py-2 transition hover:border-cyan-300/40 hover:text-white" href="#alerts">
              Alerts
            </a>
            <a className="rounded-full border border-white/10 px-4 py-2 transition hover:border-cyan-300/40 hover:text-white" href="#integration">
              Integration
            </a>
          </nav>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_100px_-50px_rgba(8,145,178,0.6)] backdrop-blur-xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              Live weather intelligence
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl font-display">
              Build a sharp, modern control room for every weather station.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              This frontend is structured as a practical implementation guide: a polished React experience that can later plug directly into Django station data, live telemetry, and automated alerts.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300"
                href="#stations"
              >
                Explore station view
              </a>
              <a
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10"
                href="#integration"
              >
                Review integration flow
              </a>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-slate-900/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-white">{metric.value}</p>
                  <p className="mt-2 text-sm text-slate-400">{metric.delta}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[32px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_30px_100px_-50px_rgba(14,165,233,0.55)] backdrop-blur-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Network pulse</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white font-display">Monitoring at a glance</h2>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Synced 2 min ago
              </span>
            </div>

            <div className="mt-6 flex items-center gap-6">
              <div
                className="flex h-40 w-40 items-center justify-center rounded-full p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                style={{
                  background: `conic-gradient(rgba(52,211,153,0.95) ${coverage * 3.6}deg, rgba(51,65,85,0.75) 0deg)`,
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-slate-950/95 text-center">
                  <span className="text-4xl font-black text-white">{coverage}%</span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Online</span>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {stations.slice(0, 3).map((station) => (
                  <div key={station.code} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{station.code}</p>
                        <p className="text-xs text-slate-400">{station.name}</p>
                      </div>
                      <span
                        className={`rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-slate-950 ${statusCopy[station.status].tone}`}
                      >
                        {statusCopy[station.status].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Battery</p>
                <p className="mt-2 text-2xl font-black text-white">87%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Temp</p>
                <p className="mt-2 text-2xl font-black text-white">22.6°C</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Humidity</p>
                <p className="mt-2 text-2xl font-black text-white">68%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-slate-400">Latency</p>
                <p className="mt-2 text-2xl font-black text-white">180ms</p>
              </div>
            </div>
          </aside>
        </section>

        <section id="stations" className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_100px_-50px_rgba(15,23,42,0.85)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Station grid</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white font-display">Operational status by site</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {filterLabels.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeFilter === filter.value
                        ? 'bg-cyan-400 text-slate-950'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/40 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {visibleStations.map((station) => (
                <article key={station.code} className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 transition hover:-translate-y-1 hover:border-cyan-300/30">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{station.code}</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{station.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{station.location}</p>
                    </div>

                    <span
                      className={`rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-slate-950 ${statusCopy[station.status].tone}`}
                    >
                      {station.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Temp</p>
                      <p className="mt-2 text-lg font-bold text-white">{station.temperature}°C</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Humidity</p>
                      <p className="mt-2 text-lg font-bold text-white">{station.humidity}%</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-slate-400">Battery</p>
                      <p className="mt-2 text-lg font-bold text-white">{station.battery}%</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
                    <span>Last sync</span>
                    <span>{station.lastSync}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <section id="alerts" className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6 backdrop-blur-xl">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Alert stream</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white font-display">Recent system signals</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                  Auto triage on
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {alerts.map((alert) => {
                  const toneMap = {
                    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
                    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
                    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
                  }

                  return (
                    <div key={alert.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 h-3 w-3 rounded-full ${toneMap[alert.tone]}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="text-base font-semibold text-white">{alert.title}</h3>
                            <span className="text-xs text-slate-400">{alert.time}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{alert.detail}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section id="integration" className="rounded-[32px] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/85 to-slate-950 p-6 shadow-[0_30px_100px_-50px_rgba(14,165,233,0.75)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Integration guide</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white font-display">Frontend implementation path</h2>
              <div className="mt-5 space-y-4">
                {integrationSteps.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-3xl border border-white/10 bg-slate-950/55 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-sm font-black text-slate-950">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                The layout above mirrors the backend structure already present in Django, so you can swap the mock data for API payloads without redesigning the interface.
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
