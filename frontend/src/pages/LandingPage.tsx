export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f2f6fa] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a6ebd] text-lg font-black text-white shadow-lg shadow-sky-200">
              A
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.24em] text-[#0a6ebd] uppercase">AWS Monitor</p>
              <p className="text-xs text-slate-500">WIMEA-ICT weather station platform</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <a className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-sky-50 hover:text-[#0a6ebd]" href="#features">
              Features
            </a>
            <a className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-sky-50 hover:text-[#0a6ebd]" href="#platform">
              Platform
            </a>
            <a className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-sky-50 hover:text-[#0a6ebd]" href="#access">
              Access
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a className="rounded-full border border-sky-200 px-4 py-2 text-sm font-semibold text-[#0a6ebd] transition hover:bg-sky-50" href="/login">
              Log in
            </a>
            <a className="rounded-full bg-[#0a6ebd] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#084f8a]" href="/register">
              Register
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(10,110,189,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(46,125,50,0.12),_transparent_30%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#0a6ebd] shadow-sm">
                Live station monitoring
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#1a2332] sm:text-5xl lg:text-6xl">
                A clean control center for weather station operations.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Monitor station health, review weather data, and keep the platform ready for the backend data flow already present in the project.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a className="rounded-full bg-[#0a6ebd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#084f8a]" href="/dashboard">
                  Open dashboard
                </a>
                <a className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-[#0a6ebd]" href="#features">
                  Explore features
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ['Station health', 'Live summaries for every site'],
                  ['User access', 'Login and registration flow'],
                  ['AI insights', 'Analytics space for future models'],
                ].map(([title, text]) => (
                  <article key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <p className="text-sm font-semibold text-[#1a2332]">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative z-10 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Overview</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1a2332]">Platform snapshot</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Operational</span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ['Stations online', '12'],
                  ['Alerts open', '03'],
                  ['Data freshness', '98%'],
                  ['Sync latency', '1.8s'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[#1a2332]">{value}</p>
                  </div>
                ))}
              </div>

              <div id="features" className="mt-6 rounded-3xl bg-[#0a6ebd] p-5 text-white">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-100">Platform focus</p>
                <p className="mt-3 text-sm leading-7 text-sky-50/90">
                  This frontend is being designed to match the backend pages, so the UI stays aligned with landing, authentication, and dashboard flows.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                ['Weather dashboard', 'A central place for station summaries and alerts.'],
                ['Authentication', 'Dedicated login and registration screens.'],
                ['Operational structure', 'Ready for backend-backed data integration.'],
              ].map(([title, text]) => (
                <article key={title} className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-6">
                  <p className="text-lg font-semibold text-[#1a2332]">{title}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="access" className="border-t border-slate-200 bg-[#f8fafc]">
          <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
            <div className="flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">Get started</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1a2332]">Move into the dashboard or open an account.</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-[#0a6ebd]" href="/login">
                  Log in
                </a>
                <a className="rounded-full bg-[#0a6ebd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#084f8a]" href="/register">
                  Create account
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
