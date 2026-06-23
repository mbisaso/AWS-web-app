import { useEffect, useMemo, useState } from 'react'
import type { ReportConfig, ReportType, ReportFormat, StationReading } from '../../services/api'
import { REPORT_TYPE_LABELS, REPORT_TYPE_DESCRIPTIONS, getDefaultMetricsForType } from '../../services/api'
import type { ReportMetricSection } from '../../services/api'
import { StationDropdown } from '../shared/StationDropdown'
import { DateRangePicker } from '../shared/DateRangePicker'
import { ReportPreview } from './ReportPreview'

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

interface ReportBuilderFormProps {
  stations: StationReading[]
  onGenerate: (config: ReportConfig) => void
  isGenerating: boolean
}

export function ReportBuilderForm({ stations, onGenerate, isGenerating }: ReportBuilderFormProps) {
  const [type, setType] = useState<ReportType>('station_summary')
  const [stationIds, setStationIds] = useState<number[]>([])
  const [dateFrom, setDateFrom] = useState(daysAgo(7))
  const [dateTo, setDateTo] = useState(toISODate(new Date()))
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [metrics, setMetrics] = useState<ReportMetricSection[]>(() => getDefaultMetricsForType('station_summary'))
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null)

  /* Reset metrics when report type changes */
  useEffect(() => {
    const defaults = getDefaultMetricsForType(type)
    setMetrics(defaults)
    if (format === 'csv') {
      setMetrics(defaults.map((m) => ({ ...m, checked: m.available_in_csv })))
    }
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Re-check CSV availability when toggling format */
  useEffect(() => {
    if (format === 'csv') {
      setMetrics((prev) => prev.map((m) => ({ ...m, checked: m.checked && m.available_in_csv })))
    }
  }, [format])

  const toggleMetric = (id: string) => {
    setMetrics((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m)),
    )
  }

  const handleStationChange = (id: number | null) => {
    setSelectedStationId(id)
    if (id) setStationIds([id])
    else setStationIds([])
  }

  const config: ReportConfig = useMemo(
    () => ({
      type,
      station_ids: stationIds,
      date_from: dateFrom,
      date_to: dateTo,
      format,
      metrics: metrics.filter((m) => m.checked).map((m) => m.id),
    }),
    [type, stationIds, dateFrom, dateTo, format, metrics],
  )

  const stationNames = stationIds.length
    ? stationIds
        .map((id) => stations.find((s) => s.id === id)?.name ?? `Station #${id}`)
        .join(', ')
    : 'All stations'

  const canGenerate = config.metrics.length > 0 && dateFrom < dateTo && !isGenerating

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <h2 className="mb-5 text-base font-semibold text-midnight font-display">Generate a report</h2>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Left column: config */}
        <div className="space-y-5">
          {/* ── Report type ── */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
              Report type
            </legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                    type === t
                      ? 'border-sky-primary bg-sky-soft'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  aria-pressed={type === t}
                >
                  <p className={`text-xs font-semibold ${type === t ? 'text-sky-deep' : 'text-midnight'}`}>
                    {REPORT_TYPE_LABELS[t]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-storm/40 leading-snug">
                    {REPORT_TYPE_DESCRIPTIONS[t]}
                  </p>
                </button>
              ))}
            </div>
          </fieldset>

          {/* ── Scope ── */}
          <div className="space-y-3">
            <StationDropdown
              stations={stations}
              selectedStationId={selectedStationId}
              onChange={handleStationChange}
            />
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
          </div>

          {/* ── Format ── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Format</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Report format">
              {(['pdf', 'csv'] as ReportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                    format === f
                      ? 'border-sky-primary bg-sky-soft text-sky-deep'
                      : 'border-slate-200 bg-white text-storm/60 hover:border-slate-300'
                  }`}
                  role="radio"
                  aria-checked={format === f}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            {format === 'csv' && (
              <p className="mt-1.5 text-[11px] text-storm/40">
                CSV is data only. Chart/visual sections will be omitted.
              </p>
            )}
          </div>
        </div>

        {/* Right column: metrics + preview */}
        <div className="space-y-5">
          {/* ── Metrics ── */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
              Sections to include
            </legend>
            <div className="space-y-1.5">
              {metrics.map((m) => {
                const disabled = format === 'csv' && !m.available_in_csv
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                      disabled
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : m.checked
                          ? 'border-sky-primary/30 bg-sky-soft/40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={m.checked}
                      disabled={disabled}
                      onChange={() => toggleMetric(m.id)}
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-primary focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium ${disabled ? 'text-storm/40' : 'text-midnight'}`}>
                        {m.label}
                      </p>
                      {disabled && (
                        <p className="text-[10px] text-storm/30 mt-0.5">Not available in CSV</p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="mt-5">
        <ReportPreview config={config} stationNames={stationNames} />
      </div>

      {/* ── Generate button ── */}
      <div className="mt-5 flex items-center justify-end gap-3">
        {isGenerating && (
          <span className="flex items-center gap-2 text-sm text-storm/60">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Generating…
          </span>
        )}
        <button
          type="button"
          onClick={() => onGenerate(config)}
          disabled={!canGenerate}
          className="cursor-pointer rounded-xl bg-sky-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate now
        </button>
      </div>
    </div>
  )
}
