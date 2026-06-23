import type { ScheduledReport } from '../../services/api'
import { REPORT_TYPE_LABELS, SCHEDULE_FREQUENCY_LABELS } from '../../services/api'

interface ScheduleListProps {
  schedules: ScheduledReport[]
  isLoading: boolean
  onToggle: (schedule: ScheduledReport) => void
  onEdit: (schedule: ScheduledReport) => void
  onDelete: (schedule: ScheduledReport) => void
  onCreate: () => void
}

export function ScheduleList({ schedules, isLoading, onToggle, onEdit, onDelete, onCreate }: ScheduleListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!schedules.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky-bright">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-midnight">No scheduled reports yet</p>
        <p className="mt-1 text-xs text-storm/40">Create a schedule to automatically generate reports.</p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 cursor-pointer rounded-full bg-sky-soft px-4 py-2 text-xs font-semibold text-sky-deep transition-colors hover:bg-sky-mist"
        >
          Create schedule
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
          {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
        >
          + New schedule
        </button>
      </div>

      {schedules.map((s) => (
        <div
          key={s.id}
          className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-slate-300"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-midnight">{s.name}</h4>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-storm/50'
                }`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-storm/30'}`} aria-hidden="true" />
                  {s.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-storm/50">
                <span>{REPORT_TYPE_LABELS[s.type]}</span>
                <span>{s.format.toUpperCase()}</span>
                <span>{SCHEDULE_FREQUENCY_LABELS[s.frequency]}</span>
                <span>{s.scope_summary}</span>
                <span>Next: {new Date(s.next_run).toLocaleDateString()} {s.time_of_day}</span>
                {s.recipients.length > 0 && <span>{s.recipients.length} recipient{s.recipients.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onToggle(s)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                  s.is_active
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
                aria-label={s.is_active ? 'Pause schedule' : 'Activate schedule'}
              >
                {s.is_active ? 'Pause' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => onEdit(s)}
                className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold text-sky-primary transition-colors hover:bg-sky-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(s)}
                className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
