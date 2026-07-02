import { useCallback, useEffect, useState } from 'react'
import type { ScheduledReport, ReportType, ReportFormat, ScheduleFrequency, StationReading } from '../../services/api'
import { REPORT_TYPE_LABELS, SCHEDULE_FREQUENCY_LABELS, getDefaultMetricsForType } from '../../services/api'

interface ScheduleFormModalProps {
  open: boolean
  schedule: ScheduledReport | null
  stations: StationReading[]
  onSave: (data: Partial<ScheduledReport>) => Promise<void>
  onClose: () => void
}

export function ScheduleFormModal({ open, schedule, stations, onSave, onClose }: ScheduleFormModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ReportType>('station_summary')
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [stationIds, setStationIds] = useState<number[]>([])
  const [dateRangeDays, setDateRangeDays] = useState(7)
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily')
  const [timeOfDay, setTimeOfDay] = useState('08:00')
  const [recipientsText, setRecipientsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; recipients?: string; time?: string }>({})

  useEffect(() => {
    if (open) {
      if (schedule) {
        setName(schedule.name)
        setType(schedule.type)
        setFormat(schedule.format)
        setStationIds(schedule.station_ids)
        setDateRangeDays(schedule.date_range_days)
        setFrequency(schedule.frequency)
        setTimeOfDay(schedule.time_of_day)
        setRecipientsText(schedule.recipients.join('\n'))
      } else {
        setName('')
        setType('station_summary')
        setFormat('pdf')
        setStationIds([])
        setDateRangeDays(7)
        setFrequency('daily')
        setTimeOfDay('08:00')
        setRecipientsText('')
      }
      setErrors({})
      setSaved(false)
    }
  }, [open, schedule])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, saving, onClose])

  const validate = useCallback((): boolean => {
    const errs: { name?: string; recipients?: string; time?: string } = {}
    if (!name.trim()) errs.name = 'Schedule name is required'
    const emails = recipientsText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (emails.length === 0) {
      errs.recipients = 'At least one recipient email is required'
    } else {
      const invalid = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      if (invalid.length) errs.recipients = `Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`
    }
    const [hh, mm] = timeOfDay.split(':').map(Number)
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      errs.time = 'Invalid time'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [name, recipientsText, timeOfDay])

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const emails = recipientsText.split('\n').map((s) => s.trim()).filter(Boolean)
      const now = new Date()
      const nextRunDate = new Date(now)
      if (frequency === 'daily') nextRunDate.setDate(nextRunDate.getDate() + 1)
      else if (frequency === 'weekly') nextRunDate.setDate(nextRunDate.getDate() + 7)
      else nextRunDate.setMonth(nextRunDate.getMonth() + 1)
      const [hh, mm] = timeOfDay.split(':').map(Number)
      nextRunDate.setHours(hh, mm, 0, 0)

      const defaults = getDefaultMetricsForType(type)
      const csvFiltered = format === 'csv'
        ? defaults.filter((m) => m.available_in_csv).map((m) => m.id)
        : defaults.map((m) => m.id)

      const scopeSummary = stationIds.length
        ? stationIds.map((id) => stations.find((s) => s.id === id)?.name ?? `Station #${id}`).join(', ')
        : 'All stations'

      await onSave({
        name: name.trim(),
        type,
        format,
        station_ids: stationIds,
        date_range_days: dateRangeDays,
        metrics: csvFiltered,
        frequency,
        time_of_day: timeOfDay,
        recipients: emails,
        scope_summary: scopeSummary,
        next_run: nextRunDate.toISOString(),
      })
      setSaved(true)
      setTimeout(() => onClose(), 1200)
    } catch {
      /* handled by parent */
    } finally {
      setSaving(false)
    }
  }

  const toggleStation = (id: number) => {
    setStationIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-form-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="schedule-form-title" className="text-lg font-semibold text-midnight font-display">
            {schedule ? 'Edit schedule' : 'New scheduled report'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Name */}
          <div>
            <label htmlFor="sched-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Schedule name *</label>
            <input id="sched-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.name ? 'border-red-300' : 'border-slate-200'}`} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Report type</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                    type === t ? 'border-sky-primary bg-sky-soft text-sky-deep' : 'border-slate-200 bg-white text-storm/60 hover:border-slate-300'
                  }`}
                  aria-pressed={type === t}
                >
                  {REPORT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Format</p>
            <div className="flex gap-2">
              {(['pdf', 'csv'] as ReportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`cursor-pointer rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                    format === f ? 'border-sky-primary bg-sky-soft text-sky-deep' : 'border-slate-200 bg-white text-storm/60'
                  }`}
                  role="radio"
                  aria-checked={format === f}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Stations multi-select */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Stations</p>
            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={stationIds.length === 0} onChange={() => setStationIds([])} className="h-4 w-4 rounded border-slate-300 text-sky-primary focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
                <span className="font-medium text-midnight">All stations</span>
              </label>
              {stations.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={stationIds.includes(s.id)}
                    onChange={() => toggleStation(s.id)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-primary focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
                  />
                  <span className="text-midnight">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range / Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sched-days" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Range (days)</label>
              <input id="sched-days" type="number" min={1} max={365} value={dateRangeDays} onChange={(e) => setDateRangeDays(Number(e.target.value) || 7)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
            </div>
            <div>
              <label htmlFor="sched-freq" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Frequency</label>
              <select id="sched-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary">
                {(Object.keys(SCHEDULE_FREQUENCY_LABELS) as ScheduleFrequency[]).map((f) => (
                  <option key={f} value={f}>{SCHEDULE_FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time of day */}
          <div>
            <label htmlFor="sched-time" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Time of day *</label>
            <input id="sched-time" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.time ? 'border-red-300' : 'border-slate-200'}`} />
            {errors.time && <p className="mt-1 text-xs text-red-500">{errors.time}</p>}
          </div>

          {/* Recipients */}
          <div>
            <label htmlFor="sched-recipients" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Recipient emails *</label>
            <textarea
              id="sched-recipients"
              rows={3}
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              className={`w-full resize-none rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.recipients ? 'border-red-300' : 'border-slate-200'}`}
              placeholder="one@example.com&#10;two@example.com"
            />
            {errors.recipients && <p className="mt-1 text-xs text-red-500">{errors.recipients}</p>}
            <p className="mt-1 text-[11px] text-storm/30">One email per line</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <div>
            {saved && <span className="text-sm font-medium text-emerald animate-fade-in-up motion-reduce:animate-none">Saved successfully</span>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-storm/70 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Saving…
                </span>
              ) : (schedule ? 'Save changes' : 'Create schedule')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
