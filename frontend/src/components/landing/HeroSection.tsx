import { useScrollReveal } from '../../hooks/useScrollReveal'
import { ArrowRightIcon, MapPinIcon, ClockIcon, BellIcon } from './Icons'

export function HeroSection() {
  const { ref: contentRef, isVisible: contentVisible } = useScrollReveal()
  const { ref: cardRef, isVisible: cardVisible } = useScrollReveal({ threshold: 0.05 })

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* ── Animated sky gradient background ── */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-sky-soft via-sky-mist via-40% to-white bg-[length:200%_200%] animate-gradient-shift"
      />

      {/* ── Decorative gradient orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-sky-primary/8 to-sky-bright/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-sunset/8 to-sunset-light/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-bright/5 to-sky-primary/5 blur-3xl" />
      </div>

      {/* ── Floating cloud elements ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <svg
          className="absolute top-[12%] left-[5%] h-16 w-24 text-white/30 animate-float-drift-slow"
          viewBox="0 0 120 48"
          fill="currentColor"
        >
          <ellipse cx="60" cy="40" rx="55" ry="8" />
          <ellipse cx="85" cy="32" rx="30" ry="16" />
          <ellipse cx="55" cy="28" rx="35" ry="18" />
          <ellipse cx="30" cy="34" rx="24" ry="12" />
        </svg>
        <svg
          className="absolute top-[22%] right-[8%] h-12 w-20 text-white/20 animate-float-drift"
          viewBox="0 0 120 48"
          fill="currentColor"
        >
          <ellipse cx="60" cy="40" rx="55" ry="8" />
          <ellipse cx="85" cy="32" rx="30" ry="16" />
          <ellipse cx="55" cy="28" rx="35" ry="18" />
          <ellipse cx="30" cy="34" rx="24" ry="12" />
        </svg>
        <svg
          className="absolute top-[45%] left-[60%] h-20 w-32 text-white/25 animate-float-drift-slower"
          viewBox="0 0 120 48"
          fill="currentColor"
        >
          <ellipse cx="60" cy="40" rx="55" ry="8" />
          <ellipse cx="85" cy="32" rx="30" ry="16" />
          <ellipse cx="55" cy="28" rx="35" ry="18" />
          <ellipse cx="30" cy="34" rx="24" ry="12" />
        </svg>
      </div>

      {/* ── Main content area ── */}
      <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-20 lg:px-8 lg:pt-36 lg:pb-28">
        <div className="grid gap-16 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
          {/* ── Left: Hero text ── */}
          <div
            ref={contentRef}
            className={`transition-all duration-700 ease-out ${
              contentVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-light bg-white/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-deep shadow-xs backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live station monitoring
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-midnight sm:text-5xl lg:text-6xl font-display leading-[1.1]">
              A clean control center for{' '}
              <span className="bg-gradient-to-r from-sky-primary to-sky-deep bg-clip-text text-transparent">
                weather station
              </span>{' '}
              operations.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-storm/70 sm:text-lg">
              Monitor station health, review environmental data, and keep your WIMEA-ICT network
              running at peak performance — all from a single, intuitive dashboard.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-primary to-sky-deep px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200/50 transition-all duration-300 hover:shadow-xl hover:shadow-sky-200/60 hover:brightness-110 cursor-pointer"
              >
                Open dashboard
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/60 px-6 py-3 text-sm font-semibold text-storm transition-all duration-200 hover:border-sky-bright hover:bg-white hover:text-sky-primary cursor-pointer backdrop-blur-sm"
              >
                Explore features
              </a>
            </div>

            {/* ── Mini stats cards ── */}
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <HeroMiniCard
                icon={<MapPinIcon className="h-5 w-5 text-sky-primary" />}
                title="Station health"
                description="Live summaries for every site"
              />
              <HeroMiniCard
                icon={<ClockIcon className="h-5 w-5 text-sky-primary" />}
                title="Real-time data"
                description="Instant readings from sensors"
              />
              <HeroMiniCard
                icon={<BellIcon className="h-5 w-5 text-sky-primary" />}
                title="Smart alerts"
                description="Get notified of anomalies"
              />
            </div>
          </div>

          {/* ── Right: Platform snapshot card ── */}
          <div
            ref={cardRef}
            className={`transition-all duration-700 delay-200 ease-out ${
              cardVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
          >
            <div className="rounded-3xl border border-sky-200/60 bg-white/70 p-6 shadow-xl shadow-sky-200/20 backdrop-blur-md lg:p-8">
              {/* Card header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-storm/40">
                    Snapshot
                  </p>
                  <h2 className="mt-1.5 text-2xl font-semibold text-midnight font-display">
                    Platform overview
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-deep">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-soft" />
                  Operational
                </span>
              </div>

              {/* Metric grid */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <PlatformMetricCard label="Stations online" value="12" />
                <PlatformMetricCard label="Alerts open" value="03" variant="warning" />
                <PlatformMetricCard label="Data freshness" value="98%" />
                <PlatformMetricCard label="Sync latency" value="1.8s" />
              </div>

              {/* Info callout */}
              <div className="mt-6 rounded-2xl bg-gradient-to-br from-sky-primary to-sky-deep p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-light">
                  Platform focus
                </p>
                <p className="mt-2 text-sm leading-7 text-white/80">
                  This frontend is designed to work seamlessly with the Django backend —
                  covering landing, authentication, and the full weather dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Sub-components ── */

function HeroMiniCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <article className="group cursor-pointer rounded-2xl border border-sky-100 bg-white/70 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/50 backdrop-blur-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-soft transition-colors duration-300 group-hover:bg-sky-mist">
        {icon}
      </div>
      <p className="text-sm font-semibold text-midnight">{title}</p>
      <p className="mt-1 text-sm leading-6 text-storm/60">{description}</p>
    </article>
  )
}

function PlatformMetricCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string
  variant?: 'default' | 'warning'
}) {
  const valueColor =
    variant === 'warning'
      ? 'text-sunset'
      : 'text-midnight'

  return (
    <div className="rounded-2xl border border-sky-100 bg-white/50 p-4 transition-all duration-200 hover:border-sky-200 hover:bg-white/80">
      <p className="text-xs text-storm/50">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${valueColor} font-display`}>{value}</p>
    </div>
  )
}
