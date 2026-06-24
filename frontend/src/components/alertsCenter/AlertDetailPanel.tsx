import type { Alert } from '../../services/api'
import { ALERT_TYPE_LABELS, SEVERITY_CONFIG, formatRelativeTime } from '../../services/api'

interface AlertDetailPanelProps {
  alert: Alert
}

function formatExactTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

export function AlertDetailPanel({ alert }: AlertDetailPanelProps) {
  const severity = SEVERITY_CONFIG[alert.severity]

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* Full message */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Message</p>
            <p className="mt-1 text-sm leading-relaxed text-midnight">{alert.message}</p>
          </div>

          {/* ML explanation */}
          {alert.explanation && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">ML Model Reasoning</p>
              <p className="mt-1 text-sm leading-relaxed text-storm/70">{alert.explanation}</p>
            </div>
          )}

          {/* Resolved note */}
          {alert.resolved_note && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Resolution Note</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-deep">{alert.resolved_note}</p>
            </div>
          )}
        </div>

        {/* ── Right column: metadata ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Severity</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full ${severity.bg} ${severity.text} px-2.5 py-0.5 text-xs font-semibold`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${severity.dot}`} aria-hidden="true" />
              {severity.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Type</span>
            <span className="text-sm font-medium text-midnight">{ALERT_TYPE_LABELS[alert.type]}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Station</span>
            <span className="text-sm font-medium text-midnight">{alert.station_name}</span>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Timeline</p>
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                <span className="text-storm/60">Alert created</span>
                <span className="font-medium text-midnight" title={formatExactTime(alert.timestamp)}>
                  {formatRelativeTime(alert.timestamp)}
                </span>
              </div>
              {alert.is_resolved && alert.resolved_at && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald" aria-hidden="true" />
                  <span className="text-storm/60">Resolved</span>
                  <span className="font-medium text-midnight" title={formatExactTime(alert.resolved_at)}>
                    {formatRelativeTime(alert.resolved_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Related links */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={`/dashboard/weather-data?station_id=${alert.station_id}`}
              className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-3 py-1 text-xs font-medium text-sky-deep transition-colors hover:bg-sky-mist"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
              </svg>
              View weather data
            </a>
            <a
              href={`/dashboard/power-data?station_id=${alert.station_id}`}
              className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-3 py-1 text-xs font-medium text-sky-deep transition-colors hover:bg-sky-mist"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
              </svg>
              View power data
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
