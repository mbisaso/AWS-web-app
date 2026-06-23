import type { Alert, AlertSeverity } from '../../services/api'
import { ALERT_TYPE_LABELS, type AlertType } from '../../services/api'

interface AlertSummaryCardsProps {
  alerts: Alert[]
  isLoading: boolean
  activeSeverity: AlertSeverity | 'all'
  onSeverityFilter: (severity: AlertSeverity | 'all') => void
}

export function AlertSummaryCards({ alerts, isLoading, activeSeverity, onSeverityFilter }: AlertSummaryCardsProps) {
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount = alerts.filter((a) => a.severity === 'warning').length
  const infoCount = alerts.filter((a) => a.severity === 'info').length
  const unresolvedCount = alerts.filter((a) => !a.is_resolved).length

  const typeCounts: Partial<Record<AlertType, number>> = {}
  for (const a of alerts) {
    typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  const severityCards: {
    severity: AlertSeverity | 'unresolved'
    label: string
    count: number
    dotClass: string
    textClass: string
    borderClass: string
    bgClass: string
    activeGlow: string
  }[] = [
    {
      severity: 'unresolved' as any,
      label: 'Unresolved', count: unresolvedCount,
      dotClass: 'bg-orange-500', textClass: 'text-orange-500',
      borderClass: 'border-t-orange-500',
      bgClass: 'bg-gradient-to-b from-orange-50/30 to-white',
      activeGlow: 'ring-2 ring-orange-500/20 ring-offset-1',
    },
    {
      severity: 'critical', label: 'Critical', count: criticalCount,
      dotClass: 'bg-red-500', textClass: 'text-red-600',
      borderClass: 'border-t-red-500',
      bgClass: 'bg-gradient-to-b from-red-50/20 to-white',
      activeGlow: 'ring-2 ring-red-500/20 ring-offset-1',
    },
    {
      severity: 'warning', label: 'Warning', count: warningCount,
      dotClass: 'bg-yellow-500', textClass: 'text-yellow-500',
      borderClass: 'border-t-yellow-500',
      bgClass: 'bg-gradient-to-b from-yellow-50/20 to-white',
      activeGlow: 'ring-2 ring-yellow-500/20 ring-offset-1',
    },
    {
      severity: 'info', label: 'Info', count: infoCount,
      dotClass: 'bg-blue-500', textClass: 'text-blue-500',
      borderClass: 'border-t-blue-500',
      bgClass: 'bg-gradient-to-b from-blue-50/40 to-white',
      activeGlow: 'ring-2 ring-blue-500/20 ring-offset-1',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {severityCards.map((card) => {
          const isActive = card.severity === activeSeverity || (card.severity === 'unresolved' && activeSeverity === 'all')
          return (
            <button
              key={card.severity as string}
              type="button"
              onClick={() => {
                if (card.severity === 'unresolved') {
                  onSeverityFilter(activeSeverity === 'all' ? 'all' : 'all')
                } else {
                  onSeverityFilter(activeSeverity === card.severity ? 'all' : card.severity)
                }
              }}
              className={`relative cursor-pointer rounded-2xl border border-t-[3px] p-5 text-left shadow-xs transition-all duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                isActive
                  ? `border-slate-200 ${card.borderClass} ${card.bgClass} ${card.activeGlow}`
                  : 'border-slate-200 border-t-slate-200 bg-white hover:border-t-slate-300'
              }`}
              aria-pressed={isActive}
              aria-label={`${card.count} ${card.label} alerts. Click to ${isActive ? 'clear filter' : 'filter by ' + card.label}`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${card.textClass}`}>
                  {card.label}
                </p>
                <span className={`flex h-2.5 w-2.5 rounded-full ${card.dotClass}`} aria-hidden="true" />
              </div>
              <p className={`mt-3 text-3xl font-bold font-display tabular-nums transition-colors duration-200 ${
                isActive ? card.textClass : 'text-midnight'
              }`}>
                {card.count}
              </p>
              <p className="mt-1 text-xs text-storm/40">
                {card.severity === 'unresolved'
                  ? 'needs attention'
                  : `${((card.count / (alerts.length || 1)) * 100).toFixed(0)}% of total`}
              </p>

              {/* Subtle decorative corner gradient */}
              <div className="pointer-events-none absolute -top-px right-0 h-16 w-16 rounded-bl-full opacity-30"
                style={{
                  background: card.severity === 'critical' || card.severity === 'unresolved'
                    ? card.severity === 'unresolved'
                      ? 'radial-gradient(circle at top right, rgba(249,115,22,0.15), transparent)'
                      : 'radial-gradient(circle at top right, rgba(239,68,68,0.15), transparent)'
                    : card.severity === 'warning'
                    ? 'radial-gradient(circle at top right, rgba(234,179,8,0.12), transparent)'
                    : 'radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent)'
                }}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      {/* ── Type breakdown chips ── */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Alert type breakdown">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-storm/40">By type:</span>
        {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map((type) => {
          const count = typeCounts[type] ?? 0
          if (count === 0) return null
          return (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-storm/60 shadow-xs"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  type === 'station_offline' ? 'bg-red-500' :
                  type === 'sensor_anomaly' ? 'bg-yellow-500' :
                  type === 'sim_expiring' ? 'bg-yellow-500' :
                  type === 'low_battery' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                aria-hidden="true"
              />
              {ALERT_TYPE_LABELS[type]}
              <span className="font-semibold text-storm/80">{count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
