import { useState } from 'react'
import type { ReportPeriod } from '../../services/api'
import { MAX_REPORT_HOURS, rangeFromLocalInputs, toLocalInputValue } from '../../utils/reportPeriod'

const PRESETS = [
  { hours: 24, label: '24 Hours' },
  { hours: 168, label: '7 Days' },
  { hours: 720, label: '30 Days' },
  { hours: 2160, label: '90 Days' },
]

type Mode = 'preset' | 'custom' | 'calendar'
type Unit = 'hours' | 'days'

interface ReportPeriodPickerProps {
  /** The current valid period, or null while the custom inputs are incomplete. */
  value: ReportPeriod | null
  onChange: (period: ReportPeriod | null) => void
}

const chipClass = (active: boolean) =>
  `rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
    active ? 'bg-sky-primary text-white shadow-sm' : 'bg-slate-100 text-storm/70 hover:bg-slate-200'
  }`

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-midnight focus:border-sky-primary focus:outline-none focus:ring-1 focus:ring-sky-primary'

export function ReportPeriodPicker({ value, onChange }: ReportPeriodPickerProps) {
  const [mode, setMode] = useState<Mode>('preset')
  const [amount, setAmount] = useState(12)
  const [unit, setUnit] = useState<Unit>('hours')
  const [from, setFrom] = useState(() => toLocalInputValue(new Date(Date.now() - 24 * 3_600_000)))
  const [to, setTo] = useState(() => toLocalInputValue(new Date()))
  const [rangeError, setRangeError] = useState<string | null>(null)

  const nowInput = toLocalInputValue(new Date())

  const emitCustom = (nextAmount: number, nextUnit: Unit) => {
    const hours = Math.min(MAX_REPORT_HOURS, nextAmount * (nextUnit === 'days' ? 24 : 1))
    onChange({ kind: 'rolling', hours })
  }

  const emitRange = (nextFrom: string, nextTo: string) => {
    const result = rangeFromLocalInputs(nextFrom, nextTo)
    if (typeof result === 'string') {
      setRangeError(result)
      onChange(null)
    } else {
      setRangeError(null)
      onChange(result)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.hours}
            type="button"
            onClick={() => {
              setMode('preset')
              onChange({ kind: 'rolling', hours: p.hours })
            }}
            className={chipClass(mode === 'preset' && value?.kind === 'rolling' && value.hours === p.hours)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setMode('custom')
            emitCustom(amount, unit)
          }}
          className={chipClass(mode === 'custom')}
        >
          Custom
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('calendar')
            emitRange(from, to)
          }}
          className={`inline-flex items-center gap-1.5 ${chipClass(mode === 'calendar')}`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Calendar
        </button>
      </div>

      {mode === 'custom' && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-storm/60">Last</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={e => {
              const next = Math.max(1, parseInt(e.target.value) || 1)
              setAmount(next)
              emitCustom(next, unit)
            }}
            aria-label="Period length"
            className="w-20 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-center text-xs font-semibold text-midnight focus:border-sky-primary focus:outline-none focus:ring-1 focus:ring-sky-primary"
          />
          <div className="flex rounded-full bg-slate-100 p-0.5" role="group" aria-label="Period unit">
            {(['hours', 'days'] as const).map(u => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => {
                  setUnit(u)
                  emitCustom(amount, u)
                }}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-bold uppercase transition-all ${
                  unit === u ? 'bg-white text-midnight shadow-xs' : 'text-storm/50 hover:text-midnight'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'calendar' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="report-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-storm/40">
                From
              </label>
              <input
                id="report-from"
                type="datetime-local"
                value={from}
                max={to || nowInput}
                onChange={e => {
                  setFrom(e.target.value)
                  emitRange(e.target.value, to)
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="report-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-storm/40">
                To
              </label>
              <input
                id="report-to"
                type="datetime-local"
                value={to}
                min={from}
                max={nowInput}
                onChange={e => {
                  setTo(e.target.value)
                  emitRange(from, e.target.value)
                }}
                className={inputClass}
              />
            </div>
          </div>
          {rangeError && <p role="alert" className="text-xs font-medium text-rose-600">{rangeError}</p>}
        </div>
      )}
    </div>
  )
}
