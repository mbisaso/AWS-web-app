import { useState } from 'react'
import type { Alert } from '../../services/api'
import { ALERT_TYPE_LABELS, SEVERITY_CONFIG, formatRelativeTime } from '../../services/api'
import { AlertDetailPanel } from './AlertDetailPanel'

interface AlertListItemProps {
  alert: Alert
  isSelected: boolean
  onSelect: (selected: boolean) => void
  isNew: boolean
}

function SeverityIcon({ severity }: { severity: Alert['severity'] }) {
  if (severity === 'critical') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    )
  }
  if (severity === 'warning') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </svg>
  )
}

export function AlertListItem({ alert, isSelected, onSelect, isNew }: AlertListItemProps) {
  const [expanded, setExpanded] = useState(false)
  const severity = SEVERITY_CONFIG[alert.severity]

  const borderColor = alert.severity === 'critical' ? 'border-l-rose'
    : alert.severity === 'warning' ? 'border-l-amber'
    : 'border-l-sky-bright'

  return (
    <article
      className={`relative rounded-xl border bg-white shadow-xs transition-all duration-200 ${
        isNew ? 'animate-fade-in-up' : ''
      } ${alert.is_resolved ? 'opacity-60' : ''} ${
        expanded ? 'border-slate-300' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
      role="listitem"
      aria-label={`${alert.severity} alert: ${alert.message}`}
    >
      {/* Colored left accent bar */}
      <div className={`pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full ${borderColor} transition-opacity duration-200 ${
        expanded ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
      }`} aria-hidden="true" />
      {/* ── Row header ── */}
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        {/* Checkbox */}
        <div className="flex shrink-0 items-center pt-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-primary focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
            aria-label={`Select alert ${alert.id}`}
          />
        </div>

        {/* Severity icon */}
        <div className={`mt-0.5 shrink-0 ${severity.text}`}>
          <SeverityIcon severity={alert.severity} />
        </div>

        {/* Content */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary rounded"
          aria-expanded={expanded}
          aria-controls={`alert-detail-${alert.id}`}
        >
          {/* Top row: severity + type + timestamp */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
              alert.severity === 'critical' ? 'bg-rose-50 text-rose' :
              alert.severity === 'warning' ? 'bg-amber-50 text-amber' :
              'bg-sky-soft text-sky-bright'
            }`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                alert.severity === 'critical' ? 'bg-rose' :
                alert.severity === 'warning' ? 'bg-amber' :
                'bg-sky-bright'
              }`} aria-hidden="true" />
              {severity.label}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-storm/60">
              {ALERT_TYPE_LABELS[alert.type]}
            </span>
            {alert.is_resolved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-deep">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Resolved
              </span>
            )}
            <span className="ml-auto shrink-0 text-xs text-storm/40" title={new Date(alert.timestamp).toLocaleString()}>
              {formatRelativeTime(alert.timestamp)}
            </span>
          </div>

          {/* Message */}
          <p className={`mt-1 text-sm leading-snug text-midnight ${expanded ? '' : 'line-clamp-2'}`}>
            {alert.message}
          </p>

          {/* Station name */}
          <p className="mt-1 text-xs text-storm/40">
            {alert.station_name}
          </p>
        </button>

        {/* Expand indicator */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 shrink-0 cursor-pointer rounded-lg p-1 text-storm/30 transition-colors hover:bg-slate-100 hover:text-storm/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div id={`alert-detail-${alert.id}`}>
          <AlertDetailPanel alert={alert} />
        </div>
      )}
    </article>
  )
}
