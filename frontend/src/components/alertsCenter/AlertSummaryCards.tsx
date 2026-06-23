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

  const severityCards: { severity: AlertSeverity | 'unresolved'; label: string; count: number; dotClass: string; textClass: string }[] = [
    { severity: 'unresolved' as any, label: 'Unresolved', count: unresolvedCount, dotClass: 'bg-rose', textClass: 'text-rose' },
    { severity: 'critical', label: 'Critical', count: criticalCount, dotClass: 'bg-rose', textClass: 'text-rose' },
    { severity: 'warning', label: 'Warning', count: warningCount, dotClass: 'bg-amber', textClass: 'text-amber' },
    { severity: 'info', label: 'Info', count: infoCount, dotClass: 'bg-sky-bright', textClass: 'text-sky-bright' },
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
              className={`cursor-pointer rounded-2xl border p-5 text-left shadow-xs transition-all duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                isActive ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white'
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
              <p className="mt-3 text-3xl font-bold text-midnight font-display tabular-nums">
                {card.count}
              </p>
              <p className="mt-1 text-xs text-storm/40">
                {card.severity === 'unresolved'
                  ? 'needs attention'
                  : `${((card.count / (alerts.length || 1)) * 100).toFixed(0)}% of total`}
              </p>
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
                  type === 'station_offline' ? 'bg-rose' :
                  type === 'sensor_anomaly' ? 'bg-amber' :
                  type === 'sim_expiring' ? 'bg-amber' :
                  type === 'low_battery' ? 'bg-amber' :
                  'bg-sky-bright'
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
