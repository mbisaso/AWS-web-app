import { useState, useRef, useEffect } from 'react'
import type { Station, SensorMetricKey } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'
import { DateRangePicker } from '../shared/DateRangePicker'

type ViewMode = 'trends' | 'comparison' | 'correlation' | 'distribution'

const SENSOR_KEYS = Object.keys(SENSOR_METRIC_CONFIG) as SensorMetricKey[]

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'trends', label: 'Trends' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'correlation', label: 'Correlation' },
  { key: 'distribution', label: 'Distribution' },
]

interface AnalysisControlsProps {
  stations: Station[]
  selectedStationIds: string[]
  onStationIdsChange: (ids: string[]) => void
  selectedMetricKey: SensorMetricKey
  onMetricKeyChange: (key: SensorMetricKey) => void
  correlationMetricB: SensorMetricKey
  onCorrelationMetricBChange: (key: SensorMetricKey) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function AnalysisControls({
  stations,
  selectedStationIds,
  onStationIdsChange,
  selectedMetricKey,
  onMetricKeyChange,
  correlationMetricB,
  onCorrelationMetricBChange,
  dateFrom,
  dateTo,
  onDateChange,
  viewMode,
  onViewModeChange,
}: AnalysisControlsProps) {
  const [stationOpen, setStationOpen] = useState(false)
  const stationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stationRef.current && !stationRef.current.contains(e.target as Node)) {
        setStationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const allSelected = selectedStationIds.length === 0

  function toggleStation(id: string) {
    if (allSelected) {
      onStationIdsChange([id])
    } else {
      const next = selectedStationIds.includes(id)
        ? selectedStationIds.filter((sid) => sid !== id)
        : [...selectedStationIds, id]
      onStationIdsChange(next.length === stations.length ? [] : next)
    }
  }

  const stationLabel = allSelected
    ? `All (${stations.length})`
    : selectedStationIds.length === 1
      ? stations.find((s) => s.station_id === selectedStationIds[0])?.name ?? '1 station'
      : `${selectedStationIds.length} stations`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="relative min-w-0 sm:w-56" ref={stationRef}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">Station</p>
          <button
            type="button"
            onClick={() => setStationOpen((o) => !o)}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-midnight transition-colors focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
            aria-haspopup="listbox"
            aria-expanded={stationOpen}
            aria-label="Select stations"
          >
            <span className="truncate">{stationLabel}</span>
            <svg className={`h-4 w-4 shrink-0 text-storm/40 transition-transform ${stationOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {stationOpen && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg" role="listbox" aria-label="Stations">
              <label className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 text-xs font-medium text-storm/60 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onStationIdsChange([])}
                  className="h-4 w-4 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft"
                />
                All stations
              </label>
              {stations.map((s) => (
                <label
                  key={s.station_id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-xs text-storm/70 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={allSelected || selectedStationIds.includes(s.station_id)}
                    onChange={() => toggleStation(s.station_id)}
                    className="h-4 w-4 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft"
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />

        <div className="sm:ml-auto">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">View</p>
          <div className="flex gap-1" role="tablist" aria-label="Analysis view mode">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={viewMode === tab.key}
                onClick={() => onViewModeChange(tab.key)}
                className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === tab.key
                    ? 'bg-midnight text-white shadow-xs'
                    : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">
          {viewMode === 'correlation' ? 'Primary metric' : 'Metric'}
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sensor metric">
          {SENSOR_KEYS.map((key) => {
            const cfg = SENSOR_METRIC_CONFIG[key]
            const isActive = selectedMetricKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onMetricKeyChange(key)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-midnight text-white shadow-xs'
                    : 'bg-white text-storm/60 hover:bg-slate-100 hover:text-storm border border-slate-200'
                }`}
                aria-pressed={isActive}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {viewMode === 'correlation' && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">Secondary metric</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Secondary sensor metric">
            {SENSOR_KEYS.map((key) => {
              const cfg = SENSOR_METRIC_CONFIG[key]
              const isActive = correlationMetricB === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCorrelationMetricBChange(key)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-ocean text-white shadow-xs'
                      : 'bg-white text-storm/60 hover:bg-slate-100 hover:text-storm border border-slate-200'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
