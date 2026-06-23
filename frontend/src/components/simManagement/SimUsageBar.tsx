interface SimUsageBarProps {
  used: number
  total: number
}

export function SimUsageBar({ used, total }: SimUsageBarProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  const remaining = Math.max(0, total - used)

  const fillColor =
    pct >= 90 ? 'from-sky-primary to-rose'
    : pct >= 70 ? 'from-sky-primary to-amber'
    : 'from-sky-primary to-emerald'

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-midnight">
          {used.toLocaleString()} / {total.toLocaleString()} MB
          <span className="ml-1 text-storm/40 font-normal">({pct.toFixed(0)}%)</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-storm/60">
          {remaining.toLocaleString()} MB left
        </span>
      </div>
      <div className="group relative mt-1.5 h-4 w-full">
        <div className="absolute inset-0 rounded-full bg-sky-soft" aria-hidden="true" />
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${fillColor} transition-all duration-500 motion-reduce:duration-0`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        {/* Diamond marker at usage point */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 motion-reduce:duration-0"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="drop-shadow-xs">
            <polygon points="5,0 10,5 5,10 0,5" fill={pct >= 90 ? '#E11D48' : pct >= 70 ? '#F59E0B' : '#22C55E'} />
          </svg>
        </div>
        {/* Tick marks at quarter intervals */}
        {[25, 50, 75].map((tick) => (
          <div
            key={tick}
            className="absolute top-0 h-full w-px bg-white/40"
            style={{ left: `${tick}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="sr-only">{pct.toFixed(0)} percent used, {remaining.toLocaleString()} megabytes remaining</span>
    </div>
  )
}
