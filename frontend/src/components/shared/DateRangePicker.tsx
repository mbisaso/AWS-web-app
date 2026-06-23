import { useCallback, useEffect, useState } from 'react'
import { DATE_PRESETS } from '../../services/api'

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

interface DateRangePickerProps {
  dateFrom: string
  dateTo: string
  onChange: (from: string, to: string) => void
}

export function DateRangePicker({ dateFrom, dateTo, onChange }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<number | null>(7)
  const [customMode, setCustomMode] = useState(false)

  const handlePreset = useCallback(
    (days: number) => {
      setActivePreset(days)
      setCustomMode(false)
      onChange(daysAgo(days), toISODate(new Date()))
    },
    [onChange],
  )

  useEffect(() => {
    handlePreset(7)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">
        Date range
      </p>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Date range presets">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => handlePreset(p.days)}
            className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              !customMode && activePreset === p.days
                ? 'bg-midnight text-white shadow-xs'
                : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
            }`}
            aria-pressed={!customMode && activePreset === p.days}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCustomMode(true)
            setActivePreset(null)
          }}
          className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            customMode
              ? 'bg-midnight text-white shadow-xs'
              : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
          }`}
          aria-pressed={customMode}
        >
          Custom
        </button>
      </div>

      {customMode && (
        <div className="mt-2 flex items-end gap-2">
          <div>
            <label htmlFor="date-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-storm/40">
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onChange(e.target.value, dateTo)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-midnight focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="date-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-storm/40">
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => onChange(dateFrom, e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-midnight focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
