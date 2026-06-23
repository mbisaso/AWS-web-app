import type { PowerCurrentReading } from '../../services/api'

interface PowerStatusCardProps {
  reading: PowerCurrentReading | null | undefined
  isLoading?: boolean
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
      <div className="mb-3 h-3 w-16 rounded-full bg-slate-200" />
      <div className="mb-2 h-8 w-20 rounded-lg bg-slate-200" />
      <div className="h-3 w-24 rounded-full bg-slate-100" />
    </div>
  )
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">{label}</p>
      <p className="mt-2 text-2xl font-bold text-storm/30 font-display">—</p>
      <p className="mt-1 text-xs text-storm/30">No data</p>
    </div>
  )
}

/* ── Battery-fill visual ── */

function BatteryFill({ level }: { level: number }) {
  const segments = 5
  const filled = Math.round((level / 100) * segments)
  const color =
    level >= 60 ? 'bg-emerald'
    : level >= 30 ? 'bg-amber'
    : 'bg-rose'

  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Battery ${level}%`}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`h-6 w-3 rounded-sm transition-colors duration-500 ${
            i < filled ? color : 'bg-slate-100'
          } ${i === 0 ? 'rounded-l-sm' : ''} ${i === segments - 1 ? 'rounded-r-sm' : ''}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1.5 h-3 w-0.5 rounded-r-sm bg-storm/20" aria-hidden="true" />
    </div>
  )
}

/* ── Voltage range indicator ── */

function VoltageRange({ v }: { v: number }) {
  const healthy = v >= 12.0 && v <= 14.2
  const color = healthy ? 'text-emerald' : v < 11.5 ? 'text-rose' : 'text-amber'

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${color}`}>
        {healthy ? 'Healthy range' : v < 11.5 ? 'Critical' : 'Low'}
      </span>
      {/* Mini bar */}
      <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, ((v - 10) / 5) * 100))}%`,
            backgroundColor: healthy ? '#22C55E' : v < 11.5 ? '#E11D48' : '#F59E0B',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

/* ── Charging status badge ── */

function ChargingBadge({ status, solarInput }: { status: string; solarInput: number | null }) {
  const isCharging = status === 'charging'
  const isIdle = status === 'idle'

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
          isCharging
            ? 'bg-emerald-100 text-emerald-700'
            : isIdle
              ? 'bg-slate-100 text-storm/50'
              : 'bg-rose-100 text-rose-700'
        }`}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            isCharging ? 'bg-emerald-500' : isIdle ? 'bg-storm/30' : 'bg-rose-500'
          }`}
          aria-hidden="true"
        />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      {solarInput !== null && (
        <span className="text-[10px] text-storm/40">{solarInput.toFixed(0)} W solar</span>
      )}
    </div>
  )
}

/* ── Days remaining badge (echoes SIM expiry warning) ── */

function DaysRemaining({ days }: { days: number }) {
  const urgent = days <= 3
  return (
    <div className="mt-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
          urgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
        Est. {days} day{days !== 1 ? 's' : ''} remaining
      </span>
    </div>
  )
}

/* ── Main component ── */

export function PowerStatusCard({ reading, isLoading }: PowerStatusCardProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!reading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EmptyCard label="Battery Level" />
        <EmptyCard label="Charging" />
        <EmptyCard label="Voltage" />
        <EmptyCard label="Current Draw" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Battery level */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-emerald" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Battery Level</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.battery_level}
          <span className="ml-0.5 text-sm font-medium text-storm/50">%</span>
        </p>
        <div className="mt-3">
          <BatteryFill level={reading.battery_level ?? 0} />
        </div>
        {reading.estimated_days_remaining !== null && (
          <DaysRemaining days={reading.estimated_days_remaining} />
        )}
        {reading.is_stale && (
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Stale
          </span>
        )}
      </div>

      {/* Charging status */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-amber" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Charging</p>
        <div className="mt-2">
          <ChargingBadge status={reading.charging_status ?? 'idle'} solarInput={reading.solar_input} />
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.solar_input !== null ? (
            <>{reading.solar_input}<span className="ml-0.5 text-sm font-medium text-storm/50">W</span></>
          ) : (
            <span className="text-storm/30 text-xl">—</span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-storm/40">Solar input</p>
        {reading.is_stale && (
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Stale
          </span>
        )}
      </div>

      {/* Voltage */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-sky-primary" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Voltage</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.voltage !== null ? (
            <>{reading.voltage}<span className="ml-0.5 text-sm font-medium text-storm/50">V</span></>
          ) : (
            <span className="text-storm/30 text-xl">—</span>
          )}
        </p>
        {reading.voltage !== null && (
          <div className="mt-3">
            <VoltageRange v={reading.voltage} />
          </div>
        )}
        {reading.is_stale && (
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Stale
          </span>
        )}
      </div>

      {/* Current draw */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-orange-500" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Current Draw</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.current_draw !== null ? (
            <>{reading.current_draw}<span className="ml-0.5 text-sm font-medium text-storm/50">A</span></>
          ) : (
            <span className="text-storm/30 text-xl">—</span>
          )}
        </p>
        <p className="mt-2 text-[10px] text-storm/40">
          {reading.current_draw !== null
            ? reading.current_draw < 1
              ? 'Low consumption'
              : reading.current_draw > 3
                ? 'High consumption'
                : 'Normal consumption'
            : ''}
        </p>
        {reading.is_stale && (
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Stale
          </span>
        )}
      </div>
    </div>
  )
}
