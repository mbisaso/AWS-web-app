import type { SimFleetSummary } from '../../services/api'

interface SimFleetSummaryCardProps {
  summary: SimFleetSummary
  isLoading: boolean
  activeFilter: 'all' | 'expiring' | 'expired'
  onFilter: (filter: 'all' | 'expiring' | 'expired') => void
}

export function SimFleetSummaryCard({ summary, isLoading, activeFilter, onFilter }: SimFleetSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-8 w-12 animate-pulse rounded bg-slate-200" />
            <div className="mt-1 h-3 w-20 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  const cards: {
    label: string
    value: string | number
    sub?: string
    filter: 'all' | 'expiring' | 'expired'
    color: string
    bg: string
    accent: string
  }[] = [
    {
      label: 'Active SIMs',
      value: summary.total_active,
      sub: `of ${summary.total_active + summary.expired_count} total`,
      filter: 'all',
      color: 'text-midnight',
      bg: 'bg-white',
      accent: 'bg-sky-primary',
    },
    {
      label: `Expiring ≤ ${summary.expiring_soon_threshold_days}d`,
      value: summary.expiring_soon_count,
      sub: 'need attention',
      filter: 'expiring',
      color: 'text-amber-600',
      bg: 'bg-amber-50/50',
      accent: 'bg-amber',
    },
    {
      label: 'Expired / Exhausted',
      value: summary.expired_count,
      sub: 'offline or depleted',
      filter: 'expired',
      color: 'text-rose-600',
      bg: 'bg-rose-50/50',
      accent: 'bg-rose',
    },
    {
      label: 'Data remaining',
      value: `${(summary.total_remaining_mb / 1024).toFixed(1)} GB`,
      sub: `(${summary.total_remaining_mb.toLocaleString()} MB)`,
      filter: 'all',
      color: 'text-midnight',
      bg: 'bg-white',
      accent: 'bg-emerald',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const isActive = activeFilter === card.filter
        return (
          <button
            key={card.label}
            type="button"
            onClick={() => onFilter(card.filter)}
            className={`relative cursor-pointer overflow-hidden rounded-2xl border p-5 text-left shadow-xs transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
              isActive
                ? 'border-slate-300 ring-2 ring-sky-primary/20'
                : 'border-slate-200 hover:border-slate-300'
            } ${card.bg}`}
            aria-pressed={isActive}
            aria-label={`${card.label}: ${card.value}. Click to ${isActive ? 'clear filter' : 'filter'}`}
          >
            <div className={`absolute top-0 left-0 h-1 w-full rounded-t-2xl ${card.accent}`} aria-hidden="true" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
              {card.label}
            </p>
            <p className={`mt-1.5 text-2xl font-bold tracking-tight font-display ${card.color}`}>
              {card.value}
            </p>
            {card.sub && (
              <p className="mt-0.5 text-[11px] text-storm/40">
                {card.sub}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
