import { type Alert } from '../../services/api'
import { AlertPreviewItem } from './AlertPreviewItem'

interface RecentAlertsPreviewProps {
  alerts: Alert[]
}

export function RecentAlertsPreview({ alerts }: RecentAlertsPreviewProps) {
  if (alerts.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
            Alerts
          </p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-deep">
            All clear
          </span>
        </div>
        <div className="mt-6 flex flex-col items-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-midnight">No active alerts</p>
          <p className="mt-1 text-xs text-storm/40">All stations are operating normally.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Recent alerts">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
            Recent alerts
          </p>
          <h3 className="mt-1 text-base font-semibold text-midnight font-display">
            Latest notifications
          </h3>
        </div>
        <a
          href="#"
          className="text-xs font-medium text-sky-primary transition-colors duration-200 hover:text-sky-deep cursor-pointer"
        >
          View all
        </a>
      </div>

      <div className="mt-4 space-y-2.5" role="list" aria-label="Alert list">
        {alerts.slice(0, 6).map((alert) => (
          <AlertPreviewItem key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  )
}
