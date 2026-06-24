import { useState, useRef, useEffect } from 'react'
import type { StationReading, SensorType, ViewMode } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'
import { DateRangePicker } from '../shared/DateRangePicker'

const SENSOR_TYPES = Object.keys(SENSOR_CONFIG) as SensorType[]

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'trends', label: 'Trends' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'correlation', label: 'Correlation' },
  { key: 'distribution', label: 'Distribution' },
]

interface AnalysisControlsProps {
  stations: StationReading[]
  selectedStationIds: number[]
  onStationIdsChange: (ids: number[]) => void
  selectedSensorTypes: SensorType[]
  onSensorTypesChange: (types: SensorType[]) => void
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
  selectedSensorTypes,
  onSensorTypesChange,
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

  function toggleStation(id: number) {
    if (allSelected) {
      onStationIdsChange([id])
    } else {
      const next = selectedStationIds.includes(id)
        ? selectedStationIds.filter((sid) => sid !== id)
        : [...selectedStationIds, id]
      onStationIdsChange(next.length === stations.length ? [] : next)
    }
  }

  function toggleAll() {
    onStationIdsChange([])
  }

  function toggleSensor(type: SensorType) {
    const next = selectedSensorTypes.includes(type)
      ? selectedSensorTypes.filter((t) => t !== type)
      : [...selectedSensorTypes, type]
    onSensorTypesChange(next.length === 0 ? [type] : next)
  }

  const stationLabel = allSelected
    ? `All (${stations.length})`
    : selectedStationIds.length === 1
      ? stations.find((s) => s.id === selectedStationIds[0])?.name ?? '1 station'
      : `${selectedStationIds.length} stations`

  return (
    <div className="space-y-4">
      {/* Row 1: Station multi-select + Date range + View tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
        {/* Station multi-select dropdown */}
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
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft"
                />
                All stations
              </label>
              {stations.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-xs text-storm/70 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={allSelected || selectedStationIds.includes(s.id)}
                    onChange={() => toggleStation(s.id)}
                    className="h-4 w-4 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft"
                  />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />

        {/* View-mode tabs */}
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

      {/* Row 2: Sensor type multi-select pills */}
      <div className="flex flex-wrap gap-1" role="group" aria-label="Sensor types">
        {SENSOR_TYPES.map((type) => {
          const cfg = SENSOR_CONFIG[type]
          const isActive = selectedSensorTypes.includes(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleSensor(type)}
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
  )
}
