const summaryCards = [
  {
    title: 'Fully transmitting',
    count: '12',
    description: 'Stations reporting on schedule',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: 'Partial transmission',
    count: '03',
    description: 'Stations with delayed readings',
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    title: 'Totally down',
    count: '01',
    description: 'Stations without recent data',
    tone: 'bg-rose-50 text-rose-700',
  },
]

const stations = [
  {
    code: 'AWS-001',
    name: 'Rukungiri Ridge',
    status: 'Online',
    updated: '2 min ago',
  },
  {
    code: 'AWS-014',
    name: 'Lake Victoria East',
    status: 'Partial',
    updated: '11 min ago',
  },
  {
    code: 'AWS-027',
    name: 'Karamoja Basin',
    status: 'Down',
    updated: '42 min ago',
  },
  {
    code: 'AWS-031',
    name: 'Mount Elgon Gate',
    status: 'Online',
    updated: '5 min ago',
  },
]

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#f2f6fa] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[290px] shrink-0 border-r border-slate-200 bg-[#1a2332] px-5 py-6 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 pb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a6ebd] text-lg font-black text-white">A</div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-100">AWS Monitor</p>
              <p className="text-xs text-slate-300">Dashboard</p>
            </div>
          </div>

          <nav className="mt-6 space-y-2 text-sm">
            <a className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-medium text-white" href="/dashboard">
              <span>Dashboard</span>
            </a>
            <a className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white" href="#">
              <span>Weather data</span>
            </a>
            <a className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white" href="#">
              <span>Power data</span>
            </a>
            <a className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white" href="#">
              <span>Set sleep time</span>
            </a>
            <a className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white" href="#">
              <span>Weather analysis</span>
            </a>
          </nav>

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Signed in as</p>
            <p className="mt-2 text-lg font-semibold text-white">Admin</p>
            <a className="mt-4 inline-flex text-sm font-medium text-sky-200 hover:text-white" href="/">
              Log out
            </a>
          </div>
        </aside>

        <main className="flex-1 px-5 py-5 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">Dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold text-[#1a2332]">Station overview</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-[#0a6ebd]">All stations</span>
                <span>Last sync 2 min ago</span>
              </div>
            </div>

            <div className="space-y-8 px-6 py-6">
              <section>
                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Station summary</div>
                <div className="grid gap-4 md:grid-cols-3">
                  {summaryCards.map((card) => (
                    <article key={card.title} className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-5">
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${card.tone}`}>{card.count}</div>
                      <h2 className="mt-4 text-xl font-semibold text-[#1a2332]">{card.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{card.description}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">All stations</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {stations.map((station) => (
                      <article key={station.code} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.code}</p>
                            <h3 className="mt-2 text-lg font-semibold text-[#1a2332]">{station.name}</h3>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              station.status === 'Online'
                                ? 'bg-emerald-50 text-emerald-700'
                                : station.status === 'Partial'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {station.status}
                          </span>
                        </div>
                        <p className="mt-4 text-sm text-slate-500">Last update: {station.updated}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <aside className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">AI Model Analytics</p>
                    <h2 className="mt-2 text-xl font-semibold text-[#1a2332]">Insights panel</h2>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    AI-driven diagnostics and station insights will appear here once the monitoring model is connected.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Weather feed', 'Stable'],
                      ['Power feed', 'Normal'],
                      ['Sleep window', 'Configured'],
                      ['Analysis', 'Pending'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm text-slate-500">{label}</p>
                        <p className="mt-2 text-base font-semibold text-[#1a2332]">{value}</p>
                      </div>
                    ))}
                  </div>
                </aside>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
