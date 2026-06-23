import { type Alert, formatRelativeTime } from '../../services/api'

interface AlertPreviewItemProps {
  alert: Alert
}

const SEVERITY_STYLES: Record<string, { dot: string; icon: string; bg: string; border: string }> = {
  critical: {
    dot: 'bg-rose',
    icon: 'text-rose',
    bg: 'bg-rose-50/50',
    border: 'border-rose-200',
  },
  warning: {
    dot: 'bg-amber',
    icon: 'text-amber',
    bg: 'bg-amber-50/50',
    border: 'border-amber-200',
  },
  info: {
    dot: 'bg-sky-bright',
    icon: 'text-sky-bright',
    bg: 'bg-sky-soft/50',
    border: 'border-sky-light',
  },
}

export function AlertPreviewItem({ alert }: AlertPreviewItemProps) {
  const styles = SEVERITY_STYLES[alert.severity]
  const relativeTime = formatRelativeTime(alert.timestamp)

  return (
    <article
      className={`group cursor-pointer rounded-xl border ${styles.border} ${styles.bg} p-3.5 transition-all duration-200 hover:shadow-sm`}
      role="listitem"
      aria-label={`${alert.severity} alert: ${alert.message}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          /* navigate to alerts center — placeholder for future routing */
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${styles.dot}`}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${styles.icon}`}
            >
              {alert.severity}
            </span>
            <span className="truncate text-xs font-medium text-storm/50">
              {alert.station_name}
            </span>
          </div>

          {/* Message */}
          <p className="mt-1 text-sm leading-snug text-storm/80 line-clamp-2">
            {alert.message}
          </p>

          {/* Timestamp */}
          <p className="mt-1.5 text-xs text-storm/40">{relativeTime}</p>
        </div>
      </div>
    </article>
  )
}
