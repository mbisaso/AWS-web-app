import type { PowerChart } from '../../types'

interface PowerStatusCardProps {
  reading: PowerChart | null | undefined
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

function VoltageRange({ v }: { v: number }) {
  const healthy = v >= 12.0 && v <= 14.2
  const color = healthy ? 'text-emerald' : v < 11.5 ? 'text-rose' : 'text-amber'
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${color}`}>
        {healthy ? 'Healthy range' : v < 11.5 ? 'Critical' : 'Low'}
      </span>
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

export function PowerStatusCard({ reading, isLoading }: PowerStatusCardProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!reading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EmptyCard label="Battery Voltage" />
        <EmptyCard label="Solar Voltage" />
        <EmptyCard label="Battery Current" />
        <EmptyCard label="Solar Current" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* Battery voltage */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-sky-primary" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Battery Voltage</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.volt_batt !== null
            ? <>{reading.volt_batt}<span className="ml-0.5 text-sm font-medium text-storm/50">V</span></>
            : <span className="text-storm/30 text-xl">—</span>}
        </p>
        {reading.volt_batt !== null && (
          <div className="mt-3"><VoltageRange v={reading.volt_batt} /></div>
        )}
      </div>

      {/* Solar voltage */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-amber" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Solar Voltage</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.volt_solar !== null
            ? <>{reading.volt_solar}<span className="ml-0.5 text-sm font-medium text-storm/50">V</span></>
            : <span className="text-storm/30 text-xl">—</span>}
        </p>
        {reading.volt_solar !== null && (
          <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            reading.volt_solar > 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-storm/50'
          }`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${reading.volt_solar > 1 ? 'bg-emerald-500' : 'bg-storm/30'}`} aria-hidden="true" />
            {reading.volt_solar > 1 ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>

      {/* Battery current */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-orange-500" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Battery Current</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.curr_batt !== null
            ? <>{reading.curr_batt}<span className="ml-0.5 text-sm font-medium text-storm/50">A</span></>
            : <span className="text-storm/30 text-xl">—</span>}
        </p>
        {reading.curr_batt !== null && (
          <p className="mt-2 text-[10px] text-storm/40">
            {reading.curr_batt < 0.5 ? 'Low draw' : reading.curr_batt > 2 ? 'High draw' : 'Normal draw'}
          </p>
        )}
      </div>

      {/* Solar current */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="absolute top-0 left-0 h-1 w-full rounded-t-2xl bg-emerald" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Solar Current</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-midnight font-display">
          {reading.curr_solar !== null
            ? <>{reading.curr_solar}<span className="ml-0.5 text-sm font-medium text-storm/50">A</span></>
            : <span className="text-storm/30 text-xl">—</span>}
        </p>
        {reading.curr_solar !== null && (
          <p className="mt-2 text-[10px] text-storm/40">
            {reading.curr_solar > 0.1 ? 'Generating' : 'No generation'}
          </p>
        )}
      </div>

    </div>
  )
}
