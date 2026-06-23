export type StationFilter = 'all' | 'online' | 'offline' | 'fault'

interface StatusFilterBarProps {
  current: StationFilter
  onChange: (filter: StationFilter) => void
  counts: Record<StationFilter, number>
}

const OPTIONS: { key: StationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'fault', label: 'Fault' },
]

export function StatusFilterBar({ current, onChange, counts }: StatusFilterBarProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-md"
      role="group"
      aria-label="Filter stations by status"
    >
      {OPTIONS.map(({ key, label }) => (
        <FilterChip
          key={key}
          label={label}
          count={counts[key]}
          isActive={current === key}
          onClick={() => onChange(key)}
        />
      ))}
    </div>
  )
}

function FilterChip({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}) {
  const activeStyles =
    'bg-midnight text-white shadow-xs'
  const inactiveStyles =
    'text-storm/60 hover:text-storm hover:bg-slate-100/70'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-primary/50 ${
        isActive ? activeStyles : inactiveStyles
      }`}
      aria-pressed={isActive}
    >
      {label}
      <span
        className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-tight ${
          isActive
            ? 'bg-white/20 text-white'
            : 'bg-slate-200/70 text-storm/50'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
