import type { ReportPeriod } from '../services/api'

export const MAX_REPORT_HOURS = 366 * 24

const pad = (n: number) => String(n).padStart(2, '0')

/** Formats a Date as the local `YYYY-MM-DDTHH:mm` value a datetime-local input expects. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Builds a range period from two datetime-local values, or returns an error message. */
export function rangeFromLocalInputs(from: string, to: string): ReportPeriod | string {
  const start = new Date(from)
  const end = new Date(to)
  if (!from || !to || isNaN(start.getTime()) || isNaN(end.getTime())) return 'Pick both a start and an end'
  if (start >= end) return 'Start must be before end'
  if (start > new Date()) return 'Start cannot be in the future'
  if (end.getTime() - start.getTime() > MAX_REPORT_HOURS * 3_600_000) return 'Period cannot exceed 366 days'
  return { kind: 'range', start: start.toISOString(), end: end.toISOString() }
}

export function isSameReportPeriod(a: ReportPeriod, b: ReportPeriod): boolean {
  if (a.kind === 'rolling' && b.kind === 'rolling') return a.hours === b.hours
  if (a.kind === 'range' && b.kind === 'range') return a.start === b.start && a.end === b.end
  return false
}

/** Short label used in downloaded file names, e.g. `36h`, `7d` or `20261001-0800_20261003-1800`. */
export function reportPeriodFileSuffix(period: ReportPeriod): string {
  if (period.kind === 'rolling') {
    return period.hours % 24 === 0 ? `${period.hours / 24}d` : `${period.hours}h`
  }
  const stamp = (iso: string) => toLocalInputValue(new Date(iso)).replace(/-/g, '').replace('T', '-').replace(':', '')
  return `${stamp(period.start)}_${stamp(period.end)}`
}
